import type { InventoryItem } from "@/data/inventory";

const SITE_URL = "https://www.spencerscardtopia.com.br";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const getProductUrl = (item: Pick<InventoryItem, "id" | "product_type">) => {
  const type = item.product_type ?? "drop";
  return `${SITE_URL}/catalogo/${type === "single" ? "single" : "drop"}/${encodeURIComponent(item.id)}`;
};

export interface ShareTextOptions {
  /** Override URL (defaults to the product detail page). */
  url?: string;
}

const classificationHeader = (status?: string | null, quantity?: number) => {
  if (status === "launch") return "🔥 LANÇAMENTO";
  if (status === "pre_sale") return "📦 PRÉ-VENDA";
  if ((quantity ?? 0) <= 0) return "⚠️ ESGOTADO";
  return "🏷️ DISPONÍVEL";
};

const finishEmoji = (description?: string) => {
  if (!description) return "🎴";
  if (description.toLowerCase().includes("foil")) return "✨";
  return "🎴";
};

const languageEmoji = "🌎";
const conditionEmoji = "📦";

/** Build the rich share message used across catalog cards and product detail pages. */
export const buildShareMessage = (
  item: Pick<
    InventoryItem,
    "id" | "name" | "description" | "price" | "price_pix" | "discount" | "quantity" | "status" | "language" | "condition" | "product_type"
  >,
  opts: ShareTextOptions = {},
) => {
  const discount = item.discount ?? 0;
  const priceCard = item.price;
  const pixBase = (item.price_pix ?? 0) > 0 ? (item.price_pix as number) : item.price;
  const pricePix = Math.max(0, pixBase * (1 - discount / 100));

  const header = classificationHeader(item.status, item.quantity);
  const url = opts.url ?? getProductUrl(item);

  const priceLines: string[] = [];
  if (pricePix < priceCard) {
    priceLines.push(`💰 PIX: ${formatBRL(pricePix)}${discount > 0 ? ` (-${discount}%)` : ""}`);
    priceLines.push(`💳 Cartão: ${formatBRL(priceCard)}`);
  } else {
    priceLines.push(`💳 ${formatBRL(priceCard)}`);
  }

  const attrLines: string[] = [];
  if (item.description) attrLines.push(`${finishEmoji(item.description)} ${item.description}`);
  if (item.language) attrLines.push(`${languageEmoji} ${item.language}`);
  if (item.condition) attrLines.push(`${conditionEmoji} ${item.condition}`);

  const body = [
    header,
    "",
    `🎴 ${item.name}`,
    "",
    priceLines.join("\n"),
    "",
    attrLines.join("\n"),
    "",
    "🛒 Disponível na Spencer's Cardtopia",
    url,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return { text: body, url, title: item.name };
};

export type ShareMethod = "whatsapp" | "twitter" | "instagram" | "copy";

export const shareToChannel = async (
  item: Parameters<typeof buildShareMessage>[0],
  method: ShareMethod,
  opts: ShareTextOptions = {},
  toastFn?: (msg: string) => void,
) => {
  const { text, url, title } = buildShareMessage(item, opts);

  if (method === "copy") {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(text);
    toastFn?.("Link copiado!");
    return;
  }

  if (method === "whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  } else if (method === "twitter") {
    // Twitter prefers shorter text + url separate
    const shortText = `${item.name} — Spencer's Cardtopia`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}&url=${encodeURIComponent(url)}`,
      "_blank",
    );
  } else if (method === "instagram") {
    await navigator.clipboard.writeText(text);
    toastFn?.("Texto copiado! Cole no seu Instagram Stories");
    window.open("https://www.instagram.com/", "_blank");
  }
};
