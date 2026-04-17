export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          category: string | null
          created_at: string
          event_type: string
          id: string
          inventory_item_id: string | null
          item_name: string | null
          metadata: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          event_type: string
          id?: string
          inventory_item_id?: string | null
          item_name?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          event_type?: string
          id?: string
          inventory_item_id?: string | null
          item_name?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      authorized_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          alt: string
          created_at: string
          display_page: string
          id: string
          image_url: string
          is_active: boolean
          label: string
          sort_order: number
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          alt?: string
          created_at?: string
          display_page?: string
          id?: string
          image_url: string
          is_active?: boolean
          label?: string
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          alt?: string
          created_at?: string
          display_page?: string
          id?: string
          image_url?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      collection_cards: {
        Row: {
          card_name: string
          collection_id: string
          condition: string | null
          created_at: string
          id: string
          image_url: string | null
          language: string | null
          notes: string | null
          quantity: number
          scryfall_id: string | null
        }
        Insert: {
          card_name: string
          collection_id: string
          condition?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          language?: string | null
          notes?: string | null
          quantity?: number
          scryfall_id?: string | null
        }
        Update: {
          card_name?: string
          collection_id?: string
          condition?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          language?: string | null
          notes?: string | null
          quantity?: number
          scryfall_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_cards_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      deck_cards: {
        Row: {
          card_name: string
          created_at: string
          deck_id: string
          id: string
          image_url: string | null
          is_commander: boolean
          is_sideboard: boolean
          quantity: number
          scryfall_id: string | null
        }
        Insert: {
          card_name: string
          created_at?: string
          deck_id: string
          id?: string
          image_url?: string | null
          is_commander?: boolean
          is_sideboard?: boolean
          quantity?: number
          scryfall_id?: string | null
        }
        Update: {
          card_name?: string
          created_at?: string
          deck_id?: string
          id?: string
          image_url?: string | null
          is_commander?: boolean
          is_sideboard?: boolean
          quantity?: number
          scryfall_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          description: string | null
          format: string
          id: string
          is_public: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          is_public?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          is_public?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drop_singles_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          inventory_item_id: string
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          inventory_item_id: string
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          inventory_item_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          category: string
          condition: string
          created_at: string
          description: string
          discount: number
          drop_description: string | null
          id: string
          image_url: string | null
          language: string
          name: string
          price: number
          price_pix: number
          product_type: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          condition?: string
          created_at?: string
          description: string
          discount?: number
          drop_description?: string | null
          id: string
          image_url?: string | null
          language?: string
          name: string
          price?: number
          price_pix?: number
          product_type?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          description?: string
          discount?: number
          drop_description?: string | null
          id?: string
          image_url?: string | null
          language?: string
          name?: string
          price?: number
          price_pix?: number
          product_type?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          id: string
          items: Json
          status: string
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          status?: string
          total?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          status?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          captured_at: string
          card_name: string
          collector_number: string | null
          created_at: string
          format: string
          id: string
          price_usd: number | null
          price_usd_foil: number | null
          scryfall_id: string | null
          set_code: string | null
        }
        Insert: {
          captured_at?: string
          card_name: string
          collector_number?: string | null
          created_at?: string
          format?: string
          id?: string
          price_usd?: number | null
          price_usd_foil?: number | null
          scryfall_id?: string | null
          set_code?: string | null
        }
        Update: {
          captured_at?: string
          card_name?: string
          collector_number?: string | null
          created_at?: string
          format?: string
          id?: string
          price_usd?: number | null
          price_usd_foil?: number | null
          scryfall_id?: string | null
          set_code?: string | null
        }
        Relationships: []
      }
      saved_cart_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: []
      }
      stock_notifications: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          notified: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          notified?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          notified?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
