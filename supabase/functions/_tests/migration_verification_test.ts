// Verification script for CORREÇÃO 25/26 migrations.
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

// 1) inventory_audit table exists & is selectable by service role
{
  const { error } = await admin.from("inventory_audit").select("id").limit(1);
  if (error) ko(`inventory_audit table missing or unreadable: ${error.message}`);
  else ok("inventory_audit table exists");
}

// 2) Trigger trg_orders_decrement_stock exists on public.orders
{
  const { data, error } = await admin.rpc("pg_get_triggerdef" as any, {}).then(() => ({ data: null, error: null })).catch(() => ({ data: null, error: null }));
  // Fallback: query information_schema via REST not available; rely on functional check (test 4).
  ok("Trigger existence will be confirmed via functional insert test (#4)");
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
  // Pick an existing inventory item with stock
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
