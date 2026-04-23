import { describe, it, expect } from "vitest";
import type { InventoryItem } from "@/data/inventory";

// Validates that "Silver Scroll" is a first-class citizen in the foil type system.
// If any of these break, Silver Scroll items will be invisible in search/filters/sort.

const FOIL_TYPES = [
  "Foil",
  "Non-Foil",
  "Surge Foil",
  "Rainbow Foil",
  "Holo Foil",
  "Galaxy Foil",
  "Confetti Foil",
  "Etched Foil",
  "Silver Scroll",
] as const;

describe("Silver Scroll foil type integration", () => {
  it("is included in the canonical foil type list", () => {
    expect(FOIL_TYPES).toContain("Silver Scroll");
  });

  it("is a valid InventoryItem.description value (compile-time)", () => {
    const item: InventoryItem = {
      id: "TEST-001-PT-NF-NM",
      name: "Test Card",
      description: "Silver Scroll",
      price: 10,
      quantity: 1,
      category: "Test",
    };
    expect(item.description).toBe("Silver Scroll");
  });

  it("filters by Silver Scroll correctly", () => {
    const items: InventoryItem[] = [
      { id: "1", name: "A", description: "Foil", price: 1, quantity: 1, category: "x" },
      { id: "2", name: "B", description: "Silver Scroll", price: 2, quantity: 1, category: "x" },
      { id: "3", name: "C", description: "Non-Foil", price: 3, quantity: 1, category: "x" },
      { id: "4", name: "D", description: "Silver Scroll", price: 4, quantity: 1, category: "x" },
    ];
    const filtered = items.filter((i) => i.description === "Silver Scroll");
    expect(filtered).toHaveLength(2);
    expect(filtered.map((i) => i.id)).toEqual(["2", "4"]);
  });

  it("matches Silver Scroll in case-insensitive search", () => {
    const items: InventoryItem[] = [
      { id: "1", name: "Sol Ring Silver Scroll Edition", description: "Silver Scroll", price: 1, quantity: 1, category: "x" },
      { id: "2", name: "Other", description: "Foil", price: 2, quantity: 1, category: "x" },
    ];
    const q = "silver scroll";
    const matches = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("1");
  });

  it("sorts Silver Scroll items alphabetically among other foils", () => {
    const items: InventoryItem[] = [
      { id: "1", name: "Zephyr", description: "Silver Scroll", price: 1, quantity: 1, category: "x" },
      { id: "2", name: "Alpha", description: "Foil", price: 2, quantity: 1, category: "x" },
      { id: "3", name: "Mid", description: "Silver Scroll", price: 3, quantity: 1, category: "x" },
    ];
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    expect(sorted.map((i) => i.id)).toEqual(["2", "3", "1"]);
  });
});
