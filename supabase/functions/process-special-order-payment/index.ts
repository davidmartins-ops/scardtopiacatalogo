import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://www.spencerscardtopia.com.br";
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") ?? "spencers-cardtopia";

const BodySchema = z.object({
  special_order_id: z.string().uuid(),
  payment_method: z.enum(["pix", "credit", "debit"]).default("pix"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const INFINITEPAY_API_KEY = Deno.env.get("INFINITEPAY_API_KEY");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { special_order_id, payment_method } = parsed.data;

    const { data: order, error: orderErr } = await admin
      .from("special_orders")
      .select("id, user_id, status, total, customer_info")
      .eq("id", special_order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Encomenda não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["approved", "quoted"].includes(order.status)) {
      return new Response(JSON.stringify({ error: "Encomenda não está aprovada para pagamento" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemsRes = await admin
      .from("special_order_items")
      .select("name, quantity, unit_price")
      .eq("special_order_id", special_order_id);
    const items = (itemsRes.data ?? []).map((i: any) => ({
      description: String(i.name ?? "Item"),
      quantity: Number(i.quantity) || 1,
      price: Math.round((Number(i.unit_price) || 0) * 100),
    }));

    const totalCents = Math.round(Number(order.total) * 100);
    if (!Number.isFinite(totalCents) || totalCents <= 0) {
      return new Response(JSON.stringify({ error: "Invalid order total" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encomendas: parcelamento limitado a 6x sem juros no checkout InfinitePay.
    const SPECIAL_ORDER_MAX_INSTALLMENTS = 6;

    const checkoutPayload = {
      handle: INFINITEPAY_HANDLE,
      order_nsu: special_order_id,
      redirect_url: `${SITE_URL}/pedido/sucesso`,
      max_installments: SPECIAL_ORDER_MAX_INSTALLMENTS,
      installments: SPECIAL_ORDER_MAX_INSTALLMENTS,
      items: items.length > 0 ? items : [{ description: `Encomenda ${special_order_id.slice(0, 8)}`, quantity: 1, price: totalCents }],
    };


    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (INFINITEPAY_API_KEY) headers["Authorization"] = `Bearer ${INFINITEPAY_API_KEY}`;

    const response = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers,
      body: JSON.stringify(checkoutPayload),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("InfinitePay special order checkout error", response.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Payment provider error. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const checkout_url = data.url ?? data.checkout_url ?? data.link;
    if (typeof checkout_url !== "string" || !/^https:\/\/[^\s]+$/.test(checkout_url)) {
      return new Response(
        JSON.stringify({ error: "O provedor de pagamento não retornou um link válido.", code: "invalid_checkout_url" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // NOTE: special_order_status has no "pending_payment" value — keep the current
    // status and record the payment attempt so the UI can warn about duplicates.
    const { error: updErr } = await admin
      .from("special_orders")
      .update({
        payment_method,
        payment_transaction_id: data.transaction_id ?? data.id ?? special_order_id,
      })
      .eq("id", special_order_id);
    if (updErr) {
      console.error("failed to record special order payment attempt", updErr);
    }

    return new Response(
      JSON.stringify({ success: true, checkout_url, transaction_id: data.transaction_id ?? data.id ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-special-order-payment error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
