import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  special_order_id: z.string().uuid(),
  item_id: z.string().uuid().optional(),
  quoted_price: z.number().positive(),
  estimated_days: z.number().int().positive().optional(),
  expires_at: z.string().datetime().optional(),
  admin_notes: z.string().max(2000).optional(),
});

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

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
  if (!await isAdmin(admin, userId)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { special_order_id, item_id, quoted_price, estimated_days, expires_at, admin_notes } = parsed.data;

    const { data: order, error: orderErr } = await admin
      .from("special_orders")
      .select("id, status, user_id, total")
      .eq("id", special_order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Encomenda não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["requested", "quoted"].includes(order.status)) {
      return new Response(JSON.stringify({ error: "Status não permite cotação" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: item, error: itemErr } = item_id
      ? await admin.from("special_order_items").select("*").eq("id", item_id).maybeSingle()
      : { data: null, error: null };
    if (itemErr) {
      return new Response(JSON.stringify({ error: "Item não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: quote, error: quoteErr } = await admin
      .from("special_order_quotes")
      .insert({
        special_order_id,
        item_id: item?.id ?? null,
        quoted_price,
        estimated_days: estimated_days ?? null,
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        admin_notes: admin_notes ?? null,
      })
      .select()
      .single();
    if (quoteErr || !quote) {
      console.error("quote insert error", quoteErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar cotação" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update item price if quoted for a specific item
    if (item) {
      const totalPrice = quoted_price * item.quantity;
      await admin
        .from("special_order_items")
        .update({ unit_price: quoted_price, total_price: totalPrice, item_type: "fixed_price" })
        .eq("id", item.id);
    }

    // Recalculate total and update order status
    const { data: items } = await admin
      .from("special_order_items")
      .select("total_price")
      .eq("special_order_id", special_order_id);
    const newTotal = (items ?? []).reduce((s: number, i: any) => s + Number(i.total_price), 0);

    await admin
      .from("special_orders")
      .update({ status: "quoted", total: newTotal })
      .eq("id", special_order_id);

    // Audit log
    await admin.from("special_order_audit_log").insert({
      actor_id: userId,
      action: "quote_created",
      special_order_id,
      metadata: { quote_id: quote.id, quoted_price, estimated_days },
    });

    return new Response(
      JSON.stringify({ success: true, quote_id: quote.id, total: newTotal }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("special-order-quote error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
