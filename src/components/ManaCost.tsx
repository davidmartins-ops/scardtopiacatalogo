import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  W: "bg-[#fffbd5] text-[#1a1a1a] border-[#bfb88a]",
  U: "bg-[#0e68ab] text-white border-[#0a4f80]",
  B: "bg-[#150b00] text-white border-[#000]",
  R: "bg-[#d3202a] text-white border-[#9b1620]",
  G: "bg-[#00733e] text-white border-[#00532b]",
  C: "bg-[#ccc2c0] text-[#1a1a1a] border-[#999]",
  "0": "bg-[#ccc2c0] text-[#1a1a1a] border-[#999]",
  S: "bg-[#cac5c0] text-[#1a1a1a] border-[#999]",
  X: "bg-[#ccc2c0] text-[#1a1a1a] border-[#999]",
  T: "bg-[#ccc2c0] text-[#1a1a1a] border-[#999]",
  Q: "bg-[#ccc2c0] text-[#1a1a1a] border-[#999]",
};

const HEX: Record<string, string> = {
  W: "#fffbd5",
  U: "#0e68ab",
  B: "#150b00",
  R: "#d3202a",
  G: "#00733e",
  C: "#ccc2c0",
};

const isGeneric = (token: string) => /^\d+$/.test(token);

const Symbol = ({ token }: { token: string }) => {
  const t = token.replace(/[{}]/g, "").toUpperCase();
  const baseCls =
    "inline-flex items-center justify-center align-middle rounded-full border text-[10px] font-bold leading-none w-5 h-5 shrink-0 shadow-sm";

  // Hybrid like R/G or 2/W
  if (t.includes("/")) {
    const [a, b] = t.split("/");
    const colorA = HEX[a] ?? "#ccc2c0";
    const colorB = HEX[b] ?? "#ccc2c0";
    return (
      <span
        className={cn(baseCls, "border-[#888]")}
        style={{
          background: `linear-gradient(135deg, ${colorA} 0 50%, ${colorB} 50% 100%)`,
          color: "#1a1a1a",
        }}
        title={`{${t}}`}
        aria-label={`mana ${t}`}
      >
        {a}/{b}
      </span>
    );
  }

  if (isGeneric(t)) {
    return (
      <span className={cn(baseCls, COLOR_MAP["0"])} title={`{${t}}`} aria-label={`generic ${t}`}>
        {t}
      </span>
    );
  }

  const cls = COLOR_MAP[t];
  if (!cls) {
    return (
      <span className={cn(baseCls, "bg-muted text-foreground border-border")} title={`{${t}}`}>
        {t}
      </span>
    );
  }
  return (
    <span className={cn(baseCls, cls)} title={`{${t}}`} aria-label={`mana ${t}`}>
      {t}
    </span>
  );
};

export const ManaCost = ({ cost, className }: { cost: string; className?: string }) => {
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
