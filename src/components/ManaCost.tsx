import { cn } from "@/lib/utils";

/**
 * Visual MTG mana symbol renderer.
 * - Simple tokens: {W} {U} {B} {R} {G} {C} {0} {N}
 * - Hybrid tokens: {R/G} {W/U} {2/W} — rendered as bipartite circle
 * - Unknown tokens: neutral fallback with raw text + dev log
 */

const HEX: Record<string, string> = {
  W: "#fffbd5",
  U: "#0e68ab",
  B: "#150b00",
  R: "#d3202a",
  G: "#00733e",
  C: "#ccc2c0",
  S: "#cac5c0",
};

const TEXT_ON: Record<string, string> = {
  W: "#1a1a1a",
  U: "#ffffff",
  B: "#ffffff",
  R: "#ffffff",
  G: "#ffffff",
  C: "#1a1a1a",
  S: "#1a1a1a",
};

const BORDER_FOR: Record<string, string> = {
  W: "#bfb88a",
  U: "#0a4f80",
  B: "#000000",
  R: "#9b1620",
  G: "#00532b",
  C: "#999999",
  S: "#999999",
};

const isGeneric = (token: string) => /^\d+$/.test(token);

const baseCls =
  "inline-flex items-center justify-center align-middle rounded-full border text-[10px] font-bold leading-none w-5 h-5 shrink-0 shadow-sm select-none";

const SimpleSymbol = ({ letter }: { letter: string }) => {
  const bg = HEX[letter] ?? "#ccc2c0";
  const fg = TEXT_ON[letter] ?? "#1a1a1a";
  const bd = BORDER_FOR[letter] ?? "#999";
  return (
    <span
      className={baseCls}
      style={{ background: bg, color: fg, borderColor: bd }}
      title={`{${letter}}`}
      aria-label={`mana ${letter}`}
    >
      {letter}
    </span>
  );
};

const GenericSymbol = ({ value }: { value: string }) => (
  <span
    className={baseCls}
    style={{ background: HEX.C, color: "#1a1a1a", borderColor: BORDER_FOR.C }}
    title={`{${value}}`}
    aria-label={`generic ${value}`}
  >
    {value}
  </span>
);

const HybridSymbol = ({ a, b }: { a: string; b: string }) => {
  const colorA = HEX[a] ?? (isGeneric(a) ? HEX.C : "#ccc2c0");
  const colorB = HEX[b] ?? (isGeneric(b) ? HEX.C : "#ccc2c0");
  return (
    <span
      className={cn(baseCls, "relative overflow-hidden p-0")}
      style={{ borderColor: "#555", background: colorB }}
      title={`{${a}/${b}}`}
      aria-label={`hybrid mana ${a} or ${b}`}
    >
      {/* Top-left half */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: colorA,
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
      />
      {/* Diagonal divider */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, transparent calc(50% - 0.5px), #555 calc(50% - 0.5px), #555 calc(50% + 0.5px), transparent calc(50% + 0.5px))",
        }}
      />
      <span className="relative z-10 text-[8px]" style={{ color: TEXT_ON[a] ?? "#1a1a1a" }}>{a}</span>
      <span className="relative z-10 text-[8px] ml-[1px]" style={{ color: TEXT_ON[b] ?? "#1a1a1a" }}>{b}</span>
    </span>
  );
};

const FallbackSymbol = ({ raw }: { raw: string }) => {
  if (typeof window !== "undefined" && process?.env?.NODE_ENV !== "production") {
    console.debug("[ManaCost] unmapped token:", raw);
  }
  return (
    <span
      className={cn(baseCls, "bg-muted text-foreground border-border px-1 w-auto min-w-5")}
      title={raw}
    >
      {raw.replace(/[{}]/g, "")}
    </span>
  );
};

const Symbol = ({ token }: { token: string }) => {
  const t = token.replace(/[{}]/g, "").toUpperCase();

  if (t.includes("/")) {
    const [a, b] = t.split("/");
    if (a && b) return <HybridSymbol a={a} b={b} />;
  }

  if (isGeneric(t)) return <GenericSymbol value={t} />;
  if (HEX[t]) return <SimpleSymbol letter={t} />;
  if (t === "X" || t === "Y" || t === "Z") return <GenericSymbol value={t} />;

  return <FallbackSymbol raw={token} />;
};

export const ManaCost = ({ cost, className }: { cost: string; className?: string }) => {
  if (!cost) return null;
  const tokens = cost.match(/\{[^}]+\}/g) ?? [];
  if (tokens.length === 0) return <span className={className}>{cost}</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {tokens.map((tok, i) => (
        <Symbol key={i} token={tok} />
      ))}
    </span>
  );
};

export default ManaCost;
