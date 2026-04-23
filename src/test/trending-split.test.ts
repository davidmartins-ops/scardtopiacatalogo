import { describe, it, expect } from "vitest";

// CORREÇÃO 28.2: Validate the segmentation logic used by the Trending page.
// Mirrors the filter+sort applied inside applyFilterAndSort().

interface Card { name: string; priceChangePct?: number }

const split = (cards: Card[], type: "rising" | "falling", sortOrder: "pct_desc" | "pct_asc" = "pct_desc") => {
  if (type === "rising") {
    const f = cards.filter((c) => (c.priceChangePct ?? 0) > 0);
    return [...f].sort((a, b) => {
      const aPct = a.priceChangePct ?? 0; const bPct = b.priceChangePct ?? 0;
      return sortOrder === "pct_desc" ? bPct - aPct : aPct - bPct;
    });
  }
  const f = cards.filter((c) => (c.priceChangePct ?? 0) < 0);
  return [...f].sort((a, b) => {
    const aPct = a.priceChangePct ?? 0; const bPct = b.priceChangePct ?? 0;
    return sortOrder === "pct_desc" ? aPct - bPct : bPct - aPct;
  });
};

describe("Trending tabs split by sign", () => {
  const sample: Card[] = [
    { name: "A", priceChangePct: 12 },
    { name: "B", priceChangePct: -3 },
    { name: "C", priceChangePct: 0 },
    { name: "D", priceChangePct: 4.5 },
    { name: "E", priceChangePct: -1.2 },
    { name: "F" }, // missing variation
  ];

  it("'Em Alta' contains only positive variations", () => {
    const rising = split(sample, "rising");
    expect(rising.map((c) => c.name)).toEqual(["A", "D"]);
    expect(rising.every((c) => (c.priceChangePct ?? 0) > 0)).toBe(true);
  });

  it("'Em Baixa' contains only negative variations", () => {
    const falling = split(sample, "falling");
    expect(falling.map((c) => c.name)).toEqual(["B", "E"]);
    expect(falling.every((c) => (c.priceChangePct ?? 0) < 0)).toBe(true);
  });

  it("zero and missing variations are excluded from both tabs", () => {
    const rising = split(sample, "rising");
    const falling = split(sample, "falling");
    const all = [...rising, ...falling].map((c) => c.name);
    expect(all).not.toContain("C");
    expect(all).not.toContain("F");
  });

  it("'Em Alta' sorts biggest growth first (pct_desc)", () => {
    const rising = split(sample, "rising", "pct_desc");
    expect(rising[0].name).toBe("A"); // 12 > 4.5
  });

  it("'Em Baixa' sorts biggest drop first (pct_desc → most negative first)", () => {
    const falling = split(sample, "falling", "pct_desc");
    expect(falling[0].name).toBe("B"); // -3 < -1.2
  });
});
