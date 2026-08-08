import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Pencil } from "lucide-react";

const statusLabels: Record<string, string> = { a_receber: "A Receber", recebido: "Recebido", parcelado: "Parcelado", distrato: "Distrato" };
const statusColors: Record<string, string> = { a_receber: "bg-amber-100 text-amber-800", recebido: "bg-emerald-100 text-emerald-800", parcelado: "bg-blue-100 text-blue-800", distrato: "bg-red-100 text-red-800" };

// IDs dos corretores excluídos do cálculo do gerente geral
const GERENTE_EXCLUIDOS = [
  "ba68df50-e5f8-46f8-892c-d9e2af6ac38b", // Andressa Pedroso
  "11f999e0-d2d1-411d-9a6b-1d2d40e4c70b", // Caroline
];
const GERENTE_PERCENTUAL = 0.02; // 2% do valor da comissão total

export default function Comissoes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingComissao, setEditingComissao] = useState<any>(null);
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  const [filtroEmpreendimento, setFiltroEmpreendimento] = useState<string>("todos");

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes").select("*, corretores(nome, comissao_percentual), vendas(cliente_nome, valor, data_venda, empreendimento_id, empreendimentos(nome))").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["empreendimentos"],
    queryFn: async () => {
      const { data } = await supabase.from("empreendimentos").select("id, nome").order("nome");
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const existing = comissoes.find(c => c.id === id);
      const update: any = { status };

      if (status === "recebido") {
        update.data_recebimento = existing?.data_recebimento || new Date().toISOString().split("T")[0];
      } else {
        update.data_recebimento = null;
      }

      const { error } = await supabase.from("comissoes").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const updateComissao = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...fields } = data;
      const { error } = await supabase.from("comissoes").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      setEditingComissao(null);
      toast({ title: "Comissão atualizada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingComissao) return;
    updateComissao.mutate({
      id: editingComissao.id,
      percentual_total: editingComissao.percentual_total,
      valor_total: editingComissao.valor_total,
      valor_empresa: editingComissao.valor_empresa,
      valor_corretor: editingComissao.valor_corretor,
      status: editingComissao.status,
      observacao: editingComissao.observacao || null,
      data_recebimento: editingComissao.data_recebimento || null,
    });
  };

  const recalcValues = (percentual: number) => {
    if (!editingComissao) return;
    const vendaValor = Number((editingComissao.vendas as any)?.valor || 0);
    const corretorPct = Number((editingComissao.corretores as any)?.comissao_percentual || 50);
    const valorTotal = vendaValor * (percentual / 100);
    const valorCorretor = valorTotal * (corretorPct / 100);
    const valorEmpresa = valorTotal - valorCorretor;
    setEditingComissao({
      ...editingComissao,
      percentual_total: percentual,
      valor_total: Math.round(valorTotal * 100) / 100,
      valor_empresa: Math.round(valorEmpresa * 100) / 100,
      valor_corretor: Math.round(valorCorretor * 100) / 100,
    });
  };

  const filtered = comissoes.filter(c => {
    if (filtroMes !== "todos") {
      const dataVenda = (c.vendas as any)?.data_venda;
      if (dataVenda) {
        const m = new Date(dataVenda + "T12:00:00").getMonth() + 1;
        if (m.toString() !== filtroMes) return false;
      }
    }
    if (filtroCorretor !== "todos" && c.corretor_id !== filtroCorretor) return false;
    if (filtroEmpreendimento !== "todos" && (c.vendas as any)?.empreendimento_id !== filtroEmpreendimento) return false;
    return true;
  });

  const totalAReceber = filtered.filter(c => c.status === "a_receber").reduce((s, c) => s + Number(c.valor_empresa), 0);
  const totalRecebido = filtered.filter(c => c.status === "recebido").reduce((s, c) => s + Number(c.valor_empresa), 0);

  const calcGerente = (c: any) => {
    if (GERENTE_EXCLUIDOS.includes(c.corretor_id)) return 0;
    return Number(c.valor_total) * GERENTE_PERCENTUAL;
  };

  const totalGerenteRecebido = filtered
    .filter(c => c.status === "recebido")
    .reduce((s, c) => s + calcGerente(c), 0);
  const totalGerenteAReceber = filtered
    .filter(c => c.status === "a_receber")
    .reduce((s, c) => s + calcGerente(c), 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                {new Date(2026, i).toLocaleString("pt-BR", { month: "long" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroCorretor} onValueChange={setFiltroCorretor}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Corretor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos corretores</SelectItem>
            {corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEmpreendimento} onValueChange={setFiltroEmpreendimento}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empreendimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos empreend.</SelectItem>
            {empreendimentos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A Receber (Empresa)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{formatCurrency(totalAReceber)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recebido (Empresa)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRecebido)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gerente - A Receber</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{formatCurrency(totalGerenteAReceber)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gerente - Recebido</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalGerenteRecebido)}</p></CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingComissao} onOpenChange={(v) => !v && setEditingComissao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Comissão</DialogTitle></DialogHeader>
          {editingComissao && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Cliente: <strong>{(editingComissao.vendas as any)?.cliente_nome}</strong> — Venda: {formatCurrency(Number((editingComissao.vendas as any)?.valor || 0))}
              </div>
              <div className="space-y-2">
                <Label>Percentual Total (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingComissao.percentual_total}
                  onChange={e => recalcValues(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Total</Label>
                  <Input value={formatCurrency(editingComissao.valor_total)} disabled />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Empresa</Label>
                  <Input value={formatCurrency(editingComissao.valor_empresa)} disabled />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Corretor</Label>
                  <Input value={formatCurrency(editingComissao.valor_corretor)} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingComissao.status} onValueChange={v => setEditingComissao({ ...editingComissao, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_receber">A Receber</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Recebimento</Label>
                <Input
                  type="date"
                  value={editingComissao.data_recebimento || ""}
                  onChange={e => setEditingComissao({ ...editingComissao, data_recebimento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={editingComissao.observacao || ""}
                  onChange={e => setEditingComissao({ ...editingComissao, observacao: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateComissao.isPending}>Salvar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Corretor</TableHead>
                <TableHead>Total (6%)</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Corretor</TableHead>
                <TableHead>Gerente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const gerenteValor = calcGerente(c);
                return (
                <TableRow key={c.id}>
                  <TableCell>{(c.vendas as any)?.cliente_nome || "—"}</TableCell>
                  <TableCell>{(c.corretores as any)?.nome || "—"}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(Number(c.valor_total))}</TableCell>
                  <TableCell>{formatCurrency(Number(c.valor_empresa))}</TableCell>
                  <TableCell>{formatCurrency(Number(c.valor_corretor))}</TableCell>
                  <TableCell>{gerenteValor > 0 ? formatCurrency(gerenteValor) : "—"}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[c.status]}>{statusLabels[c.status]}</Badge>
                    {c.status === "recebido" && c.data_recebimento && (
                      <span className="text-xs text-muted-foreground ml-1">· {formatDate(c.data_recebimento)}</span>
                    )}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingComissao({ ...c })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {c.status !== "recebido" ? (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "recebido" })}>
                        <CheckCircle className="h-4 w-4 mr-1" />Recebido
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "a_receber" })}>
                        Reverter
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma comissão</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
