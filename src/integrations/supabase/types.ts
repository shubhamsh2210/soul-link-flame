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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      feedback_reports: {
        Row: {
          ai_summary_text: string | null
          communication_clarity_score: number | null
          created_at: string
          domain_depth_score: number | null
          gaps: string[] | null
          id: string
          prioritization_score: number | null
          rater_user_id: string | null
          session_id: string
          source: Database["public"]["Enums"]["feedback_source"]
          stakeholder_awareness_score: number | null
          strengths: string[] | null
          structure_score: number | null
          subject_user_id: string
        }
        Insert: {
          ai_summary_text?: string | null
          communication_clarity_score?: number | null
          created_at?: string
          domain_depth_score?: number | null
          gaps?: string[] | null
          id?: string
          prioritization_score?: number | null
          rater_user_id?: string | null
          session_id: string
          source: Database["public"]["Enums"]["feedback_source"]
          stakeholder_awareness_score?: number | null
          strengths?: string[] | null
          structure_score?: number | null
          subject_user_id: string
        }
        Update: {
          ai_summary_text?: string | null
          communication_clarity_score?: number | null
          created_at?: string
          domain_depth_score?: number | null
          gaps?: string[] | null
          id?: string
          prioritization_score?: number | null
          rater_user_id?: string | null
          session_id?: string
          source?: Database["public"]["Enums"]["feedback_source"]
          stakeholder_awareness_score?: number | null
          strengths?: string[] | null
          structure_score?: number | null
          subject_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          question_id: string | null
          room_token_a: string | null
          room_token_b: string | null
          round_1_candidate_id: string | null
          round_swap_at: string | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          track: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          question_id?: string | null
          room_token_a?: string | null
          room_token_b?: string | null
          round_1_candidate_id?: string | null
          round_swap_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          track: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          question_id?: string | null
          room_token_a?: string | null
          room_token_b?: string | null
          round_1_candidate_id?: string | null
          round_swap_at?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          track?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          completed_sessions: number
          created_at: string
          credits_balance: number
          display_name: string
          experience_level: Database["public"]["Enums"]["experience_level"]
          id: string
          no_show_count: number
          track: Database["public"]["Enums"]["track_type"]
          trust_score: number
        }
        Insert: {
          completed_sessions?: number
          created_at?: string
          credits_balance?: number
          display_name: string
          experience_level: Database["public"]["Enums"]["experience_level"]
          id: string
          no_show_count?: number
          track: Database["public"]["Enums"]["track_type"]
          trust_score?: number
        }
        Update: {
          completed_sessions?: number
          created_at?: string
          credits_balance?: number
          display_name?: string
          experience_level?: Database["public"]["Enums"]["experience_level"]
          id?: string
          no_show_count?: number
          track?: Database["public"]["Enums"]["track_type"]
          trust_score?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          id: string
          prompt_text: string
          track: string
        }
        Insert: {
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          id?: string
          prompt_text: string
          track: string
        }
        Update: {
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          id?: string
          prompt_text?: string
          track?: string
        }
        Relationships: []
      }
      queue_entries: {
        Row: {
          experience_level: string
          id: string
          joined_at: string
          status: Database["public"]["Enums"]["queue_status"]
          track: string
          user_id: string
        }
        Insert: {
          experience_level: string
          id?: string
          joined_at?: string
          status?: Database["public"]["Enums"]["queue_status"]
          track: string
          user_id: string
        }
        Update: {
          experience_level?: string
          id?: string
          joined_at?: string
          status?: Database["public"]["Enums"]["queue_status"]
          track?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_session_participant: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      experience_level: "entry" | "mid" | "senior"
      feedback_source: "peer" | "ai"
      question_difficulty: "easy" | "medium" | "hard"
      queue_status: "waiting" | "matched" | "expired" | "cancelled"
      session_status:
        | "matched"
        | "room_created"
        | "round_1"
        | "round_swap"
        | "round_2"
        | "ended"
        | "no_show"
      track_type: "pm" | "swe" | "consulting" | "sales" | "support"
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
      experience_level: ["entry", "mid", "senior"],
      feedback_source: ["peer", "ai"],
      question_difficulty: ["easy", "medium", "hard"],
      queue_status: ["waiting", "matched", "expired", "cancelled"],
      session_status: [
        "matched",
        "room_created",
        "round_1",
        "round_swap",
        "round_2",
        "ended",
        "no_show",
      ],
      track_type: ["pm", "swe", "consulting", "sales", "support"],
    },
  },
} as const
