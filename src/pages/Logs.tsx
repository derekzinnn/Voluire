import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";

const POR_PAGINA = 25;
const TODAS = "__todas__";

const ENTIDADE_LABELS: Record<string, string> = {
  acesso: "Acesso",
  vendas: "Vendas",
  venda_parcelas: "Parcelas",
  venda_corretores: "Corretores do contrato",
  comissoes: "Comissões",
  corretores: "Corretores",
  corretor_perfis: "Ficha do corretor",
  corretor_documentos: "Documentos do corretor",
  corretor_perfil_notas: "Notas do gestor",
  captacoes: "Captações",
  empreendimentos: "Empreendimentos",
  equipes: "Equipes",
  despesas: "Despesas",
  parceiros: "Parceiros",
  role_permissions: "Permissões",
  user_roles: "Funções",
};

const CAMPO_LABELS: Record<string, string> = {
  numero_contrato: "Nº do contrato",
  cliente_nome: "Cliente comprador",
  vendedor_nome: "Cliente vendedor",
  unidade: "Unidade",
  valor: "Valor",
  data_venda: "Data da venda",
  forma_pagamento: "Forma de pagamento",
  comissao_percentual_bruta: "Comissão bruta (%)",
  status: "Status",
  agenciador_tipo: "Agenciador",
  tem_parceria: "Venda em parceria",
  parceria_nome: "Nome da parceria",
  observacao: "Observação",
  roi_trafego: "ROI de tráfego",
  empreendimento_id: "Tipo de imóvel",
  captador_corretor_id: "Captador",
  corretor_id: "Corretor",
  percentual_corretor: "Comissão do corretor (%)",
  participacao_percentual: "Participação (%)",
  numero: "Parcela nº",
  tipo: "Tipo",
  data_prevista: "Data prevista",
  data_recebimento: "Data de recebimento",
  dias_adiados: "Dias adiados",
  percentual_total: "Comissão total (%)",
  valor_total: "Valor total",
  valor_corretores: "Valor dos corretores",
  valor_empresa: "Valor da Voluire",
  nome: "Nome",
  email: "E-mail",
  ativo: "Ativo",
  comissao_percentual: "Comissão (%)",
  equipe_id: "Equipe",
  user_id: "Usuário",
  role: "Função",
  permission: "Permissão",
  allowed: "Permitido",
  categoria: "Categoria",
  descricao: "Descrição",
  mes: "Mês",
  ano: "Ano",
  cpf: "CPF",
  telefone_pessoal: "Telefone",
  email_pessoal: "E-mail pessoal",
  creci: "CRECI",
  data_nascimento: "Data de nascimento",
  observacoes: "Observações",
};

const ACAO_COR: Record<string, string> = {
  criou: "bg-green-100 text-green-800",
  editou: "bg-blue-100 text-blue-800",
  excluiu: "bg-red-100 text-red-800",
};

const OCULTOS = new Set(["id", "created_at", "updated_at"]);

function rotulo(campo: string) {
  return CAMPO_LABELS[campo] ?? campo.replace(/_/g, " ");
}

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("/");
  return s;
}

type Alteracao = { campo: string; antes: unknown; depois: unknown };

function DetalheLog({ log }: { log: any }) {
  const det = log.detalhes ?? {};
  const alteracoes: Alteracao[] = Array.isArray(det.alteracoes) ? det.alteracoes : [];
  const snapshot: Record<string, unknown> | null =
    log.acao === "criou" ? det.depois : log.acao === "excluiu" ? det.antes : null;

  if (alteracoes.length > 0) {
    return (
      <div className="space-y-2 py-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {alteracoes.length} campo(s) alterado(s)
        </p>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left">Campo</th>
                <th className="px-3 py-1.5 text-left">Antes</th>
                <th className="px-3 py-1.5 text-left">Depois</th>
              </tr>
            </thead>
            <tbody>
              {alteracoes
                .filter((a) => !OCULTOS.has(a.campo))
                .map((a) => (
                  <tr key={a.campo} className="border-t">
                    <td className="px-3 py-1.5 font-medium">{rotulo(a.campo)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground line-through">{valorLegivel(a.antes)}</td>
                    <td className="px-3 py-1.5">{valorLegivel(a.depois)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (snapshot) {
    const entradas = Object.entries(snapshot).filter(([k]) => !OCULTOS.has(k));
    return (
      <div className="grid gap-x-6 gap-y-1 py-2 sm:grid-cols-2 lg:grid-cols-3">
        {entradas.map(([k, v]) => (
          <p key={k} className="text-sm">
            <span className="text-muted-foreground">{rotulo(k)}: </span>
            <span className="font-medium">{valorLegivel(v)}</span>
          </p>
        ))}
      </div>
    );
  }

  return <p className="py-2 text-sm text-muted-foreground">Sem detalhes adicionais.</p>;
}

export default function Logs() {
  const [busca, setBusca] = useState("");
  const [entidade, setEntidade] = useState(TODAS);
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["system-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_logs")
        .select("id, created_at, user_email, acao, entidade, entidade_id, descricao, detalhes")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (logs as any[]).filter((l) => {
      if (entidade !== TODAS && l.entidade !== entidade) return false;
      if (!termo) return true;
      const alvo = [
        l.user_email,
        l.acao,
        l.descricao,
        ENTIDADE_LABELS[l.entidade] ?? l.entidade,
        l.detalhes ? JSON.stringify(l.detalhes) : "",
      ].filter(Boolean) as string[];
      return alvo.some((v) => v.toLowerCase().includes(termo));
    });
  }, [logs, busca, entidade]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtrados.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Histórico do sistema
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Buscar por usuário, ação, valor..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
              className="w-56"
            />
            <Select value={entidade} onValueChange={(v) => { setEntidade(v); setPagina(0); }}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todos os registros</SelectItem>
                {Object.entries(ENTIDADE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-44">Data e hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-32">Ação</TableHead>
                <TableHead className="w-40">Onde</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((l: any) => {
                const expandivel = !!l.detalhes;
                const expandido = aberto === l.id;
                return (
                  <Fragment key={l.id}>
                    <TableRow
                      className={expandivel ? "cursor-pointer" : undefined}
                      onClick={() => expandivel && setAberto(expandido ? null : l.id)}
                    >
                      <TableCell className="text-muted-foreground">
                        {expandivel ? (
                          expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">{l.user_email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={ACAO_COR[l.acao] ?? "bg-muted text-muted-foreground"}>{l.acao}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ENTIDADE_LABELS[l.entidade] ?? l.entidade ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.descricao ?? "—"}</TableCell>
                    </TableRow>
                    {expandido && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={5}>
                          <DetalheLog log={l} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {!isLoading && visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {paginaAtual + 1} de {totalPaginas} · {filtrados.length} registros
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina(paginaAtual + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
