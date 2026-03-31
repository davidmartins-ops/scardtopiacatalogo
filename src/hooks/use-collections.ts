import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";
import { toast } from "sonner";

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CollectionCard {
  id: string;
  collection_id: string;
  card_name: string;
  quantity: number;
  condition: string;
  language: string;
  scryfall_id: string | null;
  image_url: string | null;
  notes: string;
}

export const useCollections = () => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Collection[];
    },
    enabled: !!user,
  });

  const createCollection = useMutation({
    mutationFn: async (col: { name: string; description?: string }) => {
      if (!user) throw new Error("Not logged in");
      const { data, error } = await supabase
        .from("collections")
        .insert({ user_id: user.id, name: col.name, description: col.description ?? "" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections", user?.id] });
      toast.success("Coleção criada!");
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections", user?.id] });
      toast.success("Coleção excluída.");
    },
  });

  const updateCollection = useMutation({
    mutationFn: async (update: { id: string; name?: string; description?: string; is_public?: boolean }) => {
      const { id, ...fields } = update;
      const { error } = await supabase.from("collections").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", user?.id] }),
  });

  return { collections, isLoading, createCollection, deleteCollection, updateCollection };
};

export const useCollectionCards = (collectionId: string | undefined) => {
  const qc = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["collection_cards", collectionId],
    queryFn: async () => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from("collection_cards")
        .select("*")
        .eq("collection_id", collectionId)
        .order("card_name");
      if (error) throw error;
      return data as CollectionCard[];
    },
    enabled: !!collectionId,
  });

  const addCard = useMutation({
    mutationFn: async (card: { card_name: string; quantity?: number; condition?: string; language?: string; scryfall_id?: string; image_url?: string; notes?: string }) => {
      if (!collectionId) throw new Error("No collection");
      const { error } = await supabase.from("collection_cards").insert({
        collection_id: collectionId,
        card_name: card.card_name,
        quantity: card.quantity ?? 1,
        condition: card.condition ?? "NM",
        language: card.language ?? "PT",
        scryfall_id: card.scryfall_id ?? null,
        image_url: card.image_url ?? null,
        notes: card.notes ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection_cards", collectionId] });
      toast.success("Carta adicionada!");
    },
  });

  const removeCard = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase.from("collection_cards").delete().eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection_cards", collectionId] }),
  });

  const updateCard = useMutation({
    mutationFn: async (update: { id: string; quantity?: number; condition?: string; notes?: string }) => {
      const { id, ...fields } = update;
      const { error } = await supabase.from("collection_cards").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection_cards", collectionId] }),
  });

  return { cards, isLoading, addCard, removeCard, updateCard };
};

export const usePublicCollection = (collectionId: string | undefined) => {
  return useQuery({
    queryKey: ["public_collection", collectionId],
    queryFn: async () => {
      if (!collectionId) return null;
      const { data: col, error } = await supabase
        .from("collections")
        .select("*")
        .eq("id", collectionId)
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      if (!col) return null;
      const { data: cards } = await supabase
        .from("collection_cards")
        .select("*")
        .eq("collection_id", collectionId)
        .order("card_name");
      return { collection: col as Collection, cards: (cards ?? []) as CollectionCard[] };
    },
    enabled: !!collectionId,
  });
};
