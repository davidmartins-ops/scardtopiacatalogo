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
  product_type?: "single" | "drop";
  language?: string;
  condition?: string;
}

export const inventoryData: InventoryItem[] = [];
