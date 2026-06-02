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
      cliente_checkins: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          id: string
          observacoes: string | null
          registrado_por: string | null
          resposta_cliente: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
          resposta_cliente?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
          resposta_cliente?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_checkins_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_nps: {
        Row: {
          cliente_id: string
          comentario: string | null
          created_at: string
          id: string
          respondido_em: string
          score: number
          source: string | null
          source_id: string | null
        }
        Insert: {
          cliente_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          respondido_em?: string
          score: number
          source?: string | null
          source_id?: string | null
        }
        Update: {
          cliente_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          respondido_em?: string
          score?: number
          source?: string | null
          source_id?: string | null
        }
        Relationships: []
      }
      cliente_performance: {
        Row: {
          cliente_id: string
          created_at: string
          faturamento_atual: number | null
          faturamento_inicial: number | null
          faturamento_meta: number | null
          id: string
          leads_atual: number | null
          leads_inicial: number | null
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          faturamento_atual?: number | null
          faturamento_inicial?: number | null
          faturamento_meta?: number | null
          id?: string
          leads_atual?: number | null
          leads_inicial?: number | null
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          faturamento_atual?: number | null
          faturamento_inicial?: number | null
          faturamento_meta?: number | null
          id?: string
          leads_atual?: number | null
          leads_inicial?: number | null
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cliente_timeline_steps: {
        Row: {
          acao_mk6_itens: Json
          atrasado: boolean
          bloqueado: boolean
          cliente_entregue: boolean
          cliente_entregue_em: string | null
          cliente_id: string
          cliente_responsabilidade: string | null
          codigo: string
          created_at: string
          data_concluida: string | null
          data_prevista: string | null
          descricao: string | null
          dia_fim: number | null
          dia_inicio: number | null
          fase: string
          id: string
          mk6_entregue: boolean
          mk6_entregue_em: string | null
          mk6_responsabilidade: string | null
          observacoes: string | null
          ordem: number
          pronto_para_avancar: boolean
          responsavel: string | null
          semana: number | null
          status: string
          subtitulo: string | null
          tem_trava: boolean
          tipo: string
          titulo: string
          trava_descricao: string | null
          updated_at: string
        }
        Insert: {
          acao_mk6_itens?: Json
          atrasado?: boolean
          bloqueado?: boolean
          cliente_entregue?: boolean
          cliente_entregue_em?: string | null
          cliente_id: string
          cliente_responsabilidade?: string | null
          codigo: string
          created_at?: string
          data_concluida?: string | null
          data_prevista?: string | null
          descricao?: string | null
          dia_fim?: number | null
          dia_inicio?: number | null
          fase: string
          id?: string
          mk6_entregue?: boolean
          mk6_entregue_em?: string | null
          mk6_responsabilidade?: string | null
          observacoes?: string | null
          ordem: number
          pronto_para_avancar?: boolean
          responsavel?: string | null
          semana?: number | null
          status?: string
          subtitulo?: string | null
          tem_trava?: boolean
          tipo?: string
          titulo: string
          trava_descricao?: string | null
          updated_at?: string
        }
        Update: {
          acao_mk6_itens?: Json
          atrasado?: boolean
          bloqueado?: boolean
          cliente_entregue?: boolean
          cliente_entregue_em?: string | null
          cliente_id?: string
          cliente_responsabilidade?: string | null
          codigo?: string
          created_at?: string
          data_concluida?: string | null
          data_prevista?: string | null
          descricao?: string | null
          dia_fim?: number | null
          dia_inicio?: number | null
          fase?: string
          id?: string
          mk6_entregue?: boolean
          mk6_entregue_em?: string | null
          mk6_responsabilidade?: string | null
          observacoes?: string | null
          ordem?: number
          pronto_para_avancar?: boolean
          responsavel?: string | null
          semana?: number | null
          status?: string
          subtitulo?: string | null
          tem_trava?: boolean
          tipo?: string
          titulo?: string
          trava_descricao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_timeline_steps_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          adimplencia: string[] | null
          categoria: string | null
          created_at: string
          data_reuniao_cs: string | null
          estagio: string | null
          feedback_data: string | null
          fim_contrato: string | null
          financeiro_form_database_id: string | null
          financeiro_form_synced_at: string | null
          id: string
          info_venda_texto: string | null
          inicio_contrato: string | null
          last_synced_at: string
          nome: string
          notion_last_edited_time: string | null
          notion_page_id: string
          observacao: string | null
          operacional: Json | null
          orcamento_ads: number | null
          plano: string | null
          produtos_upsell: string[] | null
          proxima_otimizacao_formula: string | null
          removido_em: string | null
          resultado_renovacao: string | null
          satisfacao: string | null
          status_aceleracao_pro: string | null
          status_contrato_formula: string | null
          status_feedback_formula: string | null
          status_otimizacao_formula: string | null
          status_reuniao_formula: string | null
          step_atual_ordem: number | null
          tipo_projeto: string[] | null
          ultima_otimizacao: string | null
          ultima_reuniao_gestor: string | null
          updated_at: string
          valor_mensal: number | null
        }
        Insert: {
          adimplencia?: string[] | null
          categoria?: string | null
          created_at?: string
          data_reuniao_cs?: string | null
          estagio?: string | null
          feedback_data?: string | null
          fim_contrato?: string | null
          financeiro_form_database_id?: string | null
          financeiro_form_synced_at?: string | null
          id?: string
          info_venda_texto?: string | null
          inicio_contrato?: string | null
          last_synced_at?: string
          nome: string
          notion_last_edited_time?: string | null
          notion_page_id: string
          observacao?: string | null
          operacional?: Json | null
          orcamento_ads?: number | null
          plano?: string | null
          produtos_upsell?: string[] | null
          proxima_otimizacao_formula?: string | null
          removido_em?: string | null
          resultado_renovacao?: string | null
          satisfacao?: string | null
          status_aceleracao_pro?: string | null
          status_contrato_formula?: string | null
          status_feedback_formula?: string | null
          status_otimizacao_formula?: string | null
          status_reuniao_formula?: string | null
          step_atual_ordem?: number | null
          tipo_projeto?: string[] | null
          ultima_otimizacao?: string | null
          ultima_reuniao_gestor?: string | null
          updated_at?: string
          valor_mensal?: number | null
        }
        Update: {
          adimplencia?: string[] | null
          categoria?: string | null
          created_at?: string
          data_reuniao_cs?: string | null
          estagio?: string | null
          feedback_data?: string | null
          fim_contrato?: string | null
          financeiro_form_database_id?: string | null
          financeiro_form_synced_at?: string | null
          id?: string
          info_venda_texto?: string | null
          inicio_contrato?: string | null
          last_synced_at?: string
          nome?: string
          notion_last_edited_time?: string | null
          notion_page_id?: string
          observacao?: string | null
          operacional?: Json | null
          orcamento_ads?: number | null
          plano?: string | null
          produtos_upsell?: string[] | null
          proxima_otimizacao_formula?: string | null
          removido_em?: string | null
          resultado_renovacao?: string | null
          satisfacao?: string | null
          status_aceleracao_pro?: string | null
          status_contrato_formula?: string | null
          status_feedback_formula?: string | null
          status_otimizacao_formula?: string | null
          status_reuniao_formula?: string | null
          step_atual_ordem?: number | null
          tipo_projeto?: string[] | null
          ultima_otimizacao?: string | null
          ultima_reuniao_gestor?: string | null
          updated_at?: string
          valor_mensal?: number | null
        }
        Relationships: []
      }
      comprovantes: {
        Row: {
          cliente_id: string
          contrato_id: string
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string | null
          storage_path: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          cliente_id: string
          contrato_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string | null
          storage_path: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          cliente_id?: string
          contrato_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string | null
          storage_path?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comprovantes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comprovantes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          banco_recebimento: string | null
          cliente_id: string
          created_at: string
          dia_vencimento: number | null
          fee_mensal: number | null
          fim_contrato: string | null
          forma_pagamento: string | null
          id: string
          inicio_contrato: string | null
          observacoes: string | null
          produto_contratado: string | null
          status_recebimento: string | null
          tipo: Database["public"]["Enums"]["contrato_tipo"]
          tipo_projeto: string | null
          updated_at: string
          valor_recebido: number | null
          valor_total: number | null
        }
        Insert: {
          banco_recebimento?: string | null
          cliente_id: string
          created_at?: string
          dia_vencimento?: number | null
          fee_mensal?: number | null
          fim_contrato?: string | null
          forma_pagamento?: string | null
          id?: string
          inicio_contrato?: string | null
          observacoes?: string | null
          produto_contratado?: string | null
          status_recebimento?: string | null
          tipo?: Database["public"]["Enums"]["contrato_tipo"]
          tipo_projeto?: string | null
          updated_at?: string
          valor_recebido?: number | null
          valor_total?: number | null
        }
        Update: {
          banco_recebimento?: string | null
          cliente_id?: string
          created_at?: string
          dia_vencimento?: number | null
          fee_mensal?: number | null
          fim_contrato?: string | null
          forma_pagamento?: string | null
          id?: string
          inicio_contrato?: string | null
          observacoes?: string | null
          produto_contratado?: string | null
          status_recebimento?: string | null
          tipo?: Database["public"]["Enums"]["contrato_tipo"]
          tipo_projeto?: string | null
          updated_at?: string
          valor_recebido?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      dados_corporativos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade_uf: string | null
          cliente_id: string
          cnpj: string | null
          created_at: string
          email_comercial: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          razao_social: string | null
          representante_cpf: string | null
          representante_nome: string | null
          status_crm: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade_uf?: string | null
          cliente_id: string
          cnpj?: string | null
          created_at?: string
          email_comercial?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string | null
          representante_cpf?: string | null
          representante_nome?: string | null
          status_crm?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade_uf?: string | null
          cliente_id?: string
          cnpj?: string | null
          created_at?: string
          email_comercial?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string | null
          representante_cpf?: string | null
          representante_nome?: string | null
          status_crm?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dados_corporativos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_comercial_cliente: {
        Row: {
          cliente_id: string
          created_at: string
          cs_nome: string | null
          data_venda: string | null
          gestor_nome: string | null
          id: string
          observacoes: string | null
          pre_vendedor_nome: string | null
          pre_vendedor_user_id: string | null
          updated_at: string
          vendedor_nome: string | null
          vendedor_user_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          cs_nome?: string | null
          data_venda?: string | null
          gestor_nome?: string | null
          id?: string
          observacoes?: string | null
          pre_vendedor_nome?: string | null
          pre_vendedor_user_id?: string | null
          updated_at?: string
          vendedor_nome?: string | null
          vendedor_user_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          cs_nome?: string | null
          data_venda?: string | null
          gestor_nome?: string | null
          id?: string
          observacoes?: string | null
          pre_vendedor_nome?: string | null
          pre_vendedor_user_id?: string | null
          updated_at?: string
          vendedor_nome?: string | null
          vendedor_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_comercial_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_sync_erros: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          etapa: string | null
          id: string
          mensagem: string
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          etapa?: string | null
          id?: string
          mensagem: string
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          etapa?: string | null
          id?: string
          mensagem?: string
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
      nps_links: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          produto: string
          slug: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          produto: string
          slug: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          produto?: string
          slug?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projecoes_cliente: {
        Row: {
          ano: number
          cliente_id: string
          created_at: string
          id: string
          investimento: number
          mes: number
          observacoes: string | null
          params: Json
          realizado: Json
          updated_at: string
        }
        Insert: {
          ano: number
          cliente_id: string
          created_at?: string
          id?: string
          investimento?: number
          mes: number
          observacoes?: string | null
          params?: Json
          realizado?: Json
          updated_at?: string
        }
        Update: {
          ano?: number
          cliente_id?: string
          created_at?: string
          id?: string
          investimento?: number
          mes?: number
          observacoes?: string | null
          params?: Json
          realizado?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projecoes_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      rotina_recorrente: {
        Row: {
          cliente_id: string
          colaborador_user_id: string
          created_at: string
          data: string
          id: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          colaborador_user_id: string
          created_at?: string
          data: string
          id?: string
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          colaborador_user_id?: string
          created_at?: string
          data?: string
          id?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      vendedor_links: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          descricao: string | null
          id: string
          slug: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          slug: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          slug?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vendedor_motivos_perda_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      vendedor_profiles: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendedor_registros_diarios: {
        Row: {
          cliente_id: string
          cotacoes_enviadas: number
          created_at: string
          data: string
          faturamento_bruto: number
          follow_ups: number
          id: string
          leads_recebidos: number
          ligacoes: number
          motivos_perda: Json
          observacoes: string | null
          updated_at: string
          vendas_fechadas: number
          vendedor_user_id: string
        }
        Insert: {
          cliente_id: string
          cotacoes_enviadas?: number
          created_at?: string
          data?: string
          faturamento_bruto?: number
          follow_ups?: number
          id?: string
          leads_recebidos?: number
          ligacoes?: number
          motivos_perda?: Json
          observacoes?: string | null
          updated_at?: string
          vendas_fechadas?: number
          vendedor_user_id: string
        }
        Update: {
          cliente_id?: string
          cotacoes_enviadas?: number
          created_at?: string
          data?: string
          faturamento_bruto?: number
          follow_ups?: number
          id?: string
          leads_recebidos?: number
          ligacoes?: number
          motivos_perda?: Json
          observacoes?: string | null
          updated_at?: string
          vendas_fechadas?: number
          vendedor_user_id?: string
        }
        Relationships: []
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
      is_staff_user: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "financeiro" | "comercial" | "operacional" | "cs"
      contrato_tipo: "base" | "upsell" | "renovacao"
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
      app_role: ["admin", "financeiro", "comercial", "operacional", "cs"],
      contrato_tipo: ["base", "upsell", "renovacao"],
    },
  },
} as const
