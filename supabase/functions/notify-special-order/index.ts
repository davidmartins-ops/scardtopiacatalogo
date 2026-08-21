import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const statusLabels: Record<string, string> = {
  requested: "Solicitada",
  quoted: "Cotada",
  approved: "Aprovada",
  paid: "Paga",
  ordered: "Encomendada",
  received: "Recebida",
  shipped: "Enviada",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { special_order_id, status, note } = await req.json();
    if (!special_order_id || !status) {
      return new Response(
        JSON.stringify({ error: "special_order_id and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: order, error: orderErr } = await admin
      .from("special_orders")
      .select("id, user_id, status, total, tracking_code, customer_info, items:special_order_items(name, description, quantity, unit_price, total_price, item_type)")
      .eq("id", special_order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: "Encomenda não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const user = await admin.auth.admin.getUserById(order.user_id);
    const customerEmail = user?.data?.user?.email;
    if (!customerEmail) {
      return new Response(
        JSON.stringify({ skipped: "no_customer_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const info = (order.customer_info ?? {}) as Record<string, any>;
    const items = (order.items ?? []).map((i: any) => {
      const desc: string = i.description ?? "";
      const skuMatch = desc.match(/SKU:\s*([^\n]+)/i);
      const nameParts = String(i.name ?? "").split(" — ");
      return {
        name: nameParts[0],
        variantLabel: nameParts.length > 1 ? nameParts.slice(1).join(" — ") : null,
        sku: skuMatch ? skuMatch[1].trim() : null,
        description: desc.replace(/SKU:\s*[^\n]+\n?/i, "").trim() || null,
        item_type: i.item_type,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
      };
    });

    const templateData = {
      orderId: order.id,
      customerName: info.name ?? info.full_name ?? "Cliente",
      statusLabel: statusLabels[status] ?? status,
      status,
      total: Number(order.total ?? 0),
      trackingCode: order.tracking_code ?? null,
      items,
      note: note ?? null,
    };


    const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        templateName: "special-order-status-update",
        recipientEmail: customerEmail,
        idempotencyKey: `special-order-status-${order.id}-${status}`,
        templateData,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("special-order email failed", customerEmail, res.status, text);
      return new Response(
        JSON.stringify({ error: "Email failed", detail: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("notify-special-order error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
