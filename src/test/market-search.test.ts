import { describe, expect, it } from "vitest";
import { convertMarketPrice, marketSearchUrl } from "@/lib/market-search";

describe("Market card search", () => {
  it("searches the requested name beyond the loaded trends and selected format", () => {
    const url = new URL(marketSearchUrl("  Black Lotus  "));
    expect(url.searchParams.get("q")).toBe('name:"Black Lotus"');
    expect(url.searchParams.get("unique")).toBe("cards");
    expect(url.searchParams.get("q")).not.toContain("f:standard");
  });
  it("keeps search operators inside the name instead of adding filters", () => {
    expect(new URL(marketSearchUrl('Lotus" f:modern')).searchParams.get("q")).toBe('name:"Lotus  f:modern"');
  });
  it("converts searched prices using the current USD to BRL exchange rate", () => {
    expect(convertMarketPrice("10.00", 5.4036)).toBeCloseTo(54.036);
    expect(convertMarketPrice("0", 5.4036)).toBe(0);
  });
  it("does not invent a price or exchange rate when unavailable", () => {
    expect(convertMarketPrice(undefined, 5.4036)).toBeNull();
    expect(convertMarketPrice("10", null)).toBeNull();
    expect(convertMarketPrice("invalid", 5.4036)).toBeNull();
  });
});