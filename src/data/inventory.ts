export interface InventoryItem {
  id: string;
  name: string;
  description: "Foil" | "Non-Foil" | "Rainbow Foil";
  price: number;
  quantity: number;
  category: string;
  image?: string;
  image_url?: string | null;
  discount?: number;
}

export const inventoryData: InventoryItem[] = [];
