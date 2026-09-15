import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  special_order_id: z.string().uuid(),
  quote_id: z.string().uuid().optional(),
  accept: z.boolean(),
  customer_response: z.string().max(2000).optional(),
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
    const { special_order_id, quote_id, accept, customer_response } = parsed.data;

    const { data: order, error: orderErr } = await admin
      .from("special_orders")
      .select("id, user_id, status")
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
    if (order.status !== "quoted") {
      return new Response(JSON.stringify({ error: "A encomenda não possui cotação pendente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accept) {
      await admin
        .from("special_orders")
        .update({ status: "cancelled" })
        .eq("id", special_order_id);
      if (quote_id) {
        await admin
          .from("special_order_quotes")
          .update({ customer_response: customer_response ?? "Recusado pelo cliente", responded_at: new Date().toISOString() })
          .eq("id", quote_id);
      }
      return new Response(
        JSON.stringify({ success: true, status: "cancelled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (quote_id) {
      await admin
        .from("special_order_quotes")
        .update({ customer_response: customer_response ?? "Aprovado pelo cliente", responded_at: new Date().toISOString() })
        .eq("id", quote_id);
    }

    // Ao aprovar, o preço cotado passa a ser o total da encomenda. Sem isso o
    // total fica R$ 0,00 e o checkout falha com "Invalid order total".
    let quoteQuery = admin
      .from("special_order_quotes")
      .select("id, quoted_price")
      .eq("special_order_id", special_order_id);
    quoteQuery = quote_id
      ? quoteQuery.eq("id", quote_id)
      : quoteQuery.order("created_at", { ascending: false }).limit(1);
    const { data: quoteRows } = await quoteQuery;
    const quotedPrice = Number(quoteRows?.[0]?.quoted_price ?? 0);

    const orderUpdate: Record<string, unknown> = { status: "approved" };
    if (Number.isFinite(quotedPrice) && quotedPrice > 0) {
      orderUpdate.total = quotedPrice;

      // Itens "sob cotação" ainda sem preço recebem o valor cotado (rateado).
      const { data: quotationItems } = await admin
        .from("special_order_items")
        .select("id, quantity, unit_price")
        .eq("special_order_id", special_order_id)
        .eq("item_type", "quotation");
      const pending = (quotationItems ?? []).filter((i: any) => !Number(i.unit_price));
      if (pending.length > 0) {
        const share = quotedPrice / pending.length;
        for (const item of pending) {
          const qty = Number(item.quantity) || 1;
          await admin
            .from("special_order_items")
            .update({ unit_price: share / qty, total_price: share })
            .eq("id", item.id);
        }
      }
    }

    await admin
      .from("special_orders")
      .update(orderUpdate)
      .eq("id", special_order_id);

    return new Response(
      JSON.stringify({ success: true, status: "approved" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("special-order-approve error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
