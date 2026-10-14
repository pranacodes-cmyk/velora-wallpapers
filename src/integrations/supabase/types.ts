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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bible_kjv: {
        Row: {
          book: string
          book_index: number
          chapter: number
          id: number
          text: string
          verse: number
        }
        Insert: {
          book: string
          book_index: number
          chapter: number
          id: number
          text: string
          verse: number
        }
        Update: {
          book?: string
          book_index?: number
          chapter?: number
          id?: number
          text?: string
          verse?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      challenge_cheers: {
        Row: {
          circle_id: string
          created_at: string
          from_member: string
          id: string
          kind: string
          seen_at: string | null
          sent_on: string
          to_member: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          from_member: string
          id?: string
          kind: string
          seen_at?: string | null
          sent_on?: string
          to_member: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          from_member?: string
          id?: string
          kind?: string
          seen_at?: string | null
          sent_on?: string
          to_member?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_cheers_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "challenge_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_cheers_from_member_fkey"
            columns: ["from_member"]
            isOneToOne: false
            referencedRelation: "challenge_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_cheers_to_member_fkey"
            columns: ["to_member"]
            isOneToOne: false
            referencedRelation: "challenge_members"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_circle_members: {
        Row: {
          circle_id: string
          joined_at: string
          member_id: string
        }
        Insert: {
          circle_id: string
          joined_at?: string
          member_id: string
        }
        Update: {
          circle_id?: string
          joined_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "challenge_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_circle_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "challenge_members"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_circles: {
        Row: {
          code: string
          created_at: string
          created_by: string
          emoji: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          emoji?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          emoji?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_circles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "challenge_members"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_members: {
        Row: {
          attempts: number
          avatar: string
          best_streak: number
          completed_days: number
          created_at: string
          current_streak: number
          display_name: string
          id: string
          is_pro: boolean
          lang: string
          last_lit_on: string | null
          mode: string
          secret_hash: string
          started_on: string | null
          today_done: number
          today_on: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          avatar?: string
          best_streak?: number
          completed_days?: number
          created_at?: string
          current_streak?: number
          display_name?: string
          id?: string
          is_pro?: boolean
          lang?: string
          last_lit_on?: string | null
          mode?: string
          secret_hash: string
          started_on?: string | null
          today_done?: number
          today_on?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          avatar?: string
          best_streak?: number
          completed_days?: number
          created_at?: string
          current_streak?: number
          display_name?: string
          id?: string
          is_pro?: boolean
          lang?: string
          last_lit_on?: string | null
          mode?: string
          secret_hash?: string
          started_on?: string | null
          today_done?: number
          today_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      live_wallpapers: {
        Row: {
          category: string
          created_at: string
          id: string
          is_premium: boolean
          sort_order: number
          subtitle: string | null
          thumbnail_url: string | null
          title: string
          video_url: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_premium?: boolean
          sort_order?: number
          subtitle?: string | null
          thumbnail_url?: string | null
          title: string
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_premium?: boolean
          sort_order?: number
          subtitle?: string | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string
        }
        Relationships: []
      }
      ota_bundles: {
        Row: {
          active: boolean
          channel: string
          checksum: string
          created_at: string
          id: string
          min_native_version: string | null
          native_version: string | null
          notes: string | null
          platform: string
          rollout: number
          urgent: boolean
          url: string
          version: string
        }
        Insert: {
          active?: boolean
          channel?: string
          checksum: string
          created_at?: string
          id?: string
          min_native_version?: string | null
          native_version?: string | null
          notes?: string | null
          platform?: string
          rollout?: number
          urgent?: boolean
          url: string
          version: string
        }
        Update: {
          active?: boolean
          channel?: string
          checksum?: string
          created_at?: string
          id?: string
          min_native_version?: string | null
          native_version?: string | null
          notes?: string | null
          platform?: string
          rollout?: number
          urgent?: boolean
          url?: string
          version?: string
        }
        Relationships: []
      }
      pending_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["pending_asset_type"]
          category_slug: string
          created_at: string
          id: string
          image_url: string
          is_premium: boolean
          model: string | null
          notes: string | null
          prompt: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["pending_asset_status"]
          title: string
          video_url: string | null
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["pending_asset_type"]
          category_slug: string
          created_at?: string
          id?: string
          image_url: string
          is_premium?: boolean
          model?: string | null
          notes?: string | null
          prompt?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["pending_asset_status"]
          title: string
          video_url?: string | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["pending_asset_type"]
          category_slug?: string
          created_at?: string
          id?: string
          image_url?: string
          is_premium?: boolean
          model?: string | null
          notes?: string | null
          prompt?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["pending_asset_status"]
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      pray_pauses: {
        Row: {
          active: boolean
          id: string
          lang: string
          prayer: string
          reference: string
          slot: number
          updated_at: string
          verse: string
        }
        Insert: {
          active?: boolean
          id?: string
          lang: string
          prayer: string
          reference: string
          slot: number
          updated_at?: string
          verse: string
        }
        Update: {
          active?: boolean
          id?: string
          lang?: string
          prayer?: string
          reference?: string
          slot?: number
          updated_at?: string
          verse?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallpapers: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          image_url: string
          is_premium: boolean
          sort_order: number
          title: string
          upscale_attempted_at: string | null
          upscale_status: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_premium?: boolean
          sort_order?: number
          title: string
          upscale_attempted_at?: string | null
          upscale_status?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_premium?: boolean
          sort_order?: number
          title?: string
          upscale_attempted_at?: string | null
          upscale_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallpapers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      pending_asset_status: "pending" | "approved" | "rejected"
      pending_asset_type: "static" | "live"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
      pending_asset_status: ["pending", "approved", "rejected"],
      pending_asset_type: ["static", "live"],
    },
  },
} as const
