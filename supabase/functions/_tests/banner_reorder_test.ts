// Integration tests for trg_reorder_banners.
// Run with: deno run --allow-env --allow-net supabase/functions/_tests/banner_reorder_test.ts
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (staging only).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

let pass = 0;
let fail = 0;
const ok = (m: string) => { console.log(`✅ ${m}`); pass++; };
const ko = (m: string) => { console.error(`❌ ${m}`); fail++; };

const TAG = `__reorder_test_${Date.now()}__`;
const createdIds: string[] = [];

async function listOrders(): Promise<Array<{ id: string; sort_order: number; title: string }>> {
  const { data } = await admin
    .from("banners")
    .select("id, sort_order, title")
    .like("title", `${TAG}%`)
    .order("sort_order", { ascending: true });
  return (data as any[]) ?? [];
}

async function insertBanner(title: string, sort_order: number) {
  const { data, error } = await admin.from("banners").insert({
    image_url: "https://example.com/x.png",
    alt: title, label: "", title, subtitle: "",
    sort_order, is_active: false, display_page: "all",
  }).select("id").single();
  if (error) throw error;
  createdIds.push((data as any).id);
  return (data as any).id as string;
}

function isSequential(rows: { sort_order: number }[]): boolean {
  return rows.every((r, i) => r.sort_order === i);
}

// 1) Sequential sort_order after multiple inserts
{
  await insertBanner(`${TAG} A`, 0);
  await insertBanner(`${TAG} B`, 0); // colliding
  await insertBanner(`${TAG} C`, 999); // gap
  const rows = await listOrders();
  if (rows.length === 3 && isSequential(rows)) ok(`INSERT: sort_order sequential ${rows.map(r => r.sort_order).join(",")}`);
  else ko(`INSERT: expected [0,1,2], got ${JSON.stringify(rows.map(r => r.sort_order))}`);
}

// 2) Reorder: move last to first
{
  const rows = await listOrders();
  const last = rows[rows.length - 1];
  const { error } = await admin.from("banners").update({ sort_order: -1 }).eq("id", last.id);
  if (error) ko(`Reorder update failed: ${error.message}`);
  const after = await listOrders();
  if (isSequential(after) && after[0].id === last.id) ok(`REORDER: moved to top, sequence ${after.map(r => r.sort_order).join(",")}`);
  else ko(`REORDER: expected top=${last.id}, got ${JSON.stringify(after)}`);
}

// 3) Delete middle → sequence tightens with no gaps
{
  const rows = await listOrders();
  const mid = rows[1];
  await admin.from("banners").delete().eq("id", mid.id);
  createdIds.splice(createdIds.indexOf(mid.id), 1);
  const after = await listOrders();
  if (isSequential(after) && after.length === 2) ok(`DELETE: gap closed, sequence ${after.map(r => r.sort_order).join(",")}`);
  else ko(`DELETE: expected sequential 2 rows, got ${JSON.stringify(after)}`);
}

// 4) Concurrent reorder: two parallel updates should both succeed without duplicates
{
  // Repopulate to 4 items
  await insertBanner(`${TAG} D`, 100);
  await insertBanner(`${TAG} E`, 100);
  const rows = await listOrders();
  if (rows.length >= 2) {
    const a = rows[0], b = rows[rows.length - 1];
    // Fire both updates in parallel; advisory lock inside trigger serializes them
    const [r1, r2] = await Promise.all([
      admin.from("banners").update({ sort_order: -5 }).eq("id", b.id),
      admin.from("banners").update({ sort_order: -10 }).eq("id", a.id),
    ]);
    if (r1.error || r2.error) ko(`CONCURRENT: ${r1.error?.message ?? r2.error?.message}`);
    const after = await listOrders();
    const values = after.map(r => r.sort_order);
    const unique = new Set(values).size === values.length;
    if (isSequential(after) && unique) ok(`CONCURRENT: no duplicates, sequence ${values.join(",")}`);
    else ko(`CONCURRENT: duplicates or gaps: ${JSON.stringify(values)}`);
  }
}

// Cleanup
for (const id of createdIds) {
  await admin.from("banners").delete().eq("id", id);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
Deno.exit(fail > 0 ? 1 : 0);
