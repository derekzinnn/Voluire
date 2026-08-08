import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { CheckCircle } from "lucide-react";

const statusLabels: Record<string, string> = { a_receber: "A Receber", recebido: "Recebido", parcelado: "Parcelado", distrato: "Distrato" };
const statusColors: Record<string, string> = {
  a_receber: "bg-amber-100 text-amber-800",
  recebido: "bg-emerald-100 text-emerald-800",
  parcelado: "bg-blue-100 text-blue-800",
  distrato: "bg-red-100 text-red-800",
};

const MESES = Array.from({ length: 12 }, (_, i) => ({
  valor: i + 1,
  nome: new Date(2026, i).toLocaleString("pt-BR", { month: "long" }),
}));

export default function Comissoes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role, corretorId, isDiretor, isGestor } = useUserRole();
  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  const [mesGestor, setMesGestor] = useState<string>(String(hoje.getMonth() + 1));

  const ano = hoje.getFullYear();

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select(
          "*, vendas(numero_contrato, cliente_nome, valor, data_venda, status, forma_pagamento, empreendimento_id, empreendimentos(nome), venda_corretores(corretor_id, percentual_corretor, participacao_percentual, corretores(nome)))"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: gestorLinhas = [] } = useQuery({
    queryKey: ["comissao-gestor", ano, mesGestor],
    enabled: isGestor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("comissao_gestor_mensal", { p_ano: ano, p_mes: Number(mesGestor) });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const existing = comissoes.find((c: any) => c.id === id) as any;
      const update: any = { status };
      update.data_recebimento =
        status === "recebido" ? existing?.data_recebimento || new Date().toISOString().split("T")[0] : null;
      const { error } = await supabase.from("comissoes").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(
    () =>
      (comissoes as any[]).filter((c) => {
        const v = c.vendas;
        if (filtroMes !== "todos" && v?.data_venda) {
          const m = new Date(v.data_venda + "T12:00:00").getMonth() + 1;
          if (String(m) !== filtroMes) return false;
        }
        if (filtroCorretor !== "todos") {
          const tem = (v?.venda_corretores ?? []).some((vc: any) => vc.corretor_id === filtroCorretor);
          if (!tem) return false;
        }
        return true;
      }),
    [comissoes, filtroMes, filtroCorretor]
  );

  // Fatia do corretor logado (visão restrita)
  const minhaFatia = (c: any) => {
    const vc = (c.vendas?.venda_corretores ?? []).find((x: any) => x.corretor_id === corretorId);
    if (!vc) return 0;
    return (
      (Number(c.valor_total) || 0) *
      (Number(vc.percentual_corretor) || 0) / 100 *
      (Number(vc.participacao_percentual) || 100) / 100
    );
  };

  const soma = (list: any[], fn: (c: any) => number) => list.reduce((s, c) => s + fn(c), 0);
  const ativas = filtered.filter((c) => c.vendas?.status !== "distrato");

  const vendasBrutas = soma(ativas, (c) => Number(c.vendas?.valor) || 0);
  const comissaoBruta = soma(ativas, (c) => Number(c.valor_total) || 0);
  const totalCorretores = soma(ativas, (c) => Number(c.valor_corretores) || 0);
  const totalVoluire = soma(ativas, (c) => Number(c.valor_empresa) || 0);
  const meuTotal = soma(ativas, minhaFatia);
  const meuRecebido = soma(ativas.filter((c) => c.status === "recebido"), minhaFatia);

  const totalGestor = (gestorLinhas as any[]).reduce((s, l) => s + (Number(l.valor_gestor) || 0), 0);

  const soCorretor = role === "corretor";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {MESES.map((m) => <SelectItem key={m.valor} value={String(m.valor)}>{m.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        {!soCorretor && (
          <Select value={filtroCorretor} onValueChange={setFiltroCorretor}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Corretor" /></SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="todos">Todos corretores</SelectItem>
              {corretores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {soCorretor ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Minha comissão (total)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatCurrency(meuTotal)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Já recebido</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(meuRecebido)}</p></CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vendas brutas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatCurrency(vendasBrutas)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Comissão bruta</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatCurrency(comissaoBruta)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Corretores recebem</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-blue-600">{formatCurrency(totalCorretores)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Voluire recebe</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalVoluire)}</p></CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="contratos">
        <TabsList>
          <TabsTrigger value="contratos">Por contrato</TabsTrigger>
          {isGestor && <TabsTrigger value="gestor">Comissão do gestor</TabsTrigger>}
        </TabsList>

        <TabsContent value="contratos" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Corretores</TableHead>
                    {!soCorretor && <TableHead>Venda bruta</TableHead>}
                    {!soCorretor && <TableHead>Comissão bruta</TableHead>}
                    <TableHead>{soCorretor ? "Minha comissão" : "Corretores"}</TableHead>
                    {!soCorretor && <TableHead>Voluire</TableHead>}
                    <TableHead>Status</TableHead>
                    {isGestor && <TableHead>Ação</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => {
                    const v = c.vendas;
                    const parts = v?.venda_corretores ?? [];
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{v?.numero_contrato ?? "—"}</TableCell>
                        <TableCell>{v?.cliente_nome ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {parts.length === 0
                            ? "—"
                            : parts.map((p: any) => (
                                <span key={p.corretor_id} className="mr-2 whitespace-nowrap">
                                  {p.corretores?.nome}{" "}
                                  <span className="text-muted-foreground">
                                    ({formatPercent(Number(p.percentual_corretor))}
                                    {Number(p.participacao_percentual) !== 100 ? ` · ${formatPercent(Number(p.participacao_percentual))}` : ""})
                                  </span>
                                </span>
                              ))}
                        </TableCell>
                        {!soCorretor && <TableCell>{formatCurrency(Number(v?.valor) || 0)}</TableCell>}
                        {!soCorretor && <TableCell className="font-medium">{formatCurrency(Number(c.valor_total))}</TableCell>}
                        <TableCell className="text-blue-600">
                          {formatCurrency(soCorretor ? minhaFatia(c) : Number(c.valor_corretores))}
                        </TableCell>
                        {!soCorretor && <TableCell className="text-emerald-600">{formatCurrency(Number(c.valor_empresa))}</TableCell>}
                        <TableCell>
                          <Badge className={statusColors[c.status]}>{statusLabels[c.status] ?? c.status}</Badge>
                          {c.status === "recebido" && c.data_recebimento && (
                            <span className="ml-1 text-xs text-muted-foreground">· {formatDate(c.data_recebimento)}</span>
                          )}
                        </TableCell>
                        {isGestor && (
                          <TableCell>
                            {c.status !== "recebido" ? (
                              <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "recebido" })}>
                                <CheckCircle className="mr-1 h-4 w-4" />Recebido
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "a_receber" })}>
                                Reverter
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhuma comissão</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isGestor && (
          <TabsContent value="gestor" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={mesGestor} onValueChange={setMesGestor}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => <SelectItem key={m.valor} value={String(m.valor)}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Total do mês: <strong className="text-foreground">{formatCurrency(totalGestor)}</strong>
              </span>
            </div>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipe</TableHead>
                      <TableHead>VGV da equipe no mês</TableHead>
                      <TableHead>Comissão bruta gerada</TableHead>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Comissão do gestor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(gestorLinhas as any[]).map((l) => (
                      <TableRow key={l.equipe_id}>
                        <TableCell className="font-medium">{l.equipe_nome}</TableCell>
                        <TableCell>{formatCurrency(Number(l.vgv_equipe))}</TableCell>
                        <TableCell>{formatCurrency(Number(l.comissao_bruta_equipe))}</TableCell>
                        <TableCell>{formatPercent(Number(l.faixa_percentual))}</TableCell>
                        <TableCell className="font-semibold text-emerald-600">{formatCurrency(Number(l.valor_gestor))}</TableCell>
                      </TableRow>
                    ))}
                    {gestorLinhas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          Nenhuma equipe com movimento neste mês.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">
              O gestor não entra no faturamento da própria equipe: as vendas feitas por ele são remuneradas pelo split de corretor.
              As faixas (8% / 10% / 12%) são aplicadas sobre a comissão bruta gerada pela equipe no mês e podem ser editadas em Gestão de Usuários.
            </p>
          </TabsContent>
        )}
      </Tabs>
      {isDiretor && <div className="hidden" aria-hidden />}
      <div className="hidden">
        <Input aria-hidden />
      </div>
    </div>
  );
}
