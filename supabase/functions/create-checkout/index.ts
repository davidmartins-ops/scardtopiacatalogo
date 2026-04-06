const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  amount: z.number().int().positive(), // in cents (e.g. R$ 10.00 = 1000)
  order_id: z.string().uuid(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().int().positive(),
    unit_price: z.number().positive(),
  })),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const INFINITEPAY_API_KEY = Deno.env.get("INFINITEPAY_API_KEY");
  if (!INFINITEPAY_API_KEY) {
    return new Response(
      JSON.stringify({ error: "InfinitePay API key not configured. Please add the INFINITEPAY_API_KEY secret." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
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

    const { amount, order_id, items } = parsed.data;

    // InfinitePay Public Checkout API
    // Documentation: https://developers.infinitepay.io/docs/checkout
    const checkoutPayload = {
      amount,
      metadata: { order_id },
      is_visible: true,
      payment_methods: ["credit", "debit"],
      items: items.map((i) => ({
        description: i.name,
        quantity: i.quantity,
        amount: Math.round(i.unit_price * 100),
      })),
    };

    const response = await fetch("https://api.infinitepay.io/v2/checkout", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${INFINITEPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(checkoutPayload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`InfinitePay API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    // Save transaction reference in orders
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    if (data.transaction_nsu) {
      await supabase.from("orders").update({
        status: "payment_pending",
      }).eq("id", order_id);
    }

    return new Response(
      JSON.stringify({ checkout_url: data.checkout_url, transaction_nsu: data.transaction_nsu }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("InfinitePay error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
