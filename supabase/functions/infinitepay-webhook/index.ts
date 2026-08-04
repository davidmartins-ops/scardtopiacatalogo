const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") ?? "spencers-cardtopia";
const WEBHOOK_SECRET = Deno.env.get("INFINITEPAY_WEBHOOK_SECRET");

// InfinitePay sends slightly different shapes depending on the event; accept
// the common aliases and normalize.
const BodySchema = z.object({
  order_nsu: z.string().min(1).optional(),
  external_order_nsu: z.string().min(1).optional(),
  order_id: z.string().min(1).optional(),
  transaction_nsu: z.string().min(1).optional(),
  nsu: z.string().min(1).optional(),
  invoice_slug: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  receipt_url: z.string().url().optional(),
  capture_method: z.string().optional(),
}).passthrough();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Optional shared-secret check (configure the same value in InfinitePay).
    if (WEBHOOK_SECRET) {
      const url = new URL(req.url);
      const provided =
        req.headers.get("x-webhook-secret") ??
        url.searchParams.get("secret") ??
        "";
      if (provided !== WEBHOOK_SECRET) {
        console.warn("infinitepay-webhook rejected: bad secret");
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      console.error("infinitepay-webhook invalid payload", JSON.stringify(raw));
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const p = parsed.data;
    const order_nsu = p.order_nsu ?? p.external_order_nsu ?? p.order_id;
    const transaction_nsu = p.transaction_nsu ?? p.nsu;
    const slug = p.invoice_slug ?? p.slug;

    console.log("infinitepay-webhook received", { order_nsu, transaction_nsu, slug });

    if (!order_nsu || !transaction_nsu) {
      return json({ error: "Missing order_nsu or transaction_nsu" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotency
    const { data: existing } = await supabase
      .from("payment_events")
      .select("order_id, status")
      .eq("transaction_nsu", transaction_nsu)
      .maybeSingle();
    if (existing?.status === "paid") {
      return json({ ok: true, status: "already_confirmed", order_id: existing.order_id });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, total, status")
      .eq("id", order_nsu)
      .maybeSingle();
    if (!order) {
      console.error("infinitepay-webhook order not found", order_nsu);
      return json({ error: "Order not found" }, 404);
    }

    // Never trust the webhook body — verify with InfinitePay.
    const checkRes = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: INFINITEPAY_HANDLE, order_nsu, transaction_nsu, slug }),
    });
    const checkData = await checkRes.json().catch(() => ({} as any));

    if (!checkRes.ok || !checkData?.success || !checkData?.paid) {
      await supabase.from("payment_events").insert({
        order_id: order.id,
        transaction_nsu,
        invoice_slug: slug ?? null,
        status: "unpaid",
        amount: checkData?.amount ?? null,
        paid_amount: checkData?.paid_amount ?? null,
        capture_method: checkData?.capture_method ?? p.capture_method ?? null,
        installments: checkData?.installments ?? null,
        raw_response: { webhook: raw, check: checkData },
      });
      // 200 so the provider does not retry forever on a genuinely unpaid tx.
      return json({ ok: false, status: "unpaid" });
    }

    const expectedCents = Math.round(Number(order.total) * 100);
    const providerAmount = Number(checkData.amount);
    if (!Number.isFinite(providerAmount) || Math.abs(providerAmount - expectedCents) > 2) {
      await supabase.from("payment_events").insert({
        order_id: order.id,
        transaction_nsu,
        invoice_slug: slug ?? null,
        status: "amount_mismatch",
        amount: providerAmount,
        paid_amount: checkData.paid_amount ?? null,
        capture_method: checkData.capture_method ?? null,
        installments: checkData.installments ?? null,
        raw_response: { webhook: raw, check: checkData },
      });
      console.error("infinitepay-webhook amount mismatch", { order_id: order.id, expectedCents, providerAmount });
      return json({ ok: false, status: "amount_mismatch" }, 409);
    }

    if (order.status !== "payment_confirmed") {
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          status: "payment_confirmed",
          payment_transaction_id: transaction_nsu,
          payment_invoice_slug: slug ?? null,
          paid_amount: Number(checkData.paid_amount ?? checkData.amount) / 100,
          paid_at: new Date().toISOString(),
          payment_capture_method: checkData.capture_method ?? p.capture_method ?? null,
          payment_installments: checkData.installments ?? null,
          receipt_url: p.receipt_url ?? null,
        })
        .eq("id", order.id);
      if (updateErr) {
        console.error("infinitepay-webhook order update failed", updateErr);
        return json({ error: "Failed to update order" }, 500);
      }
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
      raw_response: { webhook: raw, check: checkData },
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

    return json({ ok: true, status: "confirmed", order_id: order.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("infinitepay-webhook error:", msg);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
