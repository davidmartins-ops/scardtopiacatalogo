import type { InventoryItem } from "@/data/inventory";

/** Um produto está disponível quando a quantidade é maior que zero. */
export const isInStock = (item: { quantity?: number | null } | undefined): boolean =>
  (item?.quantity ?? 0) > 0;

/**
 * Coloca os produtos com estoque na frente, mantendo a ordem relativa dos demais.
 * Usado em toda área de destaque: sugestões, banners, promoções e grade do catálogo.
 */
export const prioritizeInStock = <T extends { quantity?: number | null }>(items: T[]): T[] =>
  [...items].sort((a, b) => Number(isInStock(b)) - Number(isInStock(a)));

/** Pontuação usada para ordenar conteúdo que aponta para um produto (ex.: banners). */
export const stockScoreFor = (
  inventory: InventoryItem[],
  inventoryItemId?: string | null,
): number => {
  if (!inventoryItemId) return 0;
  const item = inventory.find((i) => i.id === inventoryItemId);
  if (!item) return 0;
  return isInStock(item) ? 1 : -1;
};
