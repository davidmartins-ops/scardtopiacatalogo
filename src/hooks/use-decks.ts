import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";
import { toast } from "sonner";

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  format: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeckCard {
  id: string;
  deck_id: string;
  card_name: string;
  quantity: number;
  is_sideboard: boolean;
  is_commander: boolean;
  scryfall_id: string | null;
  image_url: string | null;
}

export const MTG_FORMATS: Record<string, { label: string; minCards: number; maxCards: number | null; maxCopies: number; hasSideboard: boolean; hasCommander: boolean; sideboardMax: number }> = {
  standard: { label: "Standard", minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, hasCommander: false, sideboardMax: 15 },
  modern: { label: "Modern", minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, hasCommander: false, sideboardMax: 15 },
  pioneer: { label: "Pioneer", minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, hasCommander: false, sideboardMax: 15 },
  legacy: { label: "Legacy", minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, hasCommander: false, sideboardMax: 15 },
  vintage: { label: "Vintage", minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, hasCommander: false, sideboardMax: 15 },
  commander: { label: "Commander", minCards: 100, maxCards: 100, maxCopies: 1, hasSideboard: false, hasCommander: true, sideboardMax: 0 },
  pauper: { label: "Pauper", minCards: 60, maxCards: null, maxCopies: 4, hasSideboard: true, hasCommander: false, sideboardMax: 15 },
};

export const useDecks = () => {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: decks = [], isLoading } = useQuery({
    queryKey: ["decks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Deck[];
    },
    enabled: !!user,
  });

  const createDeck = useMutation({
    mutationFn: async (deck: { name: string; format: string; description?: string }) => {
      if (!user) throw new Error("Not logged in");
      const { data, error } = await supabase
        .from("decks")
        .insert({ user_id: user.id, name: deck.name, format: deck.format, description: deck.description ?? "" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decks", user?.id] });
      toast.success("Deck criado!");
    },
  });

  const deleteDeck = useMutation({
    mutationFn: async (deckId: string) => {
      const { error } = await supabase.from("decks").delete().eq("id", deckId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decks", user?.id] });
      toast.success("Deck excluído.");
    },
  });

  const updateDeck = useMutation({
    mutationFn: async (update: { id: string; name?: string; description?: string; is_public?: boolean }) => {
      const { id, ...fields } = update;
      const { error } = await supabase.from("decks").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decks", user?.id] }),
  });

  return { decks, isLoading, createDeck, deleteDeck, updateDeck };
};

export const useDeckCards = (deckId: string | undefined) => {
  const qc = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["deck_cards", deckId],
    queryFn: async () => {
      if (!deckId) return [];
      const { data, error } = await supabase
        .from("deck_cards")
        .select("*")
        .eq("deck_id", deckId)
        .order("card_name");
      if (error) throw error;
      return data as DeckCard[];
    },
    enabled: !!deckId,
  });

  const addCard = useMutation({
    mutationFn: async (card: { card_name: string; quantity?: number; is_sideboard?: boolean; is_commander?: boolean; scryfall_id?: string; image_url?: string }) => {
      if (!deckId) throw new Error("No deck");
      const { error } = await supabase.from("deck_cards").insert({
        deck_id: deckId,
        card_name: card.card_name,
        quantity: card.quantity ?? 1,
        is_sideboard: card.is_sideboard ?? false,
        is_commander: card.is_commander ?? false,
        scryfall_id: card.scryfall_id ?? null,
        image_url: card.image_url ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deck_cards", deckId] }),
  });

  const removeCard = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase.from("deck_cards").delete().eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deck_cards", deckId] }),
  });

  const updateCard = useMutation({
    mutationFn: async (update: { id: string; quantity?: number; is_sideboard?: boolean; is_commander?: boolean }) => {
      const { id, ...fields } = update;
      const { error } = await supabase.from("deck_cards").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deck_cards", deckId] }),
  });

  return { cards, isLoading, addCard, removeCard, updateCard };
};
