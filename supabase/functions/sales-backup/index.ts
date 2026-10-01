import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "sales-backups";
const RETENTION_YEARS = 5;

const TABLES = [
  "orders",
  "order_status_history",
  "payment_events",
  "payment_reconciliation",
  "cash_closures",
  "order_refunds",
  "order_disputes",
  "store_credit_transactions",
  "special_orders",
  "special_order_items",
  "special_order_quotes",
  "special_order_status_history",
  "special_order_attachments",
  "shipping_label_events",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function fetchAll(admin: ReturnType<typeof createClient>, table: string) {
  const rows: unknown[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin.from(table).select("*").range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return rows;
}

async function listAll(admin: ReturnType<typeof createClient>, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    for (const e of data ?? []) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listAll(admin, bucket, path)));
      else out.push(path);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  // Only privileged (service) keys may run the backup: verify by attempting an admin-only call.
  const caller = createClient(url, token, { auth: { persistSession: false } });
  const probe = await caller.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (probe.error) return json({ error: "forbidden" }, 403);
  const admin = caller;

  try {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const summary: Record<string, number> = {};
    const data: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      data[t] = await fetchAll(admin, t);
      summary[t] = data[t].length;
    }

    const payload = JSON.stringify(
      { generated_at: now.toISOString(), retention_years: RETENTION_YEARS, summary, data },
      null,
      0,
    );
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(`daily/${day}/vendas-${day}.json`, new Blob([payload], { type: "application/json" }), {
        upsert: true,
        contentType: "application/json",
      });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    // Copy PIX receipts (only new ones).
    const receipts = await listAll(admin, "receipts");
    const already = new Set(await listAll(admin, BUCKET, "comprovantes"));
    let copied = 0;
    for (const path of receipts) {
      const dest = `comprovantes/${path}`;
      if (already.has(dest)) continue;
      const { data: file, error } = await admin.storage.from("receipts").download(path);
      if (error || !file) continue;
      const { error: e2 } = await admin.storage.from(BUCKET).upload(dest, file, { upsert: false, contentType: file.type || undefined });
      if (!e2) copied++;
    }

    // Retention: delete daily backups older than 5 years.
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    const daily = await listAll(admin, BUCKET, "daily");
    const old = daily.filter((p) => (p.split("/")[1] ?? "9999") < cutoffDay);
    if (old.length) await admin.storage.from(BUCKET).remove(old);

    return json({ ok: true, day, summary, receipts_copied: copied, removed_old: old.length });
  } catch (e) {
    console.error("sales-backup failed:", e);
    return json({ error: "backup_failed", details: String((e as Error).message ?? e) }, 500);
  }
});
