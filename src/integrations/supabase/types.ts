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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      informed_consents: {
        Row: {
          accepted: boolean | null
          accepted_at: string | null
          consent_type: string
          content: string
          created_at: string | null
          id: string
          patient_id: string
          signature_data: string | null
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string | null
          consent_type: string
          content: string
          created_at?: string | null
          id?: string
          patient_id: string
          signature_data?: string | null
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string | null
          consent_type?: string
          content?: string
          created_at?: string | null
          id?: string
          patient_id?: string
          signature_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "informed_consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_conversations: {
        Row: {
          content: string
          created_at: string | null
          id: string
          patient_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          patient_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          patient_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_recommendations: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          patient_id: string
          priority: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          id?: string
          patient_id: string
          priority: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          patient_id?: string
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_recommendations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_responses: {
        Row: {
          additional_concerns: string | null
          alcohol: boolean | null
          allergies: string | null
          created_at: string | null
          current_medications: string | null
          diet: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          exercise: string | null
          family_history: string | null
          has_allergies: boolean | null
          id: string
          medical_history: string | null
          patient_id: string
          previous_surgeries: string | null
          sleep_hours: number | null
          smoking: boolean | null
          stress_level: number | null
          updated_at: string | null
        }
        Insert: {
          additional_concerns?: string | null
          alcohol?: boolean | null
          allergies?: string | null
          created_at?: string | null
          current_medications?: string | null
          diet?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          exercise?: string | null
          family_history?: string | null
          has_allergies?: boolean | null
          id?: string
          medical_history?: string | null
          patient_id: string
          previous_surgeries?: string | null
          sleep_hours?: number | null
          smoking?: boolean | null
          stress_level?: number | null
          updated_at?: string | null
        }
        Update: {
          additional_concerns?: string | null
          alcohol?: boolean | null
          allergies?: string | null
          created_at?: string | null
          current_medications?: string | null
          diet?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          exercise?: string | null
          family_history?: string | null
          has_allergies?: boolean | null
          id?: string
          medical_history?: string | null
          patient_id?: string
          previous_surgeries?: string | null
          sleep_hours?: number | null
          smoking?: boolean | null
          stress_level?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          created_at: string | null
          dni: string
          email: string
          id: string
          name: string
          phone: string | null
          procedure: string | null
          procedure_date: string | null
          status: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          dni: string
          email: string
          id?: string
          name: string
          phone?: string | null
          procedure?: string | null
          procedure_date?: string | null
          status?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          dni?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          procedure?: string | null
          procedure_date?: string | null
          status?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      add_conversation_message_by_token: {
        Args: {
          message_content: string
          message_role: string
          patient_token: string
        }
        Returns: string
      }
      assign_admin_roles: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_patient_by_token: {
        Args: { patient_token: string }
        Returns: {
          birth_date: string
          created_at: string
          dni: string
          email: string
          id: string
          name: string
          phone: string
          procedure: string
          procedure_date: string
          status: string
          token: string
          updated_at: string
        }[]
      }
      get_patient_consents_by_token: {
        Args: { patient_token: string }
        Returns: {
          accepted: boolean
          accepted_at: string
          consent_type: string
          content: string
          created_at: string
          id: string
          patient_id: string
          signature_data: string
        }[]
      }
      get_patient_conversations_by_token: {
        Args: { patient_token: string }
        Returns: {
          content: string
          created_at: string
          id: string
          patient_id: string
          role: string
        }[]
      }
      get_patient_id_from_token: {
        Args: { patient_token: string }
        Returns: string
      }
      get_patient_recommendations_by_token: {
        Args: { patient_token: string }
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          patient_id: string
          priority: string
          title: string
        }[]
      }
      get_patient_responses_by_token: {
        Args: { patient_token: string }
        Returns: {
          additional_concerns: string
          alcohol: boolean
          allergies: string
          created_at: string
          current_medications: string
          diet: string
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relationship: string
          exercise: string
          family_history: string
          has_allergies: boolean
          id: string
          medical_history: string
          patient_id: string
          previous_surgeries: string
          sleep_hours: number
          smoking: boolean
          stress_level: number
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      setup_admin_users: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_consent_by_token: {
        Args: {
          consent_id: string
          is_accepted: boolean
          patient_token: string
          signature_data_param?: string
        }
        Returns: boolean
      }
      update_patient_by_token: {
        Args: {
          new_procedure_date?: string
          new_status?: string
          patient_token: string
        }
        Returns: boolean
      }
      verify_dni_and_get_token: {
        Args: { patient_dni: string }
        Returns: {
          token: string
        }[]
      }
      verify_patient_token_access: {
        Args: { patient_token: string; target_patient_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "Owner" | "Nurse"
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
      app_role: ["Owner", "Nurse"],
    },
  },
} as const
