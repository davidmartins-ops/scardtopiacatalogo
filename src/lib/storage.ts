import { supabase } from "@/integrations/supabase/client";

export const uploadProductImage = async (file: File): Promise<string> => {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `${fileName}`;

  const { error } = await supabase.storage.from("products").upload(filePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("products").getPublicUrl(filePath);
  return data.publicUrl;
};

/**
 * Upload with progress callback. Supabase JS v2 doesn't expose XHR progress for storage uploads,
 * so we emit a synthetic 30%/70%/100% sequence around the actual upload to give users feedback.
 * For true byte-level progress, a signed-URL + XHR PUT flow would be required.
 */
export const uploadProductImageWithProgress = async (
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> => {
  onProgress?.(10);
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  onProgress?.(30);

  const { error } = await supabase.storage.from("products").upload(fileName, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  onProgress?.(85);

  const { data } = supabase.storage.from("products").getPublicUrl(fileName);
  onProgress?.(100);
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
