import type { ElementType } from "react";
import { Circle, Rainbow, Sparkles } from "lucide-react";

export interface FinishMeta {
  label: string;
  icon: ElementType;
  className: string;
  textClass: string;
}

/**
 * Single source of truth for the card finish (foil / non-foil / special foils).
 * The value comes from `inventory.description` and is copied into each order
 * item when the order is created, so order records can show it without a join.
 */
export const FINISH_META: Record<string, FinishMeta> = {
  Foil: { label: "Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30", textClass: "text-foil" },
  "Non-Foil": { label: "Non-Foil", icon: Circle, className: "bg-non-foil/15 text-non-foil border-non-foil/30", textClass: "text-non-foil" },
  "Foil e Non-Foil": { label: "Foil e Non-Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30", textClass: "text-rainbow" },
  "Surge Foil": { label: "Surge Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30", textClass: "text-foil" },
  "Rainbow Foil": { label: "Rainbow Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30", textClass: "text-rainbow" },
  "Holo Foil": { label: "Holo Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30", textClass: "text-foil" },
  "Galaxy Foil": { label: "Galaxy Foil", icon: Rainbow, className: "bg-rainbow/15 text-rainbow border-rainbow/30", textClass: "text-rainbow" },
  "Confetti Foil": { label: "Confetti Foil", icon: Sparkles, className: "bg-accent/15 text-accent border-accent/30", textClass: "text-accent" },
  "Etched Foil": { label: "Etched Foil", icon: Sparkles, className: "bg-foil/15 text-foil border-foil/30", textClass: "text-foil" },
  "Silver Scroll": { label: "Silver Scroll", icon: Sparkles, className: "bg-muted/40 text-foreground border-border", textClass: "text-foreground" },
};

export const finishMeta = (value?: string | null): FinishMeta | undefined =>
  value ? FINISH_META[value.trim()] : undefined;

/** Plain-text finish label, for CSV/XML exports and compact rows. */
export const finishLabel = (value?: string | null): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  return finishMeta(raw)?.label ?? raw;
};
