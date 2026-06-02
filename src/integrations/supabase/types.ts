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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      mood_entries: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          journal_text: string | null
          mood_level: Database["public"]["Enums"]["mood_level"]
          mood_score: number
          qdrant_point_id: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          journal_text?: string | null
          mood_level: Database["public"]["Enums"]["mood_level"]
          mood_score: number
          qdrant_point_id?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          journal_text?: string | null
          mood_level?: Database["public"]["Enums"]["mood_level"]
          mood_score?: number
          qdrant_point_id?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          content: Json
          context_summary: string | null
          created_at: string
          id: string
          qdrant_point_id: string | null
          recommendation_type: string
          user_feedback: string | null
          user_id: string
          was_accepted: boolean | null
          was_helpful: boolean | null
        }
        Insert: {
          content: Json
          context_summary?: string | null
          created_at?: string
          id?: string
          qdrant_point_id?: string | null
          recommendation_type: string
          user_feedback?: string | null
          user_id: string
          was_accepted?: boolean | null
          was_helpful?: boolean | null
        }
        Update: {
          content?: Json
          context_summary?: string | null
          created_at?: string
          id?: string
          qdrant_point_id?: string | null
          recommendation_type?: string
          user_feedback?: string | null
          user_id?: string
          was_accepted?: boolean | null
          was_helpful?: boolean | null
        }
        Relationships: []
      }
      therapy_sessions: {
        Row: {
          activity_name: string
          created_at: string
          duration_seconds: number
          id: string
          metrics: Json | null
          mood_after: Database["public"]["Enums"]["mood_level"] | null
          mood_before: Database["public"]["Enums"]["mood_level"] | null
          notes: string | null
          qdrant_point_id: string | null
          session_type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Insert: {
          activity_name: string
          created_at?: string
          duration_seconds: number
          id?: string
          metrics?: Json | null
          mood_after?: Database["public"]["Enums"]["mood_level"] | null
          mood_before?: Database["public"]["Enums"]["mood_level"] | null
          notes?: string | null
          qdrant_point_id?: string | null
          session_type: Database["public"]["Enums"]["activity_type"]
          user_id: string
        }
        Update: {
          activity_name?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          metrics?: Json | null
          mood_after?: Database["public"]["Enums"]["mood_level"] | null
          mood_before?: Database["public"]["Enums"]["mood_level"] | null
          notes?: string | null
          qdrant_point_id?: string | null
          session_type?: Database["public"]["Enums"]["activity_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_insights: {
        Row: {
          confidence_score: number | null
          created_at: string
          decay_factor: number | null
          evidence_ids: string[] | null
          id: string
          insight_text: string
          insight_type: string
          last_reinforced_at: string | null
          qdrant_point_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          decay_factor?: number | null
          evidence_ids?: string[] | null
          id?: string
          insight_text: string
          insight_type: string
          last_reinforced_at?: string | null
          qdrant_point_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          decay_factor?: number | null
          evidence_ids?: string[] | null
          id?: string
          insight_text?: string
          insight_type?: string
          last_reinforced_at?: string | null
          qdrant_point_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wellness_activities: {
        Row: {
          accuracy_score: number | null
          activity_id: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          completion_status: string | null
          created_at: string
          feedback: string | null
          id: string
          metadata: Json | null
          qdrant_point_id: string | null
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          activity_id: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          completion_status?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          metadata?: Json | null
          qdrant_point_id?: string | null
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          activity_id?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          completion_status?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          metadata?: Json | null
          qdrant_point_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_type:
        | "breathing"
        | "yoga"
        | "game"
        | "mood_entry"
        | "therapy_session"
        | "laughter"
      mood_level: "very_low" | "low" | "neutral" | "good" | "great"
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
      activity_type: [
        "breathing",
        "yoga",
        "game",
        "mood_entry",
        "therapy_session",
        "laughter",
      ],
      mood_level: ["very_low", "low", "neutral", "good", "great"],
    },
  },
} as const
