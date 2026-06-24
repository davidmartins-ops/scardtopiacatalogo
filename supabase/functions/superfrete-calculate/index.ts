// SuperFrete shipping calculator
// Calls https://sandbox.superfrete.com/api/v0/calculator (or production)
// with origin CEP, destination CEP and package dimensions.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ORIGIN_CEP = "08710430";
const USER_AGENT =
  "Spencers Cardtopia/1.0 (contato@spencerscardtopia.com.br)";

interface SuperFreteOption {
  id: number;
  name: string;
  price: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  company?: { id: number; name: string; picture?: string };
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("SUPERFRETE_TOKEN");
    const baseUrl =
      Deno.env.get("SUPERFRETE_BASE_URL") ?? "https://sandbox.superfrete.com";

    if (!token) {
      return new Response(
        JSON.stringify({ error: "SUPERFRETE_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const destinationCep = String(body.cep ?? "").replace(/\D/g, "");
    const itemCount = Math.max(1, Number(body.itemCount ?? 1));

    if (destinationCep.length !== 8) {
      return new Response(JSON.stringify({ error: "CEP inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Smart package sizing: Mini Envios for small orders, small box otherwise.
    // SuperFrete minimums: weight 0.1kg, dims 16x11x2 cm.
    const useMini = itemCount <= 20;
    const pkg = useMini
      ? { weight: 0.1 + itemCount * 0.005, height: 2, width: 11, length: 16 }
      : { weight: 0.3 + itemCount * 0.005, height: 8, width: 13, length: 18 };

    const payload = {
      from: { postal_code: ORIGIN_CEP },
      to: { postal_code: destinationCep },
      services: "1,2,17", // 1=PAC, 2=SEDEX, 17=Mini Envios
      options: {
        own_hand: false,
        receipt: false,
        insurance_value: 0,
        use_insurance_value: false,
      },
      package: pkg,
    };

    const res = await fetch(`${baseUrl}/api/v0/calculator`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("SuperFrete calculator error", res.status, text);
      return new Response(
        JSON.stringify({ error: "Falha ao consultar SuperFrete", detail: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data: SuperFreteOption[] = JSON.parse(text);
    const options = data
      .filter((o) => !o.error && o.price != null)
      .map((o) => ({
        id: o.id,
        name: o.name,
        company: o.company?.name ?? "",
        price: Number(o.custom_price ?? o.price),
        deliveryDays:
          o.delivery_range
            ? `${o.delivery_range.min}-${o.delivery_range.max}`
            : o.delivery_time
              ? String(o.delivery_time)
              : "—",
      }));

    return new Response(JSON.stringify({ options, package: pkg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("superfrete-calculate exception", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
