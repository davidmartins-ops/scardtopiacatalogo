import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "search_catalog",
  title: "Search Spencer's Cardtopia catalog",
  description:
    "Search available Magic: The Gathering singles and drops in Spencer's Cardtopia catalog by name. Returns id, name, price, PIX price, discount, quantity in stock and product type.",
  inputSchema: {
    query: z.string().describe("Text to match against the card/product name."),
    limit: z
      .number()
      .int()
      .describe("Max number of results (default 20, max 50).")
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, limit }, ctx) => {
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    const trimmed = query.trim();
    if (!trimmed) {
      return { content: [{ type: "text", text: "Empty query" }], isError: true };
    }
    const escaped = trimmed.replace(/[%,]/g, " ");
    const { data, error } = await supabaseForUser(ctx)
      .from("inventory")
      .select("id,name,price,price_pix,discount,quantity,product_type,category")
      .ilike("name", `%${escaped}%`)
      .gt("quantity", 0)
      .order("name", { ascending: true })
      .limit(take);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
