import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyOrders from "./tools/list-my-orders";
import getMyOrder from "./tools/get-my-order";
import listMyDecks from "./tools/list-my-decks";
import listMyFavorites from "./tools/list-my-favorites";
import searchCatalog from "./tools/search-catalog";

// The OAuth issuer MUST be the direct Supabase host, derived from the project
// ref (not from SUPABASE_URL, which may be a proxy). VITE_SUPABASE_PROJECT_ID
// is inlined by Vite at build time so this stays import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "spencers-cardtopia-mcp",
  title: "Spencer's Cardtopia",
  version: "0.1.0",
  instructions:
    "Tools for Spencer's Cardtopia (Magic: The Gathering store). Use `search_catalog` to look up available cards; `list_my_orders` and `get_my_order` to inspect the signed-in customer's orders; `list_my_decks` to read their saved decks; `list_my_favorites` to see favorited cards.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchCatalog,
    listMyOrders,
    getMyOrder,
    listMyDecks,
    listMyFavorites,
  ],
});
