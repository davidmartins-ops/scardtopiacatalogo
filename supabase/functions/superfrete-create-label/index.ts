// SuperFrete label generator (admin only).
// Flow: cart -> checkout -> fetch label info. Saves tracking_code,
// shipping_label_url and superfrete_order_id back into the order.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ORIGIN_CEP = Deno.env.get("SUPERFRETE_FROM_POSTAL_CODE") ?? "08710430";
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

  if (!token) {
    return new Response(
      JSON.stringify({ error: "SUPERFRETE_TOKEN não configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Authenticate caller and verify admin role
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jwt = authHeader.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(jwt);
  if (claimsErr || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", claimsData.claims.sub)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let orderId: string;
  let serviceId: number | undefined;
  let doCheckout: boolean;
  try {
    const body = await req.json();
    orderId = String(body.orderId ?? "");
    serviceId = body.serviceId != null ? Number(body.serviceId) : undefined;
    doCheckout = Boolean(body.checkout ?? true);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!orderId) {
    return new Response(JSON.stringify({ error: "orderId é obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) {
    return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const customer = (order.customer_info ?? {}) as Record<string, any>;
  const address = (customer.address ?? customer.shipping ?? customer) as Record<string, any>;
  const destCep = String(address.cep ?? address.postal_code ?? "").replace(/\D/g, "");
  if (destCep.length !== 8) {
    return new Response(
      JSON.stringify({ error: "Pedido sem CEP de entrega válido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const items = Array.isArray(order.items)
    ? order.items
    : (typeof order.items === "string" ? JSON.parse(order.items) : []);
  const itemCount = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) || 1;
  const useMini = itemCount <= 20;
  const pkg = useMini
    ? { weight: 0.1 + itemCount * 0.005, height: 2, width: 11, length: 16 }
    : { weight: 0.3 + itemCount * 0.005, height: 8, width: 13, length: 18 };

  // Pick service: provided or cheapest available
  let chosen = serviceId;
  if (!chosen) {
    const calcRes = await fetch(`${baseUrl}/api/v0/calculator`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: { postal_code: ORIGIN_CEP },
        to: { postal_code: destCep },
        services: "1,2,17",
        package: pkg,
      }),
    });
    const calcText = await calcRes.text();
    if (!calcRes.ok) {
      return new Response(JSON.stringify({ error: "Falha ao calcular frete", detail: calcText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const opts = JSON.parse(calcText).filter((o: any) => !o.error);
    opts.sort((a: any, b: any) => Number(a.price) - Number(b.price));
    chosen = opts[0]?.id;
  }
  if (!chosen) {
    return new Response(JSON.stringify({ error: "Nenhum serviço disponível" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build cart payload
  const cartBody = {
    service: chosen,
    from: {
      name: Deno.env.get("SUPERFRETE_FROM_NAME") ?? "Spencer's Cardtopia",
      address: Deno.env.get("SUPERFRETE_FROM_ADDRESS") ?? "",
      complement: Deno.env.get("SUPERFRETE_FROM_COMPLEMENT") ?? "",
      number: Deno.env.get("SUPERFRETE_FROM_NUMBER") ?? "",
      district: Deno.env.get("SUPERFRETE_FROM_DISTRICT") ?? "",
      city: Deno.env.get("SUPERFRETE_FROM_CITY") ?? "",
      state_abbr: Deno.env.get("SUPERFRETE_FROM_STATE") ?? "",
      country_id: "BR",
      postal_code: ORIGIN_CEP,
      email: Deno.env.get("SUPERFRETE_FROM_EMAIL") ?? undefined,
      phone: Deno.env.get("SUPERFRETE_FROM_PHONE") ?? undefined,
      document: Deno.env.get("SUPERFRETE_FROM_DOCUMENT") ?? undefined,
    },
    to: {
      name: customer.name ?? customer.full_name ?? "Cliente",
      email: customer.email ?? undefined,
      document: customer.cpf ?? customer.document ?? undefined,
      address: address.street ?? address.address ?? "",
      district: address.neighborhood ?? address.district ?? "",
      city: address.city ?? "",
      state_abbr: address.state ?? address.uf ?? "",
      postal_code: destCep,
      phone: customer.phone ?? undefined,
    },
    products: items.map((it: any) => ({
      name: it.name ?? it.description ?? "Carta",
      quantity: String(it.quantity ?? 1),
      unitary_value: String(it.unit_price ?? it.price ?? 1),
    })),
    volumes: [pkg],
    options: {
      insurance_value: 0,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: true,
    },
  };

  const cartRes = await fetch(`${baseUrl}/api/v0/cart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(cartBody),
  });
  const cartText = await cartRes.text();
  if (!cartRes.ok) {
    console.error("SuperFrete cart error", cartRes.status, cartText);
    return new Response(JSON.stringify({ error: "Falha ao criar envio", detail: cartText }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const cart = JSON.parse(cartText);
  const sfOrderId: string = cart.id;
  const shippingCost = Number(cart.price ?? cart.custom_price ?? 0);

  let trackingCode: string | null = null;
  let labelUrl: string | null = null;

  if (doCheckout) {
    // Checkout (debits SuperFrete balance and generates label)
    const checkoutRes = await fetch(`${baseUrl}/api/v0/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ orders: [sfOrderId] }),
    });
    const checkoutText = await checkoutRes.text();
    const checkoutCT = checkoutRes.headers.get("content-type") ?? "";
    const checkoutIsJson = checkoutCT.includes("application/json");
    console.log("SuperFrete checkout response", {
      status: checkoutRes.status,
      contentType: checkoutCT,
      bodyPreview: checkoutText.slice(0, 500),
    });

    if (!checkoutRes.ok) {
      // Parse best-effort error message
      let apiMessage = "";
      if (checkoutIsJson) {
        try {
          const j = JSON.parse(checkoutText);
          apiMessage = j.message ?? j.error ?? "";
        } catch { /* ignore */ }
      }
      const lower = (apiMessage + " " + checkoutText).toLowerCase();
      const insufficient =
        checkoutRes.status === 409 ||
        lower.includes("sem saldo") ||
        lower.includes("saldo") ||
        lower.includes("insufficient");

      if (insufficient) {
        console.error("SuperFrete insufficient balance", checkoutRes.status, apiMessage);
        return new Response(
          JSON.stringify({
            error: "Saldo insuficiente na carteira SuperFrete. Recarregue pelo app SuperFrete para gerar a etiqueta.",
            code: "insufficient_balance",
            provider_status: checkoutRes.status,
            provider_message: apiMessage || undefined,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Non-JSON (HTML) or other error — surface real detail without JSON.parse
      console.error("SuperFrete checkout error", checkoutRes.status, checkoutText.slice(0, 1000));
      return new Response(
        JSON.stringify({
          error: "Falha no checkout SuperFrete",
          provider_status: checkoutRes.status,
          provider_content_type: checkoutCT,
          provider_message: apiMessage || undefined,
          detail: checkoutIsJson ? undefined : checkoutText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!checkoutIsJson) {
      console.error("SuperFrete checkout returned non-JSON on 2xx", checkoutText.slice(0, 500));
      return new Response(
        JSON.stringify({
          error: "Resposta inesperada do SuperFrete (não-JSON)",
          provider_status: checkoutRes.status,
          provider_content_type: checkoutCT,
          detail: checkoutText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    try {
      const checkout = JSON.parse(checkoutText);
      const item = Array.isArray(checkout.purchase?.orders)
        ? checkout.purchase.orders[0]
        : checkout.orders?.[0] ?? checkout;
      trackingCode = item?.tracking ?? item?.protocol ?? null;
    } catch (e) {
      console.error("SuperFrete checkout JSON parse failed", e, checkoutText.slice(0, 500));
    }

    // Fetch label / order info to obtain print URL
    const infoRes = await fetch(`${baseUrl}/api/v0/order/${sfOrderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        accept: "application/json",
      },
    });
    const infoText = await infoRes.text();
    const infoCT = infoRes.headers.get("content-type") ?? "";
    console.log("SuperFrete order info response", {
      status: infoRes.status,
      contentType: infoCT,
      bodyPreview: infoText.slice(0, 300),
    });
    if (infoRes.ok && infoCT.includes("application/json")) {
      try {
        const info = JSON.parse(infoText);
        trackingCode = trackingCode ?? info.tracking ?? info.protocol ?? null;
        labelUrl = info.print_url ?? info.tag?.url ?? null;
      } catch (e) {
        console.error("SuperFrete order info parse failed", e);
      }
    }
  }




  // Determine new label status
  const isResend = !!order.superfrete_order_id;
  const eventType: "issued" | "resent" = isResend ? "resent" : "issued";
  const nowIso = new Date().toISOString();
  const newStatus = labelUrl || trackingCode ? "released" : (order.shipping_label_status ?? "pending");

  // Persist on the order
  await admin
    .from("orders")
    .update({
      tracking_code: trackingCode ?? order.tracking_code,
      shipping_label_url: labelUrl ?? order.shipping_label_url,
      shipping_cost: shippingCost || order.shipping_cost,
      superfrete_order_id: sfOrderId,
      shipping_label_status: newStatus,
      shipping_label_issued_at: order.shipping_label_issued_at ?? nowIso,
      shipping_label_issued_by: order.shipping_label_issued_by ?? claimsData.claims.sub,
      shipping_label_last_synced_at: nowIso,
    })
    .eq("id", orderId);

  // Audit event
  await admin.from("shipping_label_events").insert({
    order_id: orderId,
    event_type: eventType,
    status: newStatus,
    tracking_code: trackingCode,
    label_url: labelUrl,
    actor_id: claimsData.claims.sub,
    actor_email: (claimsData.claims as any).email ?? null,
    source: "admin_ui",
    metadata: {
      superfrete_order_id: sfOrderId,
      shipping_cost: shippingCost,
      service: chosen,
      checkout: doCheckout,
    },
  });

  return new Response(
    JSON.stringify({
      success: true,
      superfreteOrderId: sfOrderId,
      trackingCode,
      labelUrl,
      shippingCost,
      status: newStatus,
      resent: isResend,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

