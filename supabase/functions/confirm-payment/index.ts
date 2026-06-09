const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") ?? "spencers-cardtopia";

const BodySchema = z.object({
  order_nsu: z.string().min(1),
  transaction_nsu: z.string().min(1),
  slug: z.string().min(1).optional(),
  receipt_url: z.string().url().optional(),
  capture_method: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    const { order_nsu, transaction_nsu, slug, receipt_url, capture_method } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotency: if we already processed this transaction, return success
    const { data: existingEvent } = await supabase
      .from("payment_events")
      .select("order_id, status")
      .eq("transaction_nsu", transaction_nsu)
      .maybeSingle();
    if (existingEvent?.status === "paid") {
      return new Response(
        JSON.stringify({ ok: true, status: "already_confirmed", order_id: existingEvent.order_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, total, status, user_id")
      .eq("id", order_nsu)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SERVER-SIDE VERIFICATION: ask InfinitePay if this transaction is really paid
    const checkRes = await fetch(
      "https://api.infinitepay.io/invoices/public/checkout/payment_check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: INFINITEPAY_HANDLE,
          order_nsu,
          transaction_nsu,
          slug,
        }),
      }
    );
    const checkData = await checkRes.json().catch(() => ({}));

    if (!checkRes.ok || !checkData?.success || !checkData?.paid) {
      // Log failed/pending event
      await supabase.from("payment_events").insert({
        order_id: order.id,
        transaction_nsu,
        invoice_slug: slug ?? null,
        status: "unpaid",
        amount: checkData?.amount ?? null,
        paid_amount: checkData?.paid_amount ?? null,
        capture_method: checkData?.capture_method ?? capture_method ?? null,
        installments: checkData?.installments ?? null,
        raw_response: checkData ?? null,
      });
      return new Response(
        JSON.stringify({ ok: false, status: "unpaid", details: checkData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
      );
    }

    // Amount validation (anti-fraud) - InfinitePay returns amount in cents
    const expectedCents = Math.round(Number(order.total) * 100);
    const providerAmount = Number(checkData.amount);
    const tolerance = 2; // 2 cents
    if (!Number.isFinite(providerAmount) || Math.abs(providerAmount - expectedCents) > tolerance) {
      await supabase.from("payment_events").insert({
        order_id: order.id,
        transaction_nsu,
        invoice_slug: slug ?? null,
        status: "amount_mismatch",
        amount: providerAmount,
        paid_amount: checkData.paid_amount ?? null,
        capture_method: checkData.capture_method ?? null,
        installments: checkData.installments ?? null,
        raw_response: checkData,
      });
      console.error("Amount mismatch", { order_id: order.id, expectedCents, providerAmount });
      return new Response(
        JSON.stringify({ ok: false, status: "amount_mismatch" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
      );
    }

    // All good — confirm payment
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "payment_confirmed",
        payment_transaction_id: transaction_nsu,
        payment_invoice_slug: slug ?? null,
        paid_amount: Number(checkData.paid_amount ?? checkData.amount) / 100,
        paid_at: new Date().toISOString(),
        payment_capture_method: checkData.capture_method ?? capture_method ?? null,
        payment_installments: checkData.installments ?? null,
        receipt_url: receipt_url ?? null,
      })
      .eq("id", order.id);

    if (updateErr) {
      console.error("Order update failed", updateErr);
      return new Response(JSON.stringify({ error: "Failed to update order" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("payment_events").insert({
      order_id: order.id,
      transaction_nsu,
      invoice_slug: slug ?? null,
      status: "paid",
      amount: providerAmount,
      paid_amount: checkData.paid_amount ?? null,
      capture_method: checkData.capture_method ?? null,
      installments: checkData.installments ?? null,
      raw_response: checkData,
    });

    // Best-effort: trigger email
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

    return new Response(
      JSON.stringify({ ok: true, status: "confirmed", order_id: order.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("confirm-payment error:", msg);
    return new Response(
      JSON.stringify({ error: "Unable to confirm payment" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
