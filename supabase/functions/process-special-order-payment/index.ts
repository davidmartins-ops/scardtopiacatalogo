import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      .select("id, user_id, status, total, customer_info, shipping_address")
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
      description: i.name,
      quantity: Number(i.quantity),
      price: Math.round(Number(i.unit_price) * 100),
    }));

    const totalCents = Math.round(Number(order.total) * 100);
    const payload = {
      description: `Encomenda especial ${special_order_id.slice(0, 8)}`,
      amount: totalCents,
      items,
      customer: {
        ...(order.customer_info ?? {}),
        email: order.customer_info?.email ?? undefined,
        phone: order.customer_info?.phone ?? undefined,
      },
      metadata: {
        special_order_id,
        payment_method,
        source: "special_order",
      },
      // Default to free shipping unless configured otherwise; admin can add shipping cost later.
      shipping: 0,
    };

    const checkoutRes = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        special_order_id,
        payment_method,
        payload,
      }),
    });

    if (!checkoutRes.ok) {
      const text = await checkoutRes.text();
      return new Response(
        JSON.stringify({ error: "Falha ao gerar pagamento", detail: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const checkoutData = await checkoutRes.json();

    await admin
      .from("special_orders")
      .update({ payment_method, payment_transaction_id: checkoutData.transaction_id ?? null })
      .eq("id", special_order_id);

    return new Response(
      JSON.stringify({ success: true, checkout_url: checkoutData.url, transaction_id: checkoutData.transaction_id }),
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
