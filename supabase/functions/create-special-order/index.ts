import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  source: z.enum(["customer_request", "catalog_fixed"]).default("customer_request"),
  items: z.array(
    z.object({
      item_type: z.enum(["fixed_price", "quotation"]).default("quotation"),
      product_id: z.string().uuid().optional(),
      variant_id: z.string().uuid().optional(),
      name: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      quantity: z.number().int().positive().default(1),
      unit_price: z.number().nonnegative().default(0),
      reference_links: z.array(z.string().url()).optional(),
      reference_image_url: z.string().url().optional(),
    })
  ).min(1),
  customer_info: z.record(z.any()).default({}),
  shipping_address: z.record(z.any()).optional(),
  notes: z.string().max(2000).optional(),
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

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { source, items, customer_info, shipping_address, notes } = parsed.data;

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate fixed-price products and compute totals
    let total = 0;
    const normalizedItems = [];
    for (const item of items) {
      let product = null;
      if (item.product_id) {
        const { data, error } = await admin
          .from("special_order_products")
          .select("*")
          .eq("id", item.product_id)
          .eq("is_active", true)
          .maybeSingle();
        if (error || !data) {
          return new Response(
            JSON.stringify({ error: `Produto de encomenda não encontrado: ${item.product_id}` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        product = data;
      }

      let variant = null;
      if (item.variant_id) {
        const { data, error } = await admin
          .from("special_order_product_variants")
          .select("*")
          .eq("id", item.variant_id)
          .eq("is_active", true)
          .maybeSingle();
        if (error || !data) {
          return new Response(
            JSON.stringify({ error: `Variação não encontrada: ${item.variant_id}` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        variant = data;
      }

      const unitPrice = item.item_type === "fixed_price"
        ? (variant ? Number(variant.price) : product ? Number(product.price) : Number(item.unit_price || 0))
        : Number(item.unit_price || 0);
      const totalPrice = unitPrice * item.quantity;
      total += totalPrice;

      normalizedItems.push({
        item_type: item.item_type,
        product_id: item.product_id ?? null,
        name: product
          ? `${product.name}${variant ? ` — ${variant.label}` : ""}`
          : item.name,
        description: [item.description, variant?.sku ? `SKU: ${variant.sku}` : null]
          .filter(Boolean).join("\n") || product?.description || null,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        reference_links: item.reference_links ?? null,
        reference_image_url: item.reference_image_url ?? null,
      });
    }

    // Determine initial status: fixed-only orders can be quoted/approved immediately, mixed goes to requested
    const hasQuotation = normalizedItems.some((i) => i.item_type === "quotation");
    // Fixed-price-only orders need no quotation step: they go straight to
    // "approved" so the customer can pay immediately.
    const initialStatus = hasQuotation ? "requested" : "approved";

    const { data: order, error: orderErr } = await admin
      .from("special_orders")
      .insert({
        user_id: userId,
        status: initialStatus,
        source,
        customer_info,
        shipping_address: shipping_address ?? null,
        total,
        notes: notes ?? null,
      })
      .select()
      .single();
    if (orderErr || !order) {
      console.error("create special order error", orderErr);
      return new Response(
        JSON.stringify({ error: "Erro ao criar encomenda" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const itemsWithOrderId = normalizedItems.map((i) => ({
      ...i,
      special_order_id: order.id,
    }));
    const { error: itemsErr } = await admin.from("special_order_items").insert(itemsWithOrderId);
    if (itemsErr) {
      console.error("create special order items error", itemsErr);
      return new Response(
        JSON.stringify({ error: "Erro ao criar itens da encomenda" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Confirmation email to the customer (never blocks the request)
    try {
      const userRes = await admin.auth.admin.getUserById(userId);
      const email = userRes?.data?.user?.email;
      if (email) {
        await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            templateName: "special-order-received",
            recipientEmail: email,
            idempotencyKey: `special-order-received-${order.id}`,
            templateData: {
              orderId: order.id,
              customerName: (customer_info as any)?.name ?? (customer_info as any)?.full_name ?? "Cliente",
              total,
              notes: notes ?? null,
              items: normalizedItems.map((i) => {
                const desc = i.description ?? "";
                const skuMatch = desc.match(/SKU:\s*([^\n]+)/i);
                const parts = String(i.name).split(" — ");
                return {
                  name: parts[0],
                  variantLabel: parts.length > 1 ? parts.slice(1).join(" — ") : null,
                  sku: skuMatch ? skuMatch[1].trim() : null,
                  description: desc.replace(/SKU:\s*[^\n]+\n?/i, "").trim() || null,
                  item_type: i.item_type,
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                  total_price: i.total_price,
                };
              }),
            },
          }),
        });
      }
    } catch (e) {
      console.error("special order confirmation email failed", e);
    }

    return new Response(
      JSON.stringify({ id: order.id, status: order.status, total }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("create-special-order error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
