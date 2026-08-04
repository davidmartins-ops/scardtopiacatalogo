const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") ?? "spencers-cardtopia";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function paymentCheck(payload: Record<string, unknown>) {
  const res = await fetch("https://api.checkout.infinitepay.io/payment_check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as any));
  return { ok: res.ok, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Pedidos aguardando pagamento nas últimas 48h
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, total, status, payment_transaction_id, payment_invoice_slug, created_at")
      .eq("status", "pending_payment")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("poll-pending-payments query failed", error);
      return json({ error: "Query failed" }, 500);
    }

    const results: Array<Record<string, unknown>> = [];

    for (const order of orders ?? []) {
      const basePayload: Record<string, unknown> = {
        handle: INFINITEPAY_HANDLE,
        order_nsu: order.id,
      };
      if (order.payment_transaction_id) basePayload.transaction_nsu = order.payment_transaction_id;
      if (order.payment_invoice_slug) basePayload.slug = order.payment_invoice_slug;

      const { ok, data: checkData } = await paymentCheck(basePayload);

      if (!ok || !checkData?.success || !checkData?.paid) {
        results.push({ order_id: order.id, status: "unpaid" });
        continue;
      }

      const transaction_nsu =
        (order.payment_transaction_id as string | null) ??
        checkData.transaction_nsu ??
        checkData.nsu ??
        `poll-${order.id}`;

      // Idempotência
      const { data: existing } = await supabase
        .from("payment_events")
        .select("id, status")
        .eq("transaction_nsu", transaction_nsu)
        .maybeSingle();
      if (existing?.status === "paid") {
        results.push({ order_id: order.id, status: "already_confirmed" });
        continue;
      }

      const expectedCents = Math.round(Number(order.total) * 100);
      const providerAmount = Number(checkData.amount);
      if (!Number.isFinite(providerAmount) || Math.abs(providerAmount - expectedCents) > 2) {
        await supabase.from("payment_events").insert({
          order_id: order.id,
          transaction_nsu,
          invoice_slug: order.payment_invoice_slug ?? null,
          status: "amount_mismatch",
          amount: providerAmount,
          paid_amount: checkData.paid_amount ?? null,
          capture_method: checkData.capture_method ?? null,
          installments: checkData.installments ?? null,
          raw_response: { poll: checkData },
        });
        console.error("poll amount mismatch", { order_id: order.id, expectedCents, providerAmount });
        results.push({ order_id: order.id, status: "amount_mismatch" });
        continue;
      }

      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          status: "payment_confirmed",
          payment_transaction_id: transaction_nsu,
          payment_invoice_slug: order.payment_invoice_slug ?? checkData.invoice_slug ?? null,
          paid_amount: Number(checkData.paid_amount ?? checkData.amount) / 100,
          paid_at: new Date().toISOString(),
          payment_capture_method: checkData.capture_method ?? null,
          payment_installments: checkData.installments ?? null,
        })
        .eq("id", order.id);

      if (updateErr) {
        console.error("poll order update failed", updateErr);
        results.push({ order_id: order.id, status: "update_failed" });
        continue;
      }

      await supabase.from("payment_events").insert({
        order_id: order.id,
        transaction_nsu,
        invoice_slug: order.payment_invoice_slug ?? null,
        status: "paid",
        amount: providerAmount,
        paid_amount: checkData.paid_amount ?? null,
        capture_method: checkData.capture_method ?? null,
        installments: checkData.installments ?? null,
        raw_response: { poll: checkData },
      });

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/notify-order-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ orderId: order.id, status: "payment_confirmed" }),
        });
      } catch (e) {
        console.warn("notify-order-status failed", e);
      }

      results.push({ order_id: order.id, status: "confirmed" });
    }

    console.log("poll-pending-payments done", { checked: orders?.length ?? 0, results });
    return json({ ok: true, checked: orders?.length ?? 0, results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("poll-pending-payments error:", msg);
    return json({ error: "Polling failed" }, 500);
  }
});
