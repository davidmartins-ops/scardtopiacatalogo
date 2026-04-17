const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FORMATS = ["standard", "modern", "commander", "legacy", "pauper"];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require service-role bearer (used by pg_cron) to prevent abuse
  const authHeader = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  if (authHeader !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().split("T")[0];
  let totalInserted = 0;

  try {
    for (const format of FORMATS) {
      // Fetch top 50 cards by price for this format
      const url = `https://api.scryfall.com/cards/search?order=usd&dir=desc&q=usd>0+f:${format}&unique=cards&page=1`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const cards = (data.data ?? []).slice(0, 50);

      const rows = cards.map((card: any) => ({
        card_name: card.name,
        scryfall_id: card.id,
        set_code: card.set,
        collector_number: card.collector_number,
        price_usd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
        price_usd_foil: card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null,
        format,
        captured_at: today,
      }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from("price_history")
          .upsert(rows, { onConflict: "scryfall_id,captured_at", ignoreDuplicates: true });

        if (!error) totalInserted += rows.length;
      }

      await delay(200); // Rate limit
    }

    return new Response(
      JSON.stringify({ success: true, inserted: totalInserted, date: today }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
