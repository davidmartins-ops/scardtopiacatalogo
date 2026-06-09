const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Default site (override via env if needed)
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://www.spencerscardtopia.com.br";
const INFINITEPAY_HANDLE = Deno.env.get("INFINITEPAY_HANDLE") ?? "spencers-cardtopia";

const BodySchema = z.object({
  order_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // InfinitePay public checkout link endpoint does NOT require an API key —
  // the `handle` identifies the merchant. We still keep the secret optional in
  // case InfinitePay starts requiring it on this account.
  const INFINITEPAY_API_KEY = Deno.env.get("INFINITEPAY_API_KEY");

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claimsData.claims.sub as string;

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    const { order_id } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, total, items")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (order.user_id !== userId && !isAdminRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsPayload = items.map((i: any) => ({
      description: String(i.name ?? "Item"),
      quantity: Number(i.quantity) || 1,
      price: Math.round((Number(i.unit_price) || 0) * 100),
    }));

    // Recompute total from items (cents) to match what InfinitePay expects
    const total = itemsPayload.reduce((s, it) => s + it.price * it.quantity, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return new Response(JSON.stringify({ error: "Invalid order total" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checkoutPayload = {
      handle: INFINITEPAY_HANDLE,
      order_nsu: order_id,
      redirect_url: `${SITE_URL}/pedido/sucesso`,
      items: itemsPayload,
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
      console.error("InfinitePay API error:", response.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Payment provider error. Please try again." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    const checkout_url = data.url ?? data.checkout_url ?? data.link;

    await supabase.from("orders").update({
      status: "pending_payment",
    }).eq("id", order_id);

    return new Response(
      JSON.stringify({ checkout_url, raw: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Checkout error:", msg);
    return new Response(
      JSON.stringify({ error: "Unable to create checkout. Please try again." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
