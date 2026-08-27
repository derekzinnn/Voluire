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
    PostgrestVersion: "14.17"
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
          created_at: string
          data_recebimento: string | null
          id: string
          observacao: string | null
          percentual_total: number
          status: string
          updated_at: string
          valor_corretores: number
          valor_empresa: number
          valor_total: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          data_recebimento?: string | null
          id?: string
          observacao?: string | null
          percentual_total?: number
          status?: string
          updated_at?: string
          valor_corretores?: number
          valor_empresa?: number
          valor_total?: number
          venda_id: string
        }
        Update: {
          created_at?: string
          data_recebimento?: string | null
          id?: string
          observacao?: string | null
          percentual_total?: number
          status?: string
          updated_at?: string
          valor_corretores?: number
          valor_empresa?: number
          valor_total?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: true
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
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
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
      gestor_faixas: {
        Row: {
          ativo: boolean
          base: string
          created_at: string
          faturamento_max: number | null
          faturamento_min: number
          id: string
          percentual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          base?: string
          created_at?: string
          faturamento_max?: number | null
          faturamento_min: number
          id?: string
          percentual: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          base?: string
          created_at?: string
          faturamento_max?: number | null
          faturamento_min?: number
          id?: string
          percentual?: number
          updated_at?: string
        }
        Relationships: []
      }
      parceiros: {
        Row: {
          ativo: boolean
          cnpj: string | null
          comissao_percentual: number
          created_at: string
          creci: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacao: string | null
          pix: string | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          comissao_percentual?: number
          created_at?: string
          creci?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacao?: string | null
          pix?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          comissao_percentual?: number
          created_at?: string
          creci?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          pix?: string | null
          telefone?: string | null
          tipo?: string
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
      venda_corretores: {
        Row: {
          corretor_id: string
          created_at: string
          id: string
          participacao_percentual: number
          percentual_corretor: number
          venda_id: string
        }
        Insert: {
          corretor_id: string
          created_at?: string
          id?: string
          participacao_percentual?: number
          percentual_corretor: number
          venda_id: string
        }
        Update: {
          corretor_id?: string
          created_at?: string
          id?: string
          participacao_percentual?: number
          percentual_corretor?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_corretores_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_corretores_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_parcelas: {
        Row: {
          created_at: string
          data_prevista: string
          data_recebimento: string | null
          dias_adiados: number
          id: string
          numero: number
          observacao: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          data_prevista: string
          data_recebimento?: string | null
          dias_adiados?: number
          id?: string
          numero?: number
          observacao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor: number
          venda_id: string
        }
        Update: {
          created_at?: string
          data_prevista?: string
          data_recebimento?: string | null
          dias_adiados?: number
          id?: string
          numero?: number
          observacao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_parcelas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          captador_corretor_id: string | null
          cliente_nome: string
          comissao_percentual_bruta: number
          created_at: string
          data_venda: string
          empreendimento_id: string | null
          forma_pagamento: string
          id: string
          numero_contrato: string
          observacao: string | null
          parceiro_id: string | null
          roi_trafego: string | null
          status: string
          unidade: string
          updated_at: string
          valor: number
        }
        Insert: {
          captador_corretor_id?: string | null
          cliente_nome: string
          comissao_percentual_bruta?: number
          created_at?: string
          data_venda?: string
          empreendimento_id?: string | null
          forma_pagamento?: string
          id?: string
          numero_contrato: string
          observacao?: string | null
          parceiro_id?: string | null
          roi_trafego?: string | null
          status?: string
          unidade: string
          updated_at?: string
          valor: number
        }
        Update: {
          captador_corretor_id?: string | null
          cliente_nome?: string
          comissao_percentual_bruta?: number
          created_at?: string
          data_venda?: string
          empreendimento_id?: string | null
          forma_pagamento?: string
          id?: string
          numero_contrato?: string
          observacao?: string | null
          parceiro_id?: string | null
          roi_trafego?: string | null
          status?: string
          unidade?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_captador_corretor_id_fkey"
            columns: ["captador_corretor_id"]
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
          {
            foreignKeyName: "vendas_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
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
      can_manage_venda: { Args: { p_venda_id: string }; Returns: boolean }
      can_view_corretor: { Args: { p_corretor_id: string }; Returns: boolean }
      can_view_venda: { Args: { p_venda_id: string }; Returns: boolean }
      comissao_gestor_mensal: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          comissao_bruta_equipe: number
          equipe_id: string
          equipe_nome: string
          faixa_percentual: number
          gestor_user_id: string
          valor_gestor: number
          vgv_equipe: number
        }[]
      }
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
      recalc_comissao_venda: {
        Args: { p_venda_id: string }
        Returns: undefined
      }
      resumo_dashboard_anual: {
        Args: { p_ano: number }
        Returns: {
          comissao_bruta: number
          corretores: number
          gestores: number
          mes: number
          qtd_vendas: number
          vgv: number
          vgv_quitado: number
          voluire: number
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
