export const marketSearchUrl = (term: string) => {
  const name = term.trim().replace(/["\\]/g, " ");
  const params = new URLSearchParams({ q: `name:"${name}" game:paper`, unique: "prints", order: "usd", dir: "asc" });
  return `https://api.scryfall.com/cards/search?${params}`;
};

export const selectMarketCards = <T extends { name: string; prices: { usd?: string | null; usd_foil?: string | null } }>(cards: T[]): T[] => {
  const selected = new Map<string, T>();
  for (const card of cards) {
    const existing = selected.get(card.name);
    if (!existing || (!(existing.prices.usd ?? existing.prices.usd_foil) && (card.prices.usd ?? card.prices.usd_foil))) selected.set(card.name, card);
  }
  return [...selected.values()];
};

export const convertMarketPrice = (usd: string | undefined, rate: number | null): number | null => {
  if (usd == null || !rate || !Number.isFinite(rate) || rate <= 0) return null;
  const value = Number(usd);
  return Number.isFinite(value) && value >= 0 ? value * rate : null;
};