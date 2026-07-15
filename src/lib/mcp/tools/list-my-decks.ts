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
  name: "list_my_decks",
  title: "List my decks",
  description:
    "List the signed-in customer's Magic: The Gathering decks saved on Spencer's Cardtopia.",
  inputSchema: {
    includeCards: z
      .boolean()
      .describe("If true, includes the deck's card list.")
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeCards }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = supabaseForUser(ctx);
    const select = includeCards
      ? "id,name,format,description,created_at,updated_at,deck_cards(card_name,quantity,is_sideboard)"
      : "id,name,format,description,created_at,updated_at";
    const { data, error } = await client
      .from("decks")
      .select(select)
      .eq("user_id", ctx.getUserId())
      .order("updated_at", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { decks: data ?? [] },
    };
  },
});
