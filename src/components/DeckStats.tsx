import { useMemo, useState, useEffect } from "react";
import { type DeckCard } from "@/hooks/use-decks";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScryfallCardData {
  name: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  colors: string[];
  color_identity: string[];
}

const COLOR_MAP: Record<string, { label: string; hex: string }> = {
  W: { label: "Branco", hex: "hsl(45, 30%, 85%)" },
  U: { label: "Azul", hex: "hsl(210, 70%, 55%)" },
  B: { label: "Preto", hex: "hsl(270, 10%, 30%)" },
  R: { label: "Vermelho", hex: "hsl(0, 70%, 50%)" },
  G: { label: "Verde", hex: "hsl(130, 50%, 40%)" },
  C: { label: "Incolor", hex: "hsl(0, 0%, 60%)" },
  M: { label: "Multicolor", hex: "hsl(45, 80%, 50%)" },
};

const TYPE_CATEGORIES = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Land", "Other"];
const TYPE_COLORS = [
  "hsl(130, 50%, 40%)", "hsl(210, 70%, 55%)", "hsl(0, 70%, 50%)", "hsl(270, 50%, 45%)",
  "hsl(0, 0%, 55%)", "hsl(45, 80%, 50%)", "hsl(30, 40%, 50%)", "hsl(0, 0%, 40%)",
];

function extractCmc(manaCost: string): number {
  if (!manaCost) return 0;
  const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];
  let total = 0;
  for (const sym of symbols) {
    const val = sym.replace(/[{}]/g, "");
    if (/^\d+$/.test(val)) total += parseInt(val, 10);
    else if (val !== "X") total += 1;
  }
  return total;
}

function extractColors(manaCost: string): string[] {
  const colors: Set<string> = new Set();
  const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];
  for (const sym of symbols) {
    const val = sym.replace(/[{}]/g, "");
    if (val.includes("W")) colors.add("W");
    if (val.includes("U")) colors.add("U");
    if (val.includes("B")) colors.add("B");
    if (val.includes("R")) colors.add("R");
    if (val.includes("G")) colors.add("G");
  }
  return [...colors];
}

function categorizeType(typeLine: string): string {
  const lower = typeLine.toLowerCase();
  if (lower.includes("creature")) return "Creature";
  if (lower.includes("instant")) return "Instant";
  if (lower.includes("sorcery")) return "Sorcery";
  if (lower.includes("enchantment")) return "Enchantment";
  if (lower.includes("artifact")) return "Artifact";
  if (lower.includes("planeswalker")) return "Planeswalker";
  if (lower.includes("land")) return "Land";
  return "Other";
}

interface DeckStatsProps {
  cards: DeckCard[];
}

const DeckStats = ({ cards }: DeckStatsProps) => {
  const [cardData, setCardData] = useState<Record<string, ScryfallCardData>>({});
  const [loading, setLoading] = useState(false);

  const allCards = useMemo(() => cards.filter((c) => !c.is_sideboard), [cards]);

  // Fetch card data from Scryfall collection endpoint
  useEffect(() => {
    if (allCards.length === 0) return;

    const idsToFetch = allCards
      .filter((c) => c.scryfall_id && !cardData[c.scryfall_id])
      .map((c) => c.scryfall_id!)
      .filter((id, i, arr) => arr.indexOf(id) === i);

    if (idsToFetch.length === 0) return;

    setLoading(true);
    const fetchBatch = async () => {
      try {
        const res = await fetch("https://api.scryfall.com/cards/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: idsToFetch.map((id) => ({ id })) }),
        });
        if (res.ok) {
          const data = await res.json();
          const newData: Record<string, ScryfallCardData> = { ...cardData };
          for (const card of data.data ?? []) {
            newData[card.id] = {
              name: card.name,
              mana_cost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? "",
              cmc: card.cmc ?? 0,
              type_line: card.type_line ?? card.card_faces?.[0]?.type_line ?? "",
              colors: card.colors ?? [],
              color_identity: card.color_identity ?? [],
            };
          }
          setCardData(newData);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchBatch();
  }, [allCards]);

  // Mana curve
  const manaCurve = useMemo(() => {
    const curve: Record<number, number> = {};
    allCards.forEach((c) => {
      const data = c.scryfall_id ? cardData[c.scryfall_id] : null;
      if (!data) return;
      const type = categorizeType(data.type_line);
      if (type === "Land") return;
      const cmc = Math.min(Math.round(data.cmc), 7);
      curve[cmc] = (curve[cmc] ?? 0) + c.quantity;
    });
    return Array.from({ length: 8 }, (_, i) => ({ cmc: i === 7 ? "7+" : String(i), count: curve[i] ?? 0 }));
  }, [allCards, cardData]);

  // Color distribution
  const colorDist = useMemo(() => {
    const counts: Record<string, number> = {};
    allCards.forEach((c) => {
      const data = c.scryfall_id ? cardData[c.scryfall_id] : null;
      if (!data) return;
      const type = categorizeType(data.type_line);
      if (type === "Land") return;
      const colors = extractColors(data.mana_cost);
      if (colors.length === 0) {
        counts["C"] = (counts["C"] ?? 0) + c.quantity;
      } else if (colors.length > 1) {
        counts["M"] = (counts["M"] ?? 0) + c.quantity;
      } else {
        counts[colors[0]] = (counts[colors[0]] ?? 0) + c.quantity;
      }
    });
    return Object.entries(counts)
      .map(([color, value]) => ({ name: COLOR_MAP[color]?.label ?? color, value, color: COLOR_MAP[color]?.hex ?? "hsl(0,0%,50%)" }))
      .sort((a, b) => b.value - a.value);
  }, [allCards, cardData]);

  // Type distribution
  const typeDist = useMemo(() => {
    const counts: Record<string, number> = {};
    allCards.forEach((c) => {
      const data = c.scryfall_id ? cardData[c.scryfall_id] : null;
      if (!data) return;
      const type = categorizeType(data.type_line);
      counts[type] = (counts[type] ?? 0) + c.quantity;
    });
    return TYPE_CATEGORIES
      .map((type, i) => ({ name: type, value: counts[type] ?? 0, color: TYPE_COLORS[i] }))
      .filter((t) => t.value > 0);
  }, [allCards, cardData]);

  if (allCards.length === 0) return null;

  const hasData = Object.keys(cardData).length > 0;

  return (
    <div className="glass-card p-4 space-y-5">
      <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" /> Estatísticas
      </h3>

      {loading && !hasData ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Mana Curve */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Curva de Mana</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={manaCurve} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="cmc" tick={{ fontSize: 10, fill: "hsl(240, 5%, 55%)" }} axisLine={false} tickLine={false} />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(240, 10%, 12%)", border: "1px solid hsl(240, 8%, 20%)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "hsl(45, 20%, 90%)" }}
                  itemStyle={{ color: "hsl(45, 80%, 55%)" }}
                  formatter={(v: number) => [v, "Cartas"]}
                  labelFormatter={(l) => `CMC ${l}`}
                />
                <Bar dataKey="count" fill="hsl(45, 80%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Color + Type side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Cores</p>
              {colorDist.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={100}>
                    <PieChart>
                      <Pie data={colorDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={20} paddingAngle={2} strokeWidth={0}>
                        {colorDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(240, 10%, 12%)", border: "1px solid hsl(240, 8%, 20%)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number, name: string) => [v, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {colorDist.map((c) => (
                      <Badge key={c.name} variant="outline" className="text-[9px] gap-1 px-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name} ({c.value})
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">Sem dados</p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tipos</p>
              {typeDist.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={100}>
                    <PieChart>
                      <Pie data={typeDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={20} paddingAngle={2} strokeWidth={0}>
                        {typeDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(240, 10%, 12%)", border: "1px solid hsl(240, 8%, 20%)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number, name: string) => [v, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {typeDist.map((t) => (
                      <Badge key={t.name} variant="outline" className="text-[9px] gap-1 px-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: t.color }} /> {t.name} ({t.value})
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">Sem dados</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DeckStats;
