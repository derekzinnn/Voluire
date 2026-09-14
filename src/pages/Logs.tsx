import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText } from "lucide-react";

const POR_PAGINA = 25;
const TODAS = "__todas__";

const ENTIDADE_LABELS: Record<string, string> = {
  acesso: "Acesso",
  vendas: "Vendas",
  venda_parcelas: "Parcelas",
  corretores: "Corretores",
  corretor_perfis: "Ficha do corretor",
  empreendimentos: "Empreendimentos",
  equipes: "Equipes",
  despesas: "Despesas",
  user_roles: "Funções",
};

const ACAO_COR: Record<string, string> = {
  criou: "bg-green-100 text-green-800",
  editou: "bg-blue-100 text-blue-800",
  excluiu: "bg-red-100 text-red-800",
};

export default function Logs() {
  const [busca, setBusca] = useState("");
  const [entidade, setEntidade] = useState(TODAS);
  const [pagina, setPagina] = useState(0);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["system-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_logs")
        .select("id, created_at, user_email, acao, entidade, entidade_id, descricao")
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
      return [l.user_email, l.acao, l.descricao, ENTIDADE_LABELS[l.entidade] ?? l.entidade]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(termo));
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
              placeholder="Buscar por usuário, ação..."
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
                <TableHead className="w-44">Data e hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="w-32">Ação</TableHead>
                <TableHead className="w-40">Onde</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((l: any) => (
                <TableRow key={l.id}>
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
              ))}
              {!isLoading && visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
