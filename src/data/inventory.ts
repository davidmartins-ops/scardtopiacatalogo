export interface InventoryItem {
  id: string;
  name: string;
  description: "Foil" | "Non-Foil" | "Rainbow Foil" | "Holo Foil" | "Galaxy Foil" | "Confetti Foil";
  price: number;
  quantity: number;
  category: string;
  image?: string;
  image_url?: string | null;
  discount?: number;
  product_type?: "single" | "drop";
  language?: string;
  condition?: string;
  status?: "none" | "pre_sale" | "launch";
}

export const inventoryData: InventoryItem[] = [];
