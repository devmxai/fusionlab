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
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      credit_reservations: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json | null
          model: string
          pricing_snapshot: Json | null
          released_at: string | null
          settled_at: string | null
          status: string
          task_id: string | null
          tool_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          model: string
          pricing_snapshot?: Json | null
          released_at?: string | null
          settled_at?: string | null
          status?: string
          task_id?: string | null
          tool_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          model?: string
          pricing_snapshot?: Json | null
          released_at?: string | null
          settled_at?: string | null
          status?: string
          task_id?: string | null
          tool_id?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action: Database["public"]["Enums"]["credit_action"]
          amount: number
          created_at: string
          description: string | null
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["credit_action"]
          amount: number
          created_at?: string
          description?: string | null
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["credit_action"]
          amount?: number
          created_at?: string
          description?: string | null
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          created_at: string
          file_type: string
          file_url: string
          id: string
          metadata: Json | null
          prompt: string | null
          reservation_id: string | null
          thumbnail_url: string | null
          tool_id: string
          tool_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_type?: string
          file_url: string
          id?: string
          metadata?: Json | null
          prompt?: string | null
          reservation_id?: string | null
          thumbnail_url?: string | null
          tool_id: string
          tool_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          file_url?: string
          id?: string
          metadata?: Json | null
          prompt?: string | null
          reservation_id?: string | null
          thumbnail_url?: string | null
          tool_id?: string
          tool_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      homepage_banners: {
        Row: {
          created_at: string | null
          cta_link: string | null
          cta_text: string | null
          id: string
          image_url: string
          is_active: boolean | null
          sort_order: number | null
          subtitle: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      model_access: {
        Row: {
          category: string | null
          created_at: string
          display_name: string | null
          is_active: boolean
          min_plan: string
          model: string
          provider: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          min_plan?: string
          model: string
          provider?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          display_name?: string | null
          is_active?: boolean
          min_plan?: string
          model?: string
          provider?: string | null
        }
        Relationships: []
      }
      model_card_tabs: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          is_visible: boolean | null
          label: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          is_visible?: boolean | null
          label: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          is_visible?: boolean | null
          label?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      model_cards: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          display_section: string | null
          id: string
          image_url: string | null
          is_visible: boolean | null
          media_type: string | null
          sort_order: number | null
          title: string | null
          tool_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_section?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          media_type?: string | null
          sort_order?: number | null
          title?: string | null
          tool_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_section?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          media_type?: string | null
          sort_order?: number | null
          title?: string | null
          tool_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          attempts: number | null
          created_at: string | null
          expires_at: string
          id: string
          otp_code: string
          phone_number: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_code: string
          phone_number: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_code?: string
          phone_number?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          created_at: string
          daily_generation_limit: number | null
          features: Json
          id: string
          max_image_resolution: string | null
          max_video_duration_seconds: number | null
          max_video_resolution: string | null
          plan_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_generation_limit?: number | null
          features?: Json
          id?: string
          max_image_resolution?: string | null
          max_video_duration_seconds?: number | null
          max_video_resolution?: string | null
          plan_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_generation_limit?: number | null
          features?: Json
          id?: string
          max_image_resolution?: string | null
          max_video_duration_seconds?: number | null
          max_video_resolution?: string | null
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          created_at: string
          display_name: string | null
          duration_seconds: number | null
          generation_type: string
          has_audio: boolean | null
          id: string
          model: string
          price_credits: number
          price_unit: string
          provider: string
          quality: string | null
          resolution: string | null
          source_note: string | null
          source_url: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          duration_seconds?: number | null
          generation_type?: string
          has_audio?: boolean | null
          id?: string
          model: string
          price_credits: number
          price_unit?: string
          provider: string
          quality?: string | null
          resolution?: string | null
          source_note?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          duration_seconds?: number | null
          generation_type?: string
          has_audio?: boolean | null
          id?: string
          model?: string
          price_credits?: number
          price_unit?: string
          provider?: string
          quality?: string | null
          resolution?: string | null
          source_note?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_number: string | null
          phone_verified: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone_number?: string | null
          phone_verified?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_number?: string | null
          phone_verified?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          credits_per_month: number
          features: Json | null
          id: string
          is_active: boolean
          name: string
          name_ar: string
          price: number
          type: Database["public"]["Enums"]["plan_type"]
        }
        Insert: {
          created_at?: string
          credits_per_month?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          name: string
          name_ar: string
          price?: number
          type: Database["public"]["Enums"]["plan_type"]
        }
        Update: {
          created_at?: string
          credits_per_month?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string
          price?: number
          type?: Database["public"]["Enums"]["plan_type"]
        }
        Relationships: []
      }
      trending_images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_published: boolean | null
          prompt: string | null
          sort_order: number | null
          title: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_published?: boolean | null
          prompt?: string | null
          sort_order?: number | null
          title?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_published?: boolean | null
          prompt?: string | null
          sort_order?: number | null
          title?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      trending_videos: {
        Row: {
          created_at: string | null
          id: string
          is_published: boolean | null
          prompt: string | null
          sort_order: number | null
          thumbnail_url: string | null
          title: string | null
          uploaded_by: string | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          prompt?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string | null
          uploaded_by?: string | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          prompt?: string | null
          sort_order?: number | null
          thumbnail_url?: string | null
          title?: string | null
          uploaded_by?: string | null
          video_url?: string
        }
        Relationships: []
      }
      trial_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["trial_status"]
          trial_credits: number | null
          trial_days: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["trial_status"]
          trial_credits?: number | null
          trial_days?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["trial_status"]
          trial_credits?: number | null
          trial_days?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_subscriptions: {
        Row: {
          activated_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_activate_subscription: {
        Args: { p_days?: number; p_plan_id: string; p_target_user_id: string }
        Returns: Json
      }
      admin_grant_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_handle_trial: {
        Args: { p_approve: boolean; p_trial_id: string }
        Returns: Json
      }
      check_entitlement:
        | {
            Args: {
              p_duration_seconds?: number
              p_model: string
              p_resolution?: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_duration_seconds?: number
              p_generation_type?: string
              p_model: string
              p_quality?: string
              p_resolution?: string
              p_user_id: string
            }
            Returns: Json
          }
      cleanup_stale_reservations: {
        Args: { p_older_than_hours?: number }
        Returns: Json
      }
      enforce_subscription_expiry: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reconciliation_check: { Args: never; Returns: Json }
      release_credits: { Args: { p_reservation_id: string }; Returns: Json }
      reserve_credits: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_model: string
          p_pricing_snapshot?: Json
          p_tool_id: string
        }
        Returns: Json
      }
      server_calculate_price: {
        Args: {
          p_duration_seconds?: number
          p_has_audio?: boolean
          p_model: string
          p_quality?: string
          p_resolution?: string
        }
        Returns: Json
      }
      settle_credits: {
        Args: { p_reservation_id: string; p_task_id?: string }
        Returns: Json
      }
      validate_and_reserve:
        | {
            Args: {
              p_duration_seconds?: number
              p_has_audio?: boolean
              p_idempotency_key?: string
              p_model: string
              p_quality?: string
              p_resolution?: string
              p_tool_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_duration_seconds?: number
              p_generation_type?: string
              p_has_audio?: boolean
              p_idempotency_key?: string
              p_model: string
              p_quality?: string
              p_resolution?: string
              p_tool_id: string
            }
            Returns: Json
          }
    }
    Enums: {
      app_role: "admin" | "user"
      credit_action:
        | "earned"
        | "spent"
        | "admin_grant"
        | "subscription_grant"
        | "trial_grant"
        | "refund"
      plan_type: "starter" | "plus" | "pro"
      subscription_status: "active" | "expired" | "cancelled" | "pending"
      trial_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "user"],
      credit_action: [
        "earned",
        "spent",
        "admin_grant",
        "subscription_grant",
        "trial_grant",
        "refund",
      ],
      plan_type: ["starter", "plus", "pro"],
      subscription_status: ["active", "expired", "cancelled", "pending"],
      trial_status: ["pending", "approved", "rejected"],
    },
  },
} as const
