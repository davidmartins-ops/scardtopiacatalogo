import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SpecialOrderAttachment {
  id: string;
  special_order_id: string;
  user_id: string;
  item_id: string | null;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
}

const BUCKET = "receipts";

export const uploadSpecialOrderFile = async (
  userId: string,
  specialOrderId: string,
  file: File,
) => {
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${userId}/encomendas/${specialOrderId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
};

export const useSpecialOrderAttachmentUrl = (path?: string | null) =>
  useQuery({
    queryKey: ["special-order-attachment-url", path],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: 1000 * 60 * 5,
  });

export const useSpecialOrderAttachments = (specialOrderId?: string) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["special-order-attachments", specialOrderId],
    queryFn: async () => {
      if (!specialOrderId) return [];
      const { data, error } = await supabase
        .from("special_order_attachments")
        .select("*")
        .eq("special_order_id", specialOrderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpecialOrderAttachment[];
    },
    enabled: !!specialOrderId,
  });

  const addAttachment = useMutation({
    mutationFn: async (input: { description?: string; file?: File | null; itemId?: string | null }) => {
      if (!specialOrderId) throw new Error("Encomenda inválida");
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Faça login para anexar detalhes.");

      let filePath: string | null = null;
      if (input.file) {
        filePath = await uploadSpecialOrderFile(userId, specialOrderId, input.file);
      }

      const { error } = await supabase.from("special_order_attachments").insert({
        special_order_id: specialOrderId,
        user_id: userId,
        item_id: input.itemId ?? null,
        description: input.description?.trim() || null,
        file_path: filePath,
        file_name: input.file?.name ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["special-order-attachments", specialOrderId] }),
  });

  const removeAttachment = useMutation({
    mutationFn: async (attachment: SpecialOrderAttachment) => {
      if (attachment.file_path) {
        await supabase.storage.from(BUCKET).remove([attachment.file_path]);
      }
      const { error } = await supabase
        .from("special_order_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["special-order-attachments", specialOrderId] }),
  });

  return {
    attachments: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    addAttachment,
    removeAttachment,
  };
};
