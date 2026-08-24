const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") ?? "spencers-cardtopia";

const BodySchema = z.object({ order_id: z.string().uuid() });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { order_id } = parsed.data;

    // Autenticação obrigatória: apenas o dono do pedido pode reconsultar
    let callerUserId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const { data: claims } = await supabase.auth.getClaims(authHeader.slice("Bearer ".length));
      callerUserId = claims?.claims?.sub ?? null;
    }
    if (!callerUserId) return json({ error: "Unauthorized" }, 401);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, total, status, user_id, payment_transaction_id, payment_invoice_slug")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== callerUserId) return json({ error: "Forbidden" }, 403);

    if (order.status !== "pending_payment") {
      return json({ ok: true, status: order.status, paid: order.status !== "cancelled" });
    }

    const payload: Record<string, unknown> = { handle: INFINITEPAY_HANDLE, order_nsu: order.id };
    if (order.payment_transaction_id) payload.transaction_nsu = order.payment_transaction_id;
    if (order.payment_invoice_slug) payload.slug = order.payment_invoice_slug;

    const res = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const checkData = await res.json().catch(() => ({} as any));

    if (!res.ok || !checkData?.success || !checkData?.paid) {
      return json({ ok: true, status: "pending_payment", paid: false });
    }

    const transaction_nsu =
      (order.payment_transaction_id as string | null) ??
      checkData.transaction_nsu ??
      checkData.nsu ??
      `recheck-${order.id}`;

    const { data: existing } = await supabase
      .from("payment_events")
      .select("id, status")
      .eq("transaction_nsu", transaction_nsu)
      .maybeSingle();
    if (existing?.status === "paid") {
      return json({ ok: true, status: "payment_confirmed", paid: true });
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
        raw_response: { recheck: checkData },
      });
      return json({ ok: true, status: "amount_mismatch", paid: false });
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
      console.error("check-payment-status update failed", updateErr);
      return json({ error: "Update failed" }, 500);
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
      raw_response: { recheck: checkData },
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

    return json({ ok: true, status: "payment_confirmed", paid: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("check-payment-status error:", msg);
    return json({ error: "Check failed" }, 500);
  }
});
