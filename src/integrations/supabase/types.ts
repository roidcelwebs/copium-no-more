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
      app_accounts: {
        Row: {
          assigned_program_id: string | null
          auth_user_id: string
          created_at: string
          id: string
          is_preview: boolean
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          assigned_program_id?: string | null
          auth_user_id: string
          created_at?: string
          id?: string
          is_preview?: boolean
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          role: string
          updated_at?: string
          username: string
        }
        Update: {
          assigned_program_id?: string | null
          auth_user_id?: string
          created_at?: string
          id?: string
          is_preview?: boolean
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      app_state: {
        Row: {
          exercises: Json
          id: string
          programs: Json
          updated_at: string
          weight_units: Json
          workouts: Json
        }
        Insert: {
          exercises?: Json
          id?: string
          programs?: Json
          updated_at?: string
          weight_units?: Json
          workouts?: Json
        }
        Update: {
          exercises?: Json
          id?: string
          programs?: Json
          updated_at?: string
          weight_units?: Json
          workouts?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_account_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id: string
          sender_account_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_account_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_account_id_fkey"
            columns: ["sender_account_id"]
            isOneToOne: false
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          account_id: string
          last_read_at: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          last_read_at?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          last_read_at?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          id: string
          last_message_at: string | null
          last_message_body: string | null
          last_message_sender_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_body?: string | null
          last_message_sender_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_body?: string | null
          last_message_sender_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_last_message_sender_id_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_picture_batches: {
        Row: {
          capture_date: string
          client_id: string
          created_at: string
          id: string
          preview_picture_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          capture_date: string
          client_id: string
          created_at?: string
          id: string
          preview_picture_id?: string | null
          timezone: string
          updated_at?: string
        }
        Update: {
          capture_date?: string
          client_id?: string
          created_at?: string
          id?: string
          preview_picture_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_picture_batches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_picture_batches_preview_picture_fkey"
            columns: ["preview_picture_id"]
            isOneToOne: false
            referencedRelation: "progress_pictures"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_pictures: {
        Row: {
          batch_id: string
          byte_size: number
          created_at: string
          display_order: number
          height: number
          id: string
          mime_type: string
          storage_path: string
          width: number
        }
        Insert: {
          batch_id: string
          byte_size: number
          created_at?: string
          display_order: number
          height: number
          id: string
          mime_type?: string
          storage_path: string
          width: number
        }
        Update: {
          batch_id?: string
          byte_size?: number
          created_at?: string
          display_order?: number
          height?: number
          id?: string
          mime_type?: string
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "progress_pictures_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "progress_picture_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          client_id: string
          completed_at: string
          completed_sets: number
          created_at: string
          duration_seconds: number
          id: string
          program_id: string | null
          session_data: Json
          started_at: string
          total_reps: number
          total_sets: number
          volume_by_unit: Json
          workout_id: string
          workout_name: string
        }
        Insert: {
          client_id: string
          completed_at?: string
          completed_sets: number
          created_at?: string
          duration_seconds: number
          id?: string
          program_id?: string | null
          session_data: Json
          started_at: string
          total_reps: number
          total_sets: number
          volume_by_unit?: Json
          workout_id: string
          workout_name: string
        }
        Update: {
          client_id?: string
          completed_at?: string
          completed_sets?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          program_id?: string | null
          session_data?: Json
          started_at?: string
          total_reps?: number
          total_sets?: number
          volume_by_unit?: Json
          workout_id?: string
          workout_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "app_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_client_onboarding: {
        Args: { p_answer: string; p_client_id: string }
        Returns: {
          onboarding_completed_at: string
          onboarding_step: number
          thread_id: string
        }[]
      }
      append_progress_pictures_to_batch: {
        Args: { p_batch_id: string; p_client_id: string; p_pictures: Json }
        Returns: string
      }
      can_access_chat_thread: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      can_read_client_account: {
        Args: { p_client_id: string }
        Returns: boolean
      }
      complete_client_onboarding: {
        Args: { p_client_id: string }
        Returns: string
      }
      create_progress_picture_batch: {
        Args: {
          p_batch_id: string
          p_capture_date: string
          p_client_id: string
          p_pictures: Json
          p_preview_picture_id: string
          p_timezone: string
        }
        Returns: string
      }
      get_chat_unread_counts: {
        Args: { p_account_id: string }
        Returns: {
          client_id: string
          unread_messages: number
        }[]
      }
      get_coach_profile: {
        Args: never
        Returns: {
          assigned_program_id: string
          created_at: string
          id: string
          is_preview: boolean
          name: string
          role: string
          username: string
        }[]
      }
      get_or_create_chat_thread: {
        Args: { p_client_id: string }
        Returns: string
      }
      initialize_client_onboarding: {
        Args: { p_client_id: string }
        Returns: {
          onboarding_completed_at: string
          onboarding_step: number
          thread_id: string
        }[]
      }
      is_app_coach: { Args: never; Returns: boolean }
      is_progress_picture_storage_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      mark_chat_read: {
        Args: { p_account_id: string; p_client_id: string }
        Returns: undefined
      }
      owns_app_account: { Args: { p_account_id: string }; Returns: boolean }
      send_chat_message: {
        Args: {
          p_body: string
          p_client_id: string
          p_message_id: string
          p_sender_account_id: string
        }
        Returns: string
      }
      set_progress_picture_preview: {
        Args: { p_batch_id: string; p_client_id: string; p_picture_id: string }
        Returns: undefined
      }
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
