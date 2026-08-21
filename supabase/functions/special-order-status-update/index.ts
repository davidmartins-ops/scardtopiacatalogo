import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const StatusSchema = z.enum([
  "requested", "quoted", "approved", "paid", "ordered", "received", "shipped", "delivered", "cancelled",
]);

const BodySchema = z.object({
  special_order_id: z.string().uuid(),
  status: StatusSchema,
  note: z.string().max(2000).optional(),
  paid_amount: z.number().nonnegative().optional(),
  tracking_code: z.string().max(100).optional(),
  shipping_label_url: z.string().url().optional(),
  shipping_cost: z.number().nonnegative().optional(),
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
    const { special_order_id, status, note, paid_amount, tracking_code, shipping_label_url, shipping_cost } = parsed.data;

    const { data: order, error: orderErr } = await admin
      .from("special_orders")
      .select("*")
      .eq("id", special_order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Encomenda não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: any = { status };
    if (paid_amount !== undefined) {
      update.paid_amount = paid_amount;
      update.paid_at = new Date().toISOString();
    }
    if (tracking_code !== undefined) update.tracking_code = tracking_code;
    if (shipping_label_url !== undefined) update.shipping_label_url = shipping_label_url;
    if (shipping_cost !== undefined) {
      update.shipping_cost = shipping_cost;
      update.total = Number(order.total) + shipping_cost;
    }

    const { error: updateErr } = await admin
      .from("special_orders")
      .update(update)
      .eq("id", special_order_id);
    if (updateErr) {
      console.error("special order status update error", updateErr);
      return new Response(JSON.stringify({ error: "Erro ao atualizar encomenda" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log
    await admin.from("special_order_audit_log").insert({
      actor_id: userId,
      action: "status_updated",
      special_order_id,
      metadata: { from_status: order.status, to_status: status, note, paid_amount, shipping_cost },
    });

    // Customer status email (never blocks the update)
    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-special-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ special_order_id, status, note: note ?? null }),
      });
    } catch (e) {
      console.error("special order status email failed", e);
    }

    // Auto-generate shipping label when item arrives and order is paid
    if (status === "received" && order.status === "paid" && !order.superfrete_order_id) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/superfrete-create-label`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ orderId: special_order_id, source: "special_order" }),
        });
      } catch (e) {
        console.error("auto label for special order failed", e);
      }
    }


    return new Response(
      JSON.stringify({ success: true, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("special-order-status-update error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
