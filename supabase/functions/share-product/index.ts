// Public OG preview page for products. Crawlers (WhatsApp, Discord, Telegram, Facebook)
// don't execute JS, so the SPA's client-side <meta> doesn't reach them. This function
// returns a tiny HTML shell with proper OG tags and redirects real browsers to the SPA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE = "https://www.spencerscardtopia.com.br";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // URL shape: /functions/v1/share-product/:type/:id
    const segs = url.pathname.split("/").filter(Boolean);
    const idx = segs.indexOf("share-product");
    const type = segs[idx + 1] ?? url.searchParams.get("type") ?? "drop";
    const id = decodeURIComponent(segs[idx + 2] ?? url.searchParams.get("id") ?? "");

    if (!id) return new Response("Missing id", { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: item } = await supabase
      .from("inventory")
      .select("id, name, description, price, price_pix, discount, quantity, status, language, condition, image_url, product_type, drop_description, category")
      .eq("id", id)
      .maybeSingle();

    const target = `${SITE}/catalogo/${type === "single" ? "single" : "drop"}/${encodeURIComponent(id)}`;

    if (!item) {
      return new Response(
        `<!doctype html><meta http-equiv="refresh" content="0;url=${esc(target)}">`,
        { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...corsHeaders } },
      );
    }

    const discount = Number(item.discount ?? 0);
    const cardPrice = Number(item.price);
    const pixBase = Number(item.price_pix ?? 0) > 0 ? Number(item.price_pix) : cardPrice;
    const pixFinal = Math.max(0, pixBase * (1 - discount / 100));

    const tag =
      item.status === "launch" ? "LANÇAMENTO" :
      item.status === "pre_sale" ? "PRÉ-VENDA" :
      (item.quantity ?? 0) <= 0 ? "ESGOTADO" : "DISPONÍVEL";

    const attrs = [item.description, item.language, item.condition].filter(Boolean).join(" · ");
    const priceStr = pixFinal < cardPrice
      ? `PIX ${formatBRL(pixFinal)} · Cartão ${formatBRL(cardPrice)}`
      : formatBRL(cardPrice);

    const title = `${item.name} — ${tag}`;
    const description = `${priceStr}${attrs ? ` · ${attrs}` : ""}`;
    const image = item.image_url || `${SITE}/og-default.jpg`;

    const ua = req.headers.get("user-agent")?.toLowerCase() ?? "";
    const isBot = /bot|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|preview|crawler|spider/i.test(ua);

    const redirect = isBot
      ? "" // bots: don't redirect, let them parse our tags
      : `<meta http-equiv="refresh" content="0;url=${esc(target)}">
         <script>window.location.replace(${JSON.stringify(target)});</script>`;

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(target)}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="Spencer's Cardtopia" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(target)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:alt" content="${esc(item.name)}" />
<meta property="product:price:amount" content="${pixFinal.toFixed(2)}" />
<meta property="product:price:currency" content="BRL" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
${redirect}
</head>
<body>
<p>Redirecionando para <a href="${esc(target)}">${esc(item.name)}</a>…</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300",
        ...corsHeaders,
      },
    });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
