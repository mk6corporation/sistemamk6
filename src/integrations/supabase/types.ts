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
      clientes: {
        Row: {
          categoria: string | null
          created_at: string
          estagio: string | null
          id: string
          inicio_contrato: string | null
          last_synced_at: string
          nome: string
          notion_last_edited_time: string | null
          notion_page_id: string
          operacional: Json | null
          plano: string | null
          removido_em: string | null
          updated_at: string
          valor_mensal: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          estagio?: string | null
          id?: string
          inicio_contrato?: string | null
          last_synced_at?: string
          nome: string
          notion_last_edited_time?: string | null
          notion_page_id: string
          operacional?: Json | null
          plano?: string | null
          removido_em?: string | null
          updated_at?: string
          valor_mensal?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          estagio?: string | null
          id?: string
          inicio_contrato?: string | null
          last_synced_at?: string
          nome?: string
          notion_last_edited_time?: string | null
          notion_page_id?: string
          operacional?: Json | null
          plano?: string | null
          removido_em?: string | null
          updated_at?: string
          valor_mensal?: number | null
        }
        Relationships: []
      }
      mudancas_estagio: {
        Row: {
          categoria_anterior: string | null
          categoria_nova: string | null
          cliente_id: string | null
          detectada_em: string
          estagio_anterior: string | null
          estagio_novo: string | null
          id: string
          nome_cliente: string
          notion_edited_at: string | null
          notion_page_id: string
          tipo_mudanca: string
        }
        Insert: {
          categoria_anterior?: string | null
          categoria_nova?: string | null
          cliente_id?: string | null
          detectada_em?: string
          estagio_anterior?: string | null
          estagio_novo?: string | null
          id?: string
          nome_cliente: string
          notion_edited_at?: string | null
          notion_page_id: string
          tipo_mudanca: string
        }
        Update: {
          categoria_anterior?: string | null
          categoria_nova?: string | null
          cliente_id?: string | null
          detectada_em?: string
          estagio_anterior?: string | null
          estagio_novo?: string | null
          id?: string
          nome_cliente?: string
          notion_edited_at?: string | null
          notion_page_id?: string
          tipo_mudanca?: string
        }
        Relationships: [
          {
            foreignKeyName: "mudancas_estagio_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          clientes_novos: number
          clientes_processados: number
          erro: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string
          mudancas_detectadas: number
          status: string
        }
        Insert: {
          clientes_novos?: number
          clientes_processados?: number
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          mudancas_detectadas?: number
          status?: string
        }
        Update: {
          clientes_novos?: number
          clientes_processados?: number
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          mudancas_detectadas?: number
          status?: string
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
