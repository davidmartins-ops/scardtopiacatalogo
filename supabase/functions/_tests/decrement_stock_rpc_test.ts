// Verifies that the public.decrement_inventory_stock RPC:
//  1. Cannot be called by anonymous users.
//  2. Cannot be called by ordinary authenticated users (admin-only).
//
// Run with:  supabase functions serve / deno test --allow-net --allow-env
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

Deno.test("anonymous user cannot call decrement_inventory_stock", async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Skipping: SUPABASE_URL/ANON_KEY not configured");
    return;
  }
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await anon.rpc("decrement_inventory_stock", {
    _item_id: "non-existent-id",
    _qty: 1,
  });
  assert(error, "Expected an error for anonymous caller");
  // Either permission denied (revoke worked) or auth required (in-function guard).
  const msg = (error?.message ?? "").toLowerCase();
  assert(
    msg.includes("permission denied") ||
      msg.includes("autenticação") ||
      msg.includes("authenticated") ||
      msg.includes("admin"),
    `Unexpected error message: ${error?.message}`,
  );
});

Deno.test("authenticated non-admin cannot call decrement_inventory_stock", async () => {
  const TEST_EMAIL = Deno.env.get("TEST_USER_EMAIL");
  const TEST_PASSWORD = Deno.env.get("TEST_USER_PASSWORD");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
    console.warn(
      "Skipping non-admin test: set TEST_USER_EMAIL / TEST_USER_PASSWORD env vars",
    );
    return;
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  assertEquals(signInErr, null);

  const { error } = await client.rpc("decrement_inventory_stock", {
    _item_id: "non-existent-id",
    _qty: 1,
  });
  assert(error, "Expected an error for non-admin caller");
  const msg = (error?.message ?? "").toLowerCase();
  assert(
    msg.includes("admin") || msg.includes("permission"),
    `Unexpected error message: ${error?.message}`,
  );
});
