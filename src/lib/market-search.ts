export const marketSearchUrl = (term: string) => {
  const name = term.trim().replace(/["\\]/g, " ");
  const params = new URLSearchParams({ q: `name:"${name}"`, unique: "cards", order: "name" });
  return `https://api.scryfall.com/cards/search?${params}`;
};

export const convertMarketPrice = (usd: string | undefined, rate: number | null): number | null => {
  if (usd == null || !rate || !Number.isFinite(rate) || rate <= 0) return null;
  const value = Number(usd);
  return Number.isFinite(value) && value >= 0 ? value * rate : null;
};