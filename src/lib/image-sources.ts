/**
 * Build modern format variants (AVIF/WebP) for a given image URL, when possible.
 *
 * For Supabase Storage public URLs we can rewrite to the render endpoint and
 * request a specific output format. For anything else we return only the original
 * URL — the <picture> element will fall back to it gracefully.
 */
export type ImageVariant = { type: string; src: string };

const SUPABASE_PUBLIC = "/storage/v1/object/public/";
const SUPABASE_RENDER = "/storage/v1/render/image/public/";

const withFormat = (url: string, format: "avif" | "webp"): string | null => {
  if (!url.includes(SUPABASE_PUBLIC)) return null;
  const rendered = url.replace(SUPABASE_PUBLIC, SUPABASE_RENDER);
  const sep = rendered.includes("?") ? "&" : "?";
  return `${rendered}${sep}format=${format}&quality=80`;
};

export const buildImageVariants = (src: string | null | undefined): ImageVariant[] => {
  if (!src) return [];
  const avif = withFormat(src, "avif");
  const webp = withFormat(src, "webp");
  const variants: ImageVariant[] = [];
  if (avif) variants.push({ type: "image/avif", src: avif });
  if (webp) variants.push({ type: "image/webp", src: webp });
  return variants;
};
