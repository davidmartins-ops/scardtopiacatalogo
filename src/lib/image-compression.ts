import imageCompression from "browser-image-compression";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export const validateImageFile = (file: File): ValidationResult => {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, reason: `Formato inválido (${file.type || "desconhecido"}). Use JPG, PNG ou WebP.` };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 5MB.` };
  }
  return { ok: true };
};

/**
 * Compress an image to WebP at quality 0.85 using canvas-based compression.
 * Falls back to the original file if compression fails.
 */
export const compressToWebp = async (file: File): Promise<File> => {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.85,
    });
    // Rename to .webp extension
    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([compressed], newName, { type: "image/webp" });
  } catch {
    return file;
  }
};

export { ACCEPTED_TYPES, MAX_BYTES };
