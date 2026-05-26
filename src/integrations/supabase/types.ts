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
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      admin_notification_reads: {
        Row: {
          admin_id: string
          notification_id: string
          read_at: string
        }
        Insert: {
          admin_id: string
          notification_id: string
          read_at?: string
        }
        Update: {
          admin_id?: string
          notification_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          message: string
          metadata: Json
          title: string
          type: Database["public"]["Enums"]["admin_notification_type"]
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          message?: string
          metadata?: Json
          title: string
          type: Database["public"]["Enums"]["admin_notification_type"]
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          message?: string
          metadata?: Json
          title?: string
          type?: Database["public"]["Enums"]["admin_notification_type"]
        }
        Relationships: []
      }
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
      banners: {
        Row: {
          alt: string
          created_at: string
          display_page: string
          id: string
          image_url: string
          inventory_item_id: string | null
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
          inventory_item_id?: string | null
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
          inventory_item_id?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
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
      cookie_consents: {
        Row: {
          analytics: boolean
          created_at: string
          essential: boolean
          id: string
          marketing: boolean
          policy_version: string
          session_id: string | null
          source: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          created_at?: string
          essential?: boolean
          id?: string
          marketing?: boolean
          policy_version?: string
          session_id?: string | null
          source?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          created_at?: string
          essential?: boolean
          id?: string
          marketing?: boolean
          policy_version?: string
          session_id?: string | null
          source?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          address: Json | null
          avatar_url: string | null
          cpf: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          address?: Json | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          address?: Json | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token_hash?: string
          used_at?: string | null
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
      inventory_audit: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          metadata: Json | null
          order_id: string | null
          quantity_delta: number
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          metadata?: Json | null
          order_id?: string | null
          quantity_delta: number
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          metadata?: Json | null
          order_id?: string | null
          quantity_delta?: number
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_disputes: {
        Row: {
          admin_response: string | null
          attachment_url: string | null
          created_at: string
          description: string
          id: string
          order_id: string
          reason: string
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          attachment_url?: string | null
          created_at?: string
          description: string
          id?: string
          order_id: string
          reason: string
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          attachment_url?: string | null
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          reason?: string
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sla_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          max_hours: number
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          max_hours: number
          status: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          max_hours?: number
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_info: Json
          id: string
          items: Json
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url: string | null
          sla_breach_status: Database["public"]["Enums"]["order_status"] | null
          sla_breached_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          status_updated_at: string
          total: number
          tracking_code: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_info?: Json
          id?: string
          items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          sla_breach_status?: Database["public"]["Enums"]["order_status"] | null
          sla_breached_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_updated_at?: string
          total?: number
          tracking_code?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_info?: Json
          id?: string
          items?: Json
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          sla_breach_status?: Database["public"]["Enums"]["order_status"] | null
          sla_breached_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          status_updated_at?: string
          total?: number
          tracking_code?: string | null
          user_id?: string | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_inventory_stock: {
        Args: { _item_id: string; _qty: number }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      admin_notification_type:
        | "new_order"
        | "new_dispute"
        | "low_stock"
        | "out_of_stock"
        | "payment_confirmed"
        | "sla_breach"
        | "system"
      app_role: "admin" | "user"
      dispute_status: "open" | "in_review" | "resolved" | "rejected"
      order_status:
        | "pending_payment"
        | "payment_confirmed"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_method: "pix" | "credit" | "debit" | "whatsapp" | "other"
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
    Enums: {
      admin_notification_type: [
        "new_order",
        "new_dispute",
        "low_stock",
        "out_of_stock",
        "payment_confirmed",
        "sla_breach",
        "system",
      ],
      app_role: ["admin", "user"],
      dispute_status: ["open", "in_review", "resolved", "rejected"],
      order_status: [
        "pending_payment",
        "payment_confirmed",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_method: ["pix", "credit", "debit", "whatsapp", "other"],
    },
  },
} as const
