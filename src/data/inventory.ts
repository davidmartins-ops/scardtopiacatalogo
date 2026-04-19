export interface InventoryItem {
  id: string;
  name: string;
  description: "Foil" | "Non-Foil" | "Surge Foil" | "Rainbow Foil" | "Holo Foil" | "Galaxy Foil" | "Confetti Foil" | "Etched Foil";
  price: number;
  price_pix?: number;
  quantity: number;
  category: string;
  image?: string;
  image_url?: string | null;
  discount?: number;
  product_type?: "single" | "drop";
  language?: string;
  condition?: string;
  status?: "none" | "pre_sale" | "launch";
  drop_description?: string;
}

export const inventoryData: InventoryItem[] = [];
