import type { CSSProperties } from "react";

/** Card photo framing stored in inventory.image_position: "center" | "X% Y%" | "X% Y% @Z" (Z = zoom, 0.5–3; below 1 zooms out). */
export interface ImageFraming { x: number; y: number; zoom: number }

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;

export function parseImageFraming(s?: string | null): ImageFraming {
  const out: ImageFraming = { x: 50, y: 50, zoom: 1 };
  if (!s || s === "center") return out;
  const m = s.match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (m) { out.x = Math.round(+m[1]); out.y = Math.round(+m[2]); }
  const z = s.match(/@\s*(\d+(?:\.\d+)?)/);
  if (z) out.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z[1]));
  return out;
}

export function serializeImageFraming({ x, y, zoom }: ImageFraming): string {
  const z = Math.round(zoom * 100) / 100;
  if (x === 50 && y === 50 && z === 1) return "center";
  return z === 1 ? `${x}% ${y}%` : `${x}% ${y}% @${z}`;
}

/** Inline style for an object-cover <img> inside an overflow-hidden frame. */
export function imageFramingStyle(s?: string | null): CSSProperties {
  const { x, y, zoom } = parseImageFraming(s);
  const pos = `${x}% ${y}%`;
  // Below 1x: show the whole photo uncropped (contain), growing toward the card size as zoom approaches 1.
  if (zoom < 1) {
    const k = Math.round(zoom * 2 * 100) / 100;
    return { objectFit: "contain", objectPosition: pos, transform: k === 1 ? undefined : `scale(${k})`, transformOrigin: pos };
  }
  return zoom === 1
    ? { objectPosition: pos }
    : { objectPosition: pos, transform: `scale(${zoom})`, transformOrigin: pos };
}
