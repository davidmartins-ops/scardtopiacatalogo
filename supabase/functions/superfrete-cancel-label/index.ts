// SuperFrete label cancellation / reversal (admin only).
// Cancels the shipment at SuperFrete (when possible) and clears the label
// fields of the order so a brand new label can be issued.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const USER_AGENT =
  "Spencers Cardtopia/1.0 (contato@spencerscardtopia.com.br)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = Deno.env.get("SUPERFRETE_TOKEN");
  const baseUrl =
    Deno.env.get("SUPERFRETE_BASE_URL") ?? "https://sandbox.superfrete.com";

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Authenticate caller and verify admin role
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const jwt = authHeader.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(jwt);
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", claimsData.claims.sub)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden" }, 403);

  let orderId = "";
  let reason = "";
  let force = false;
  try {
    const body = await req.json();
    orderId = String(body.orderId ?? "");
    reason = String(body.reason ?? "Etiqueta gerada incorretamente");
    force = Boolean(body.force ?? false);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!orderId) return json({ error: "orderId é obrigatório" }, 400);

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, superfrete_order_id, shipping_label_status, tracking_code, shipping_label_url")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) return json({ error: "Pedido não encontrado" }, 404);

  const sfId = order.superfrete_order_id as string | null;
  if (!sfId && !order.tracking_code && !order.shipping_label_url) {
    return json({ error: "Este pedido não possui etiqueta emitida." }, 400);
  }

  let providerCanceled = false;
  let providerDetail: string | null = null;

  if (sfId && token) {
    try {
      const res = await fetch(`${baseUrl}/api/v0/order/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": USER_AGENT,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          order: { id: sfId, description: reason.slice(0, 200) },
        }),
      });
      const text = await res.text();
      console.log("SuperFrete cancel response", {
        status: res.status,
        contentType: res.headers.get("content-type"),
        bodyPreview: text.slice(0, 500),
      });
      providerCanceled = res.ok;
      providerDetail = text.slice(0, 400);
      if (!res.ok && !force) {
        return json({
          error:
            "A SuperFrete não permitiu cancelar esta etiqueta (pode já estar postada). " +
            "Use a opção de reverter apenas localmente se deseja emitir uma nova.",
          provider_status: res.status,
          detail: providerDetail,
          canForce: true,
        }, 409);
      }
    } catch (e) {
      providerDetail = e instanceof Error ? e.message : String(e);
      if (!force) {
        return json({
          error: "Falha de comunicação com a SuperFrete.",
          detail: providerDetail,
          canForce: true,
        }, 502);
      }
    }
  }

  // Reset label fields so a new label can be issued
  const { error: updErr } = await admin
    .from("orders")
    .update({
      superfrete_order_id: null,
      shipping_label_url: null,
      shipping_label_status: "canceled",
      shipping_label_issued_at: null,
      shipping_label_issued_by: null,
      shipping_label_last_synced_at: new Date().toISOString(),
      tracking_code: null,
    })
    .eq("id", orderId);
  if (updErr) return json({ error: updErr.message }, 500);

  await admin.from("shipping_label_events").insert({
    order_id: orderId,
    event_type: "canceled",
    status: "canceled",
    tracking_code: null,
    label_url: null,
    actor_id: claimsData.claims.sub,
    actor_email: (claimsData.claims as { email?: string }).email ?? null,
    source: "admin_ui",
    metadata: {
      reason,
      previous_superfrete_order_id: sfId,
      previous_tracking_code: order.tracking_code,
      provider_canceled: providerCanceled,
      forced: force,
      provider_detail: providerDetail,
    },
  });

  return json({
    success: true,
    providerCanceled,
    forced: force,
    status: "canceled",
  });
});
