import { supabase } from "@/integrations/supabase/client";

export const uploadProductImage = async (file: File): Promise<string> => {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `${fileName}`;

  const { error } = await supabase.storage.from("products").upload(filePath, file);
  if (error) throw error;

  const { data } = supabase.storage.from("products").getPublicUrl(filePath);
  return data.publicUrl;
};

export const deleteProductImage = async (url: string): Promise<void> => {
  try {
    const parts = url.split("/products/");
    if (parts.length < 2) return;
    const path = parts[1];
    await supabase.storage.from("products").remove([path]);
  } catch {
    // silent fail on cleanup
  }
};
