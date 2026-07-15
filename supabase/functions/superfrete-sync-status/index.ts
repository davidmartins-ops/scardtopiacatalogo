// SuperFrete status sync (admin only).
// Fetches the current tracking status for one or many orders from SuperFrete
// and updates orders.shipping_label_status + shipping_label_last_synced_at.
// Logs an entry in shipping_label_events when the status actually changes.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const USER_AGENT =
  "Spencers Cardtopia/1.0 (contato@spencerscardtopia.com.br)";

type SFStatus = "pending" | "released" | "posted" | "delivered" | "canceled" | "error";

// SuperFrete API returns various status strings; map to our enum.
function mapStatus(raw: string | null | undefined, hasTracking: boolean): SFStatus {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return hasTracking ? "released" : "pending";
  if (["delivered", "entregue"].includes(s)) return "delivered";
  if (["posted", "postado", "in_transit", "em_transito", "collected", "coletado"].includes(s)) return "posted";
  if (["released", "paid", "pago", "generated", "gerado", "created"].includes(s)) return "released";
  if (["canceled", "cancelled", "cancelado"].includes(s)) return "canceled";
  if (["error", "erro", "failed"].includes(s)) return "error";
  return hasTracking ? "released" : "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = Deno.env.get("SUPERFRETE_TOKEN");
  const baseUrl = Deno.env.get("SUPERFRETE_BASE_URL") ?? "https://sandbox.superfrete.com";

  if (!token) {
    return new Response(JSON.stringify({ error: "SUPERFRETE_TOKEN não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: allow either the cron (with service role) or an admin user.
  const authHeader = req.headers.get("Authorization") ?? "";
  const isCron = req.headers.get("Lovable-Context") === "cron";
  let actorId: string | null = null;
  let actorEmail: string | null = null;

  if (!isCron) {
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const jwt = authHeader.slice("Bearer ".length);
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(jwt);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    actorId = claimsData.claims.sub;
    actorEmail = (claimsData.claims as { email?: string }).email ?? null;
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  if (!isCron && actorId) {
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Parse body: { orderIds?: string[], orderId?: string }
  let orderIds: string[] = [];
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (Array.isArray(body.orderIds)) orderIds = body.orderIds.map((x: unknown) => String(x));
    if (typeof body.orderId === "string") orderIds.push(body.orderId);
  } catch { /* empty body → cron sweep */ }

  // Default (cron / empty): sweep all orders with a superfrete id that are not terminal.
  let query = admin
    .from("orders")
    .select("id, superfrete_order_id, shipping_label_status, tracking_code, shipping_label_url")
    .not("superfrete_order_id", "is", null)
    .not("shipping_label_status", "in", "(delivered,canceled)");
  if (orderIds.length > 0) query = query.in("id", orderIds);
  query = query.limit(50);

  const { data: rows, error: qErr } = await query;
  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ orderId: string; status: SFStatus; changed: boolean; error?: string }> = [];

  for (const row of rows ?? []) {
    if (!row.superfrete_order_id) continue;
    try {
      const infoRes = await fetch(`${baseUrl}/api/v0/order/${row.superfrete_order_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": USER_AGENT,
          accept: "application/json",
        },
      });
      const infoText = await infoRes.text();
      if (!infoRes.ok) {
        results.push({ orderId: row.id, status: row.shipping_label_status as SFStatus, changed: false, error: `SF ${infoRes.status}` });
        continue;
      }
      const info = JSON.parse(infoText);
      const rawStatus =
        info.status ?? info.tracking_status ?? info.state ?? (info.delivered_at ? "delivered" : info.posted_at ? "posted" : null);
      const tracking = info.tracking ?? info.protocol ?? row.tracking_code ?? null;
      const labelUrl = info.print_url ?? info.tag?.url ?? row.shipping_label_url ?? null;
      const mapped = mapStatus(rawStatus, !!tracking);
      const changed = mapped !== row.shipping_label_status;

      await admin
        .from("orders")
        .update({
          shipping_label_status: mapped,
          shipping_label_last_synced_at: new Date().toISOString(),
          tracking_code: tracking ?? undefined,
          shipping_label_url: labelUrl ?? undefined,
        })
        .eq("id", row.id);

      if (changed) {
        await admin.from("shipping_label_events").insert({
          order_id: row.id,
          event_type: "synced",
          status: mapped,
          tracking_code: tracking,
          label_url: labelUrl,
          actor_id: actorId,
          actor_email: actorEmail,
          source: isCron ? "cron" : "admin_ui",
          metadata: { raw_status: rawStatus, previous_status: row.shipping_label_status },
        });
      }

      results.push({ orderId: row.id, status: mapped, changed });
    } catch (e) {
      results.push({
        orderId: row.id,
        status: row.shipping_label_status as SFStatus,
        changed: false,
        error: (e as Error).message,
      });
    }
  }

  return new Response(JSON.stringify({ success: true, checked: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
