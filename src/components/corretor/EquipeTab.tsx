import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { Users, UserCog, Percent } from "lucide-react";

interface Props {
  corretorId: string;
  equipeId: string | null;
  splitAtual: number;
  podeGerenciar?: boolean;
}

const SEM_EQUIPE = "__sem_equipe__";

export default function EquipeTab({ corretorId, equipeId, splitAtual, podeGerenciar = false }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [equipeSel, setEquipeSel] = useState<string>(equipeId ?? SEM_EQUIPE);
  const [split, setSplit] = useState<string>(String(splitAtual));

  useEffect(() => setEquipeSel(equipeId ?? SEM_EQUIPE), [equipeId]);
  useEffect(() => setSplit(String(splitAtual)), [splitAtual]);

  const { data: equipesDisponiveis = [] } = useQuery({
    queryKey: ["equipes-disponiveis"],
    enabled: podeGerenciar,
    queryFn: async () => {
      const { data } = await supabase.from("equipes").select("id, nome, ativo").order("nome");
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const valor = Number(split);
      const { error } = await supabase
        .from("corretores")
        .update({
          equipe_id: equipeSel === SEM_EQUIPE ? null : equipeSel,
          comissao_percentual: Number.isFinite(valor) ? Math.min(100, Math.max(0, valor)) : splitAtual,
        })
        .eq("id", corretorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corretor-detalhe", corretorId] });
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      queryClient.invalidateQueries({ queryKey: ["corretor-equipe-colegas"] });
      toast({ title: "Equipe e comissão atualizadas" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const { data: equipe } = useQuery({
    queryKey: ["corretor-equipe", equipeId],
    enabled: !!equipeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("equipes")
        .select("id, nome, gestor_user_id, ativo")
        .eq("id", equipeId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: gestor } = useQuery({
    queryKey: ["corretor-equipe-gestor", equipe?.gestor_user_id],
    enabled: !!equipe?.gestor_user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("corretores")
        .select("id, nome, email")
        .eq("user_id", equipe!.gestor_user_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: colegas = [] } = useQuery({
    queryKey: ["corretor-equipe-colegas", equipeId],
    enabled: !!equipeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("corretores")
        .select("id, nome, ativo, email")
        .eq("equipe_id", equipeId!)
        .order("nome");
      return data ?? [];
    },
  });

  // Histórico: cada participação de venda guarda o split aplicado no momento da venda.
  const { data: participacoes = [] } = useQuery({
    queryKey: ["corretor-splits", corretorId],
    queryFn: async () => {
      const { data } = await supabase
        .from("venda_corretores")
        .select("id, percentual_corretor, participacao_percentual, vendas(cliente_nome, data_venda, valor, comissao_percentual_bruta, numero_contrato, comissoes(status))")
        .eq("corretor_id", corretorId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });


  return (
    <div className="space-y-6">
      {podeGerenciar && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Equipe e comissão do corretor</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                salvar.mutate();
              }}
              className="flex flex-wrap items-end gap-4"
            >
              <div className="min-w-56 flex-1 space-y-2">
                <Label>Equipe</Label>
                <Select value={equipeSel} onValueChange={setEquipeSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value={SEM_EQUIPE}>Sem equipe</SelectItem>
                    {equipesDisponiveis.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                        {!e.ativo && " (inativa)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40 space-y-2">
                <Label>Comissão do corretor (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={split}
                  onChange={(e) => setSplit(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{equipe?.nome ?? "Sem equipe"}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1 text-muted-foreground">
                <UserCog className="h-3.5 w-3.5" /> Gestor
              </span>
              <span className="font-medium">{gestor?.nome ?? (equipe?.gestor_user_id ? "Definido" : "Não definido")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Situação</span>
              <span className="font-medium">{equipe ? (equipe.ativo ? "Ativa" : "Inativa") : "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4" /> Split de comissão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Split vigente do corretor</span>
              <span className="font-medium">{formatPercent(splitAtual)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Split vigente da empresa</span>
              <span className="font-medium">{formatPercent(100 - splitAtual)}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              O split é congelado no momento da venda — alterá-lo não muda comissões já geradas.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Colegas de equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {colegas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {equipeId ? "Nenhum outro corretor nesta equipe." : "Este corretor ainda não está em uma equipe."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {colegas.map((c) => (
                <Link key={c.id} to={`/corretores/${c.id}`}>
                  <Badge
                    variant={c.id === corretorId ? "default" : "secondary"}
                    className="cursor-pointer px-3 py-1 text-sm"
                  >
                    {c.nome}
                    {!c.ativo && " (inativo)"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Splits aplicados nas comissões</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Comissão total</TableHead>
                <TableHead>Split aplicado</TableHead>
                <TableHead>Corretor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comissoes.map((c: any) => {
                const total = Number(c.valor_total) || 0;
                const pct = total > 0 ? (Number(c.valor_corretor) / total) * 100 : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.vendas?.cliente_nome ?? "—"}</TableCell>
                    <TableCell>{c.vendas?.data_venda ? formatDate(c.vendas.data_venda) : "—"}</TableCell>
                    <TableCell>{formatCurrency(total)}</TableCell>
                    <TableCell>{formatPercent(pct)}</TableCell>
                    <TableCell>{formatCurrency(Number(c.valor_corretor))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "recebido" ? "default" : "secondary"}>
                        {c.status === "recebido" ? "Recebido" : "A receber"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {comissoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma comissão gerada para este corretor.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
