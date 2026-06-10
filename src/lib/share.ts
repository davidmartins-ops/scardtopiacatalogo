import type { InventoryItem } from "@/data/inventory";

const SITE_URL = "https://www.spencerscardtopia.com.br";
// Edge function that returns OG-rich HTML so WhatsApp/Discord/Telegram/Facebook
// render the product image + name in the link preview (SPA can't, no SSR).
const SHARE_BASE = "https://uonzprmsnctldppgrcxo.supabase.co/functions/v1/share-product";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const getProductUrl = (item: Pick<InventoryItem, "id" | "product_type">) => {
  const type = item.product_type === "single" ? "single" : "drop";
  return `${SITE_URL}/catalogo/${type}/${encodeURIComponent(item.id)}`;
};

export const getShareUrl = (item: Pick<InventoryItem, "id" | "product_type">) => {
  const type = item.product_type === "single" ? "single" : "drop";
  return `${SHARE_BASE}/${type}/${encodeURIComponent(item.id)}`;
};

const tagFor = (status?: string | null, quantity?: number) => {
  if (status === "launch") return "LANÇAMENTO";
  if (status === "pre_sale") return "PRÉ-VENDA";
  if ((quantity ?? 0) <= 0) return "ESGOTADO";
  return null;
};

/** Short, scannable share message — preview thumbnail does the visual work. */
export const buildShareMessage = (
  item: Pick<
    InventoryItem,
    "id" | "name" | "description" | "price" | "price_pix" | "discount" | "quantity" | "status" | "language" | "condition" | "product_type"
  >,
) => {
  const discount = item.discount ?? 0;
  const cardPrice = item.price;
  const pixBase = (item.price_pix ?? 0) > 0 ? (item.price_pix as number) : item.price;
  const pixFinal = Math.max(0, pixBase * (1 - discount / 100));

  const tag = tagFor(item.status, item.quantity);
  const url = getShareUrl(item);

  const priceLine = pixFinal < cardPrice
    ? `PIX ${formatBRL(pixFinal)} | Cartão ${formatBRL(cardPrice)}`
    : formatBRL(cardPrice);

  const attrs = [item.description, item.language, item.condition].filter(Boolean).join(" · ");

  const lines = [
    tag ? `*${tag}* — ${item.name}` : `*${item.name}*`,
    priceLine,
    attrs,
    url,
  ].filter(Boolean);

  return { text: lines.join("\n"), url, title: item.name };
};

export type ShareMethod = "whatsapp" | "twitter" | "instagram" | "copy";

export const shareToChannel = async (
  item: Parameters<typeof buildShareMessage>[0],
  method: ShareMethod,
  _opts: Record<string, never> = {},
  toastFn?: (msg: string) => void,
) => {
  const { text, url, title } = buildShareMessage(item);

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
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(item.name)}&url=${encodeURIComponent(url)}`,
      "_blank",
    );
  } else if (method === "instagram") {
    await navigator.clipboard.writeText(text);
    toastFn?.("Texto copiado! Cole no seu Instagram Stories");
    window.open("https://www.instagram.com/", "_blank");
  }
};
