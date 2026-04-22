/**
 * Scryfall payload + image cache.
 * - payload cache: localStorage (TTL 7d)
 * - image quality detection: warns if only "normal" or lower is available
 * - centralized fetch with merge of PT translation + best image
 */

const PAYLOAD_TTL = 7 * 24 * 60 * 60 * 1000; // 7d
const KEY_PREFIX = "scryfall_card_v2:";

export interface ScryfallImageUris {
  png?: string;
  large?: string;
  normal?: string;
  border_crop?: string;
  small?: string;
  art_crop?: string;
}

export interface ScryfallCardData {
  name: string;
  printed_name?: string;
  mana_cost?: string;
  type_line?: string;
  printed_type_line?: string;
  oracle_text?: string;
  printed_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity?: string;
  set_name?: string;
  collector_number?: string;
  image_uris?: ScryfallImageUris;
  prices?: { usd?: string | null; usd_foil?: string | null };
  _imageQuality?: "high" | "medium" | "low" | "none";
}

const readCache = (key: string): ScryfallCardData | null => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > PAYLOAD_TTL) return null;
    return parsed.data as ScryfallCardData;
  } catch {
    return null;
  }
};

const writeCache = (key: string, data: ScryfallCardData) => {
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // quota exceeded — best-effort cleanup
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(KEY_PREFIX))
        .slice(0, 20)
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(KEY_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
  }
};

const detectImageQuality = (img?: ScryfallImageUris): ScryfallCardData["_imageQuality"] => {
  if (!img) return "none";
  if (img.png || img.large || img.border_crop) return "high";
  if (img.normal) return "medium";
  if (img.small) return "low";
  return "none";
};

const mergeBestImage = (a?: ScryfallImageUris, b?: ScryfallImageUris): ScryfallImageUris => ({
  png: a?.png || b?.png,
  large: a?.large || b?.large,
  border_crop: a?.border_crop || b?.border_crop,
  normal: a?.normal || b?.normal,
  small: a?.small || b?.small,
  art_crop: a?.art_crop || b?.art_crop,
});

const safeFetchJson = async (url: string): Promise<any | null> => {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
};

/**
 * Fetch a card by set + collector number. Tries PT-BR first for translated text,
 * merges with default for highest-resolution image. Caches result for 7 days.
 * Logs a warning if only low/medium-quality imagery is available.
 */
export const fetchScryfallCard = async (
  set: string,
  num: string,
  inventoryId?: string,
): Promise<ScryfallCardData | null> => {
  const key = `${set.toLowerCase()}-${num.toLowerCase()}`;

  const cached = readCache(key);
  if (cached) {
    // If cache has high-quality image, return immediately. Otherwise re-attempt.
    if (cached._imageQuality === "high") return cached;
  }

  const [pt, def] = await Promise.all([
    safeFetchJson(`https://api.scryfall.com/cards/${set}/${num}/pt`),
    safeFetchJson(`https://api.scryfall.com/cards/${set}/${num}`),
  ]);

  let base = pt || def || cached;
  if (!base) {
    console.warn(`[scryfall] No data found for ${key}`, { inventoryId });
    return null;
  }

  let bestImg = mergeBestImage(pt?.image_uris, def?.image_uris);
  let quality = detectImageQuality(bestImg);

  // Fallback: if quality is still not "high", try the card_faces (double-faced cards) or the prints_search_uri
  if (quality !== "high" && def?.card_faces?.[0]?.image_uris) {
    bestImg = mergeBestImage(bestImg, def.card_faces[0].image_uris);
    quality = detectImageQuality(bestImg);
  }
  if (quality !== "high" && pt?.card_faces?.[0]?.image_uris) {
    bestImg = mergeBestImage(bestImg, pt.card_faces[0].image_uris);
    quality = detectImageQuality(bestImg);
  }

  // Last-resort: fetch the alternative print listing and pick the first hi-res print
  if (quality !== "high") {
    const alt = await safeFetchJson(
      `https://api.scryfall.com/cards/search?q=set:${set}+number:${num}&unique=prints`,
    );
    const altCard = alt?.data?.find((c: any) => c?.image_uris?.png || c?.image_uris?.large);
    if (altCard?.image_uris) {
      bestImg = mergeBestImage(bestImg, altCard.image_uris);
      quality = detectImageQuality(bestImg);
    }
  }

  const merged: ScryfallCardData = { ...base, image_uris: bestImg, _imageQuality: quality };
  writeCache(key, merged);

  if (quality !== "high") {
    console.warn(
      `[scryfall] Low-quality image for ${key} (quality=${quality}). URIs available:`,
      Object.keys(bestImg || {}).filter((k) => (bestImg as any)[k]),
      { inventoryId },
    );
  }

  return merged;
};

/**
 * Pick the best available image URL from a Scryfall card payload.
 * Order: png > border_crop > large > normal > small.
 */
export const pickBestImageUrl = (img?: ScryfallImageUris, fallback?: string | null): string | null => {
  return img?.png || img?.border_crop || img?.large || img?.normal || img?.small || fallback || null;
};
