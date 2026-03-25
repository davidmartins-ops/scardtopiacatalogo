export interface InventoryItem {
  id: string;
  name: string;
  description: "Foil" | "Non-Foil" | "Rainbow Foil";
  price: number;
  quantity: number;
  category: string;
  image?: string;
}

export const inventoryData: InventoryItem[] = [
  { id: "SLDPS03", item.image, name: "Secret Lair x The Last of Us - Parte I", description: "Foil", price: 490, quantity: 1, category: "The Last of Us" },
  { id: "SLDAV01", item.image, name: "Secret Lair x Avatar: Ember Island Players", description: "Rainbow Foil", price: 500, quantity: 1, category: "Avatar" },
  { id: "SLDFO01", item.image, name: "Secret Lair x Fallout: Rad", description: "Non-Foil", price: 600, quantity: 1, category: "Fallout" },
  { id: "SLDFO02", item.image, name: "Secret Lair x Fallout: Greet the Dog", description: "Foil", price: 800, quantity: 1, category: "Fallout" },
  { id: "SLDFO03", item.image, name: "Secret Lair x Fallout: Greet the Dog", description: "Non-Foil", price: 600, quantity: 1, category: "Fallout" },
  { id: "SLDFO05", item.image, name: "Secret Lair x Fallout: Beyond Vault 33", description: "Non-Foil", price: 600, quantity: 1, category: "Fallout" },
  { id: "SLDFO08", item.image, name: "Secret Lair Promo x Fallout", description: "Foil", price: 150, quantity: 1, category: "Fallout" },
  { id: "SLDDD01", item.image, name: "Secret Lair x D&D: Whispers in Candlekeep", description: "Foil", price: 800, quantity: 2, category: "D&D" },
  { id: "SLDDD02", item.image, name: "Secret Lair x D&D: Whispers in Candlekeep", description: "Non-Foil", price: 700, quantity: 3, category: "D&D" },
  { id: "SLDDD03", item.image, name: "Secret Lair x D&D: Shadows Over Baldur's Gate", description: "Foil", price: 800, quantity: 1, category: "D&D" },
  { id: "SLDDD04", item.image, name: "Secret Lair x D&D: Shadows Over Baldur's Gate", description: "Non-Foil", price: 700, quantity: 1, category: "D&D" },
  { id: "SLDDD05", item.image, name: "Secret Lair x D&D: Black Lights & Dark Dungeons", description: "Foil", price: 900, quantity: 1, category: "D&D" },
  { id: "SLDDD06", item.image, name: "Secret Lair x D&D: Black Lights & Dark Dungeons", description: "Non-Foil", price: 700, quantity: 1, category: "D&D" },
  { id: "SLDDD07", item.image, name: "Secret Lair x D&D: Gale's Ambition", description: "Foil", price: 800, quantity: 2, category: "D&D" },
  { id: "SLDDD08", item.image, name: "Secret Lair x D&D: Gale's Ambition", description: "Non-Foil", price: 700, quantity: 1, category: "D&D" },
  { id: "SLDDD09", item.image, name: "Secret Lair x D&D: Lands of the Forgotten Realms", description: "Foil", price: 900, quantity: 2, category: "D&D" },
  { id: "SLDDD10", item.image, name: "Secret Lair x D&D: Lands of the Forgotten Realms", description: "Non-Foil", price: 800, quantity: 1, category: "D&D" },
  { id: "SLDDD11", item.image, name: "Secret Lair x D&D: Shadowheart's Devotion", description: "Foil", price: 800, quantity: 1, category: "D&D" },
  { id: "SLDDD12", item.image, name: "Secret Lair x D&D: Shadowheart's Devotion", description: "Non-Foil", price: 700, quantity: 1, category: "D&D" },
  { id: "SLDDD13", item.image, name: "Secret Lair x D&D: Strahd's Descent", description: "Foil", price: 800, quantity: 2, category: "D&D" },
  { id: "SLDDD14", item.image, name: "Secret Lair x D&D: Strahd's Descent", description: "Non-Foil", price: 700, quantity: 1, category: "D&D" },
];
