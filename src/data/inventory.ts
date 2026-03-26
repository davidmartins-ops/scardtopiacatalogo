export interface InventoryItem {
  id: string;
  name: string;
  description: "Foil" | "Non-Foil" | "Rainbow Foil";
  price: number;
  quantity: number;
  category: string;
  image?: string;
  discount?: number;
}

// Static data is no longer used — inventory is fetched from the database.
// This file only exports the InventoryItem type.
export const inventoryData: InventoryItem[] = [];
