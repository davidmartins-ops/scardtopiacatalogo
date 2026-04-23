// Verification script for CORREÇÃO 25/26/27 migrations.
// Run with: deno run --allow-env --allow-net supabase/functions/_tests/migration_verification_test.ts
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (use staging creds).

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

const ok = (msg: string) => { console.log(`✅ ${msg}`); pass++; };
const ko = (msg: string) => { console.error(`❌ ${msg}`); fail++; };

// Helper: run raw SQL via PostgREST. Requires an `exec_sql` RPC in the project.
// CORREÇÃO 28.7: When the RPC is missing, surface clear instructions on how to verify via psql.
async function runSQL(sql: string): Promise<{ rows: any[] | null; error: string | null; missingRpc?: boolean }> {
  const r = await admin.rpc("exec_sql" as any, { sql }).catch(() => null);
  if (r && !r.error) return { rows: (r.data as any[]) ?? [], error: null };
  if (r?.error && /function .*exec_sql.* does not exist/i.test(r.error.message)) {
    return { rows: null, error: r.error.message, missingRpc: true };
  }
  // Fallback REST call
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  if (res.status === 404) return { rows: null, error: "exec_sql RPC not found", missingRpc: true };
  if (!res.ok) return { rows: null, error: `HTTP ${res.status}` };
  const data = await res.json().catch(() => null);
  return { rows: Array.isArray(data) ? data : [], error: null };
}

const printPsqlInstructions = (sql: string, label: string) => {
  console.error(`\n⚠️  Could not verify "${label}" automatically because the 'exec_sql' RPC is not deployed.`);
  console.error(`To verify manually, run this with psql against the staging database:\n`);
  console.error(`    psql "$SUPABASE_DB_URL" -c "${sql.replace(/\n\s*/g, " ").trim()}"\n`);
  console.error(`Or paste the same query in the Supabase SQL editor. Expected: at least 1 row returned.`);
  console.error(`Alternatively, deploy a small RPC:\n`);
  console.error(`    CREATE OR REPLACE FUNCTION public.exec_sql(sql text) RETURNS setof json`);
  console.error(`      LANGUAGE plpgsql SECURITY DEFINER AS $$`);
  console.error(`      BEGIN RETURN QUERY EXECUTE 'SELECT row_to_json(t) FROM (' || sql || ') t'; END; $$;`);
  console.error(`    REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;\n`);
};

// 1) inventory_audit table exists & is selectable by service role
{
  const { error } = await admin.from("inventory_audit").select("id").limit(1);
  if (error) ko(`inventory_audit table missing or unreadable: ${error.message}`);
  else ok("inventory_audit table exists");
}

// 2) Trigger trg_orders_decrement_stock exists on public.orders — explicit metadata query
{
  const sql = `
    SELECT t.tgname, c.relname, p.proname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'orders'
      AND t.tgname = 'trg_orders_decrement_stock'
      AND NOT t.tgisinternal;
  `;
  const { rows, error, missingRpc } = await runSQL(sql);
  if (missingRpc) {
    printPsqlInstructions(sql, "trg_orders_decrement_stock trigger");
    ko("Cannot verify trigger metadata: 'exec_sql' RPC missing — see psql instructions above");
  } else if (error) {
    ko(`Could not query pg_trigger metadata (${error}). Run the SQL above via psql instead.`);
  } else if (!rows || rows.length === 0) {
    ko("Trigger trg_orders_decrement_stock NOT FOUND on public.orders — migration is missing or failed");
  } else {
    ok(`Trigger trg_orders_decrement_stock exists on public.orders (function: ${rows[0]?.proname ?? "unknown"})`);
  }
}

// 3) RPC decrement_inventory_stock callable as admin (service role bypasses RLS but auth.uid() is null → expect 'Autenticação obrigatória')
{
  const { error } = await admin.rpc("decrement_inventory_stock" as any, { _item_id: "__nonexistent__", _qty: 1 });
  if (error && /Autenticação obrigatória|administradores/i.test(error.message)) {
    ok("decrement_inventory_stock guards (auth/admin) are enforced");
  } else if (error) {
    ko(`Unexpected RPC error: ${error.message}`);
  } else {
    ko("RPC succeeded without auth/admin guard — security issue");
  }
}

// 4) Functional test: insert an order, verify inventory decrement + audit row written by trigger
{
  const { data: items } = await admin.from("inventory").select("id, quantity").gt("quantity", 0).limit(1);
  if (!items || items.length === 0) {
    ko("No inventory item with stock > 0 to test trigger");
  } else {
    const item = items[0] as any;
    const prevQty = item.quantity;
    const testItems = [{ id: item.id, name: "TEST", quantity: 1, unit_price: 0, total_price: 0 }];
    const { data: order, error: insErr } = await admin.from("orders").insert({
      user_id: null, items: testItems as any, total: 0, status: "test_migration",
    }).select("id").single();

    if (insErr || !order) {
      ko(`Order insert failed: ${insErr?.message}`);
    } else {
      const { data: audit } = await admin.from("inventory_audit").select("*").eq("order_id", (order as any).id);
      const { data: after } = await admin.from("inventory").select("quantity").eq("id", item.id).single();

      if (audit && audit.length > 0) ok(`Trigger wrote ${audit.length} audit row(s) for order ${(order as any).id}`);
      else ko("Trigger did NOT write audit row — trg_orders_decrement_stock missing or broken");

      if ((after as any)?.quantity === prevQty - 1) ok(`Stock decremented: ${prevQty} → ${(after as any).quantity}`);
      else ko(`Stock not decremented correctly: ${prevQty} → ${(after as any)?.quantity}`);

      // Cleanup
      await admin.from("orders").delete().eq("id", (order as any).id);
      await admin.from("inventory").update({ quantity: prevQty }).eq("id", item.id);
    }
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
Deno.exit(fail > 0 ? 1 : 0);
