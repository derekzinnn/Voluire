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
      captacoes: {
        Row: {
          corretor_id: string | null
          created_at: string
          data_captacao: string
          empreendimento_id: string | null
          endereco: string | null
          id: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string
          data_captacao?: string
          empreendimento_id?: string | null
          endereco?: string | null
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          corretor_id?: string | null
          created_at?: string
          data_captacao?: string
          empreendimento_id?: string | null
          endereco?: string | null
          id?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captacoes_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          corretor_id: string | null
          created_at: string
          data_recebimento: string | null
          id: string
          observacao: string | null
          percentual_total: number
          status: string
          updated_at: string
          valor_corretor: number
          valor_empresa: number
          valor_total: number
          venda_id: string
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          id?: string
          observacao?: string | null
          percentual_total?: number
          status?: string
          updated_at?: string
          valor_corretor: number
          valor_empresa: number
          valor_total: number
          venda_id: string
        }
        Update: {
          corretor_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          id?: string
          observacao?: string | null
          percentual_total?: number
          status?: string
          updated_at?: string
          valor_corretor?: number
          valor_empresa?: number
          valor_total?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_documentos: {
        Row: {
          corretor_id: string
          cpf: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          corretor_id: string
          cpf?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          corretor_id?: string
          cpf?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_documentos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: true
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_perfil_notas: {
        Row: {
          corretor_id: string
          created_at: string
          id: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          corretor_id: string
          created_at?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          corretor_id?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_perfil_notas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: true
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_perfis: {
        Row: {
          corretor_id: string
          created_at: string
          creci: string | null
          data_admissao: string | null
          data_nascimento: string | null
          disc_conformidade: number | null
          disc_dominancia: number | null
          disc_estabilidade: number | null
          disc_influencia: number | null
          email_pessoal: string | null
          foto_url: string | null
          id: string
          telefone_pessoal: string | null
          updated_at: string
        }
        Insert: {
          corretor_id: string
          created_at?: string
          creci?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          disc_conformidade?: number | null
          disc_dominancia?: number | null
          disc_estabilidade?: number | null
          disc_influencia?: number | null
          email_pessoal?: string | null
          foto_url?: string | null
          id?: string
          telefone_pessoal?: string | null
          updated_at?: string
        }
        Update: {
          corretor_id?: string
          created_at?: string
          creci?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          disc_conformidade?: number | null
          disc_dominancia?: number | null
          disc_estabilidade?: number | null
          disc_influencia?: number | null
          email_pessoal?: string | null
          foto_url?: string | null
          id?: string
          telefone_pessoal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_perfis_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: true
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      corretores: {
        Row: {
          ativo: boolean
          comissao_percentual: number
          created_at: string
          email: string | null
          equipe_id: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          comissao_percentual?: number
          created_at?: string
          email?: string | null
          equipe_id?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          comissao_percentual?: number
          created_at?: string
          email?: string | null
          equipe_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corretores_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          ano: number
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          mes: number
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          categoria: string
          created_at?: string
          descricao?: string | null
          id?: string
          mes: number
          tipo?: string
          updated_at?: string
          valor: number
        }
        Update: {
          ano?: number
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          mes?: number
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      empreendimentos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipes: {
        Row: {
          ativo: boolean
          created_at: string
          gestor_user_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          gestor_user_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          gestor_user_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      metas: {
        Row: {
          ano: number
          categoria: string
          corretor_id: string | null
          created_at: string
          id: string
          mes: number | null
          tipo: string
          trimestre: number | null
          updated_at: string
          valor: number
        }
        Insert: {
          ano: number
          categoria?: string
          corretor_id?: string | null
          created_at?: string
          id?: string
          mes?: number | null
          tipo: string
          trimestre?: number | null
          updated_at?: string
          valor: number
        }
        Update: {
          ano?: number
          categoria?: string
          corretor_id?: string | null
          created_at?: string
          id?: string
          mes?: number | null
          tipo?: string
          trimestre?: number | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_etapas: {
        Row: {
          ativa: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_progresso: {
        Row: {
          concluido: boolean
          corretor_id: string
          created_at: string
          data_conclusao: string | null
          etapa_id: string
          id: string
          responsavel_user_id: string | null
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          corretor_id: string
          created_at?: string
          data_conclusao?: string | null
          etapa_id: string
          id?: string
          responsavel_user_id?: string | null
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          corretor_id?: string
          created_at?: string
          data_conclusao?: string | null
          etapa_id?: string
          id?: string
          responsavel_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progresso_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progresso_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "onboarding_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      placar_entregas: {
        Row: {
          ano: number
          corretor_id: string
          created_at: string
          data_entrega: string
          id: string
          semana_inicio: string
          tarefa_id: string
          trimestre: number
        }
        Insert: {
          ano: number
          corretor_id: string
          created_at?: string
          data_entrega?: string
          id?: string
          semana_inicio: string
          tarefa_id: string
          trimestre: number
        }
        Update: {
          ano?: number
          corretor_id?: string
          created_at?: string
          data_entrega?: string
          id?: string
          semana_inicio?: string
          tarefa_id?: string
          trimestre?: number
        }
        Relationships: [
          {
            foreignKeyName: "placar_entregas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placar_entregas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "placar_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      placar_tarefas: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          pontos: number
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome: string
          pontos?: number
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
          pontos?: number
          updated_at?: string
        }
        Relationships: []
      }
      trafego_pago: {
        Row: {
          ano: number
          created_at: string
          custo: number
          custo_por_lead: number | null
          id: string
          leads_gerados: number | null
          mes: number
          plataforma: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          custo: number
          custo_por_lead?: number | null
          id?: string
          leads_gerados?: number | null
          mes: number
          plataforma: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          custo?: number
          custo_por_lead?: number | null
          id?: string
          leads_gerados?: number | null
          mes?: number
          plataforma?: string
          updated_at?: string
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
      vendas: {
        Row: {
          cliente_nome: string
          corretor_id: string | null
          created_at: string
          data_venda: string
          empreendimento_id: string | null
          id: string
          roi_trafego: string | null
          status: string
          unidade: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_nome: string
          corretor_id?: string | null
          created_at?: string
          data_venda: string
          empreendimento_id?: string | null
          id?: string
          roi_trafego?: string | null
          status?: string
          unidade: string
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_nome?: string
          corretor_id?: string | null
          created_at?: string
          data_venda?: string
          empreendimento_id?: string | null
          id?: string
          roi_trafego?: string | null
          status?: string
          unidade?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_corretor: { Args: { p_corretor_id: string }; Returns: boolean }
      can_view_corretor: { Args: { p_corretor_id: string }; Returns: boolean }
      dashboard_mensal: {
        Args: { p_ano: number }
        Returns: {
          comissao_a_receber: number
          comissao_recebida: number
          mes: number
          vgv: number
          vgv_quitado: number
        }[]
      }
      get_corretor_cpf: { Args: { p_corretor_id: string }; Returns: string }
      get_my_corretor_id: { Args: never; Returns: string }
      get_my_equipe_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_diretor_or_gerente: { Args: never; Returns: boolean }
      list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      ranking_corretores: {
        Args: { p_status?: string }
        Returns: {
          corretor_id: string
          corretor_nome: string
          total_vendas: number
          total_vgv: number
        }[]
      }
      ranking_periodo: {
        Args: { p_ano: number; p_meses: number[] }
        Returns: {
          corretor_id: string
          corretor_nome: string
          qtd_quitadas: number
          qtd_vendas: number
          vgv: number
          vgv_quitado: number
        }[]
      }
      totais_empresa: {
        Args: { p_ano: number }
        Returns: {
          qtd_vendas: number
          vgv: number
          vgv_quitado: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "corretor" | "financeiro" | "diretor" | "gerente"
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
      app_role: ["admin", "corretor", "financeiro", "diretor", "gerente"],
    },
  },
} as const
