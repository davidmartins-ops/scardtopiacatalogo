import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAID_STATUSES = ["payment_confirmed", "preparing", "shipped", "delivered"];

// Current date in America/Sao_Paulo as YYYY-MM-DD
const saoPauloDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let force = false;
    try {
      const body = await req.json();
      force = Boolean(body?.force);
    } catch (_) { /* no body */ }

    const day = saoPauloDate();
    const dateLabel = day.split("-").reverse().join("/");

    // Skip if the day is already closed
    const { data: closure } = await supabase
      .from("cash_closures")
      .select("id")
      .eq("closure_date", day)
      .maybeSingle();

    if (closure && !force) {
      return new Response(JSON.stringify({ skipped: "already_closed", day }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Orders of the day that need reconciling (UTC window covering BRT day)
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, status, created_at")
      .in("status", PAID_STATUSES)
      .gte("created_at", `${day}T00:00:00-03:00`)
      .lte("created_at", `${day}T23:59:59-03:00`);

    const dayOrders = (orders ?? []).filter((o) => saoPauloDate(new Date(o.created_at)) === day);

    if (dayOrders.length === 0 && !force) {
      return new Response(JSON.stringify({ skipped: "no_orders", day }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalExpected = dayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);

    let totalReceived = 0;
    let reconciledIds = new Set<string>();
    if (dayOrders.length > 0) {
      const { data: recs } = await supabase
        .from("payment_reconciliation")
        .select("order_id, received_amount")
        .in("order_id", dayOrders.map((o) => o.id));
      (recs ?? []).forEach((r) => {
        totalReceived += Number(r.received_amount ?? 0);
        reconciledIds.add(r.order_id);
      });
    }

    const divergence = +(totalReceived - totalExpected).toFixed(2);
    const pendingCount = dayOrders.filter((o) => !reconciledIds.has(o.id)).length;

    // Resolve admin emails
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((roleRows ?? []).map((r) => r.user_id));

    const emails: string[] = [];
    for (const id of adminIds) {
      const { data: u } = await supabase.auth.admin.getUserById(id);
      if (u?.user?.email) emails.push(u.user.email);
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ skipped: "no_admin_emails", day }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateData = {
      dateLabel,
      totalOrders: dayOrders.length,
      totalExpected: +totalExpected.toFixed(2),
      totalReceived: +totalReceived.toFixed(2),
      divergence,
      pendingCount,
    };

    let sent = 0;
    for (const email of emails) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          templateName: "cash-closure-reminder",
          recipientEmail: email,
          idempotencyKey: `cash-closure-${day}-${email}`,
          templateData,
        }),
      });
      if (res.ok) sent += 1;
      else console.error("cash closure email failed", email, res.status, await res.text());
    }

    // Also surface in the admin notifications panel
    await supabase.from("admin_notifications").insert({
      type: "system",
      title: "Fechamento de caixa pendente",
      message: `${dateLabel} — ${dayOrders.length} pedido(s), divergência R$ ${divergence.toFixed(2)}`,
      link: "/admin/reconciliacao",
      entity_type: "cash_closure",
      entity_id: day,
      metadata: templateData,
    });

    return new Response(JSON.stringify({ day, sent, ...templateData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("daily-cash-closure-reminder error", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
