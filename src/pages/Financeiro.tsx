import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, MESES, parseLocalDate } from "@/lib/format";
import { FORMA_PAGAMENTO_LABELS } from "@/lib/vendas";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";

export default function Financeiro() {
  const [open, setOpen] = useState(false);
  const [filtroMes, setFiltroMes] = useState<string>((new Date().getMonth() + 1).toString());
  const [mesGerencial, setMesGerencial] = useState<string>((new Date().getMonth() + 1).toString());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState<string>(currentYear.toString());
  const anoNum = Number(ano);
  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i);

  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas", anoNum],
    queryFn: async () => {
      const { data } = await supabase.from("despesas").select("*").eq("ano", anoNum).order("mes").order("categoria");
      return data || [];
    },
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes-financeiro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("valor_total, valor_corretores, valor_empresa, percentual_total, status, data_recebimento, vendas(id, numero_contrato, cliente_nome, unidade, valor, data_venda, status, forma_pagamento)");
      return data || [];
    },
  });

  const { data: parcelas = [] } = useQuery({
    queryKey: ["parcelas-financeiro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("venda_parcelas")
        .select("id, venda_id, valor, status, data_recebimento, vendas(id, valor, status)");
      return data || [];
    },
  });

  const createDespesa = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("despesas").insert({
        categoria: formData.get("categoria") as string,
        descricao: formData.get("descricao") as string || null,
        valor: Number(formData.get("valor")),
        mes: Number(formData.get("mes")),
        ano: anoNum,
        tipo: formData.get("tipo") as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      setOpen(false);
      toast({ title: "Despesa cadastrada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteDespesa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      toast({ title: "Despesa removida" });
    },
  });

  const filteredEmpresa = despesas.filter(d => d.tipo === "empresa" && d.mes.toString() === filtroMes);
  const totalEmpresa = filteredEmpresa.reduce((s, d) => s + Number(d.valor), 0);

  // === Fluxo de Caixa: entradas efetivadas x Despesas ===
  // A receita da Voluire entra proporcionalmente a cada parcela recebida.
  // Vendas sem parcelas cadastradas usam a data de recebimento da comissão.
  const comissaoPorVenda = new Map<string, { empresa: number; vendaValor: number }>();
  comissoes.forEach((c: any) => {
    if (c.vendas?.id) {
      comissaoPorVenda.set(c.vendas.id, {
        empresa: Number(c.valor_empresa || 0),
        vendaValor: Number(c.vendas.valor || 0),
      });
    }
  });
  const vendasComParcelas = new Set(parcelas.map((p: any) => p.venda_id));

  const fluxoMensal = MESES.map((mes, i) => {
    const porParcelas = parcelas
      .filter((p: any) => {
        if (p.status !== "recebida" || !p.data_recebimento) return false;
        if (p.vendas?.status === "distrato") return false;
        const d = parseLocalDate(p.data_recebimento);
        return d?.getMonth() === i && d.getFullYear() === anoNum;
      })
      .reduce((s: number, p: any) => {
        const info = comissaoPorVenda.get(p.venda_id);
        if (!info || !info.vendaValor) return s;
        return s + info.empresa * (Number(p.valor) / info.vendaValor);
      }, 0);

    const porComissao = comissoes
      .filter((c: any) => {
        if (c.status !== "recebido" || !c.data_recebimento) return false;
        if (c.vendas?.id && vendasComParcelas.has(c.vendas.id)) return false;
        const d = parseLocalDate(c.data_recebimento);
        return d?.getMonth() === i && d.getFullYear() === anoNum;
      })
      .reduce((s: number, c: any) => s + Number(c.valor_empresa), 0);

    const faturamento = porParcelas + porComissao;

    const despesasMes = despesas
      .filter(d => d.mes === i + 1)
      .reduce((s, d) => s + Number(d.valor), 0);

    return {
      mes: mes.substring(0, 3),
      faturamento,
      despesas: despesasMes,
      saldo: faturamento - despesasMes,
    };
  });

  let saldoAcumulado = 0;
  const fluxoComAcumulado = fluxoMensal.map(f => {
    saldoAcumulado += f.saldo;
    return { ...f, acumulado: saldoAcumulado };
  });

  const totalFaturamentoAno = fluxoMensal.reduce((s, f) => s + f.faturamento, 0);
  const totalDespesasAno = fluxoMensal.reduce((s, f) => s + f.despesas, 0);
  const saldoAno = totalFaturamentoAno - totalDespesasAno;

  // === Mês Gerencial (Competência) ===
  // Toda venda entra INTEGRALMENTE no mês em que foi vendida, mesmo parcelada/financiada.
  const comissoesPorMes = (i: number) =>
    comissoes.filter(c => {
      const venda = (c as any).vendas;
      if (!venda || venda.status === "distrato") return false;
      const d = parseLocalDate(venda.data_venda);
      return d?.getMonth() === i && d.getFullYear() === anoNum;
    });

  const competenciaMensal = MESES.map((mes, i) => {
    const doMes = comissoesPorMes(i);
    const vgv = doMes.reduce((s, c) => s + (Number((c as any).vendas?.valor) || 0), 0);
    const comissaoBruta = doMes.reduce((s, c) => s + Number((c as any).valor_total || 0), 0);
    const corretores = doMes.reduce((s, c) => s + Number((c as any).valor_corretores || 0), 0);
    const receita = doMes.reduce((s, c) => s + Number(c.valor_empresa), 0);

    const despesasMes = despesas
      .filter(d => d.mes === i + 1)
      .reduce((s, d) => s + Number(d.valor), 0);

    return {
      mes: mes.substring(0, 3),
      mesIndex: i,
      qtd: doMes.length,
      vgv,
      comissaoBruta,
      corretores,
      receita,
      despesas: despesasMes,
      resultado: receita - despesasMes,
    };
  });

  let resultadoAcumulado = 0;
  const competenciaComAcumulado = competenciaMensal.map(f => {
    resultadoAcumulado += f.resultado;
    return { ...f, acumulado: resultadoAcumulado };
  });

  const totalReceitaCompAno = competenciaMensal.reduce((s, f) => s + f.receita, 0);
  const totalVgvCompAno = competenciaMensal.reduce((s, f) => s + f.vgv, 0);
  const totalComissaoBrutaAno = competenciaMensal.reduce((s, f) => s + f.comissaoBruta, 0);
  const totalCorretoresAno = competenciaMensal.reduce((s, f) => s + f.corretores, 0);
  const resultadoCompAno = totalReceitaCompAno - totalDespesasAno;

  const contratosDoMesGerencial = comissoesPorMes(Number(mesGerencial) - 1);
  const mesSel = competenciaMensal[Number(mesGerencial) - 1] ?? {
    qtd: 0, vgv: 0, comissaoBruta: 0, corretores: 0, receita: 0, despesas: 0, resultado: 0,
  };

  const DespesaTable = ({ items }: { items: typeof despesas }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Categoria</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(d => (
          <TableRow key={d.id}>
            <TableCell className="font-medium">{d.categoria}</TableCell>
            <TableCell>{d.descricao || "—"}</TableCell>
            <TableCell>{formatCurrency(Number(d.valor))}</TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={() => deleteDespesa.mutate(d.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma despesa</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="caixa">
        <TabsList>
          <TabsTrigger value="caixa">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="competencia">Mês Gerencial (Competência)</TabsTrigger>
        </TabsList>

        <TabsContent value="caixa" className="space-y-6 mt-6">
          <p className="text-sm text-muted-foreground">
            Considera a receita da Voluire <strong>efetivamente recebida</strong>: cada <strong>parcela quitada</strong> entra no mês do recebimento, proporcional ao valor do contrato. Vendas sem parcelas usam a data de recebimento da comissão. Despesas pelo mês lançado.
          </p>

          {/* Cards resumo do ano */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Faturamento {ano}</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalFaturamentoAno)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Despesas {ano}</CardTitle>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(totalDespesasAno)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Saldo {ano}</CardTitle>
                <Wallet className={`h-5 w-5 ${saldoAno >= 0 ? "text-emerald-500" : "text-destructive"}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${saldoAno >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {formatCurrency(saldoAno)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Fluxo de Caixa Mensal — {ano}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={fluxoComAcumulado}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="faturamento" name="Faturamento" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="acumulado" name="Saldo Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="competencia" className="space-y-6 mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="text-sm text-muted-foreground max-w-2xl">
              Visão <strong>bruta</strong> do mês: toda venda entra <strong>integralmente no mês em que foi vendida</strong>, mesmo que parcelada ou financiada (ex.: R$ 2.000 em 4x = R$ 2.000 no mês da venda). Diferente do fluxo de caixa, que segue as datas de recebimento.
            </p>
            <div className="flex gap-2 ml-auto shrink-0">
              <Select value={mesGerencial} onValueChange={setMesGerencial}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">VGV bruto — {MESES[Number(mesGerencial) - 1]}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(mesSel.vgv)}</p>
                <p className="text-xs text-muted-foreground mt-1">{mesSel.qtd} venda(s) · ano: {formatCurrency(totalVgvCompAno)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Comissão bruta — {MESES[Number(mesGerencial) - 1]}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(mesSel.comissaoBruta)}</p>
                <p className="text-xs text-muted-foreground mt-1">ano: {formatCurrency(totalComissaoBrutaAno)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Repasse corretores — {MESES[Number(mesGerencial) - 1]}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(mesSel.corretores)}</p>
                <p className="text-xs text-muted-foreground mt-1">ano: {formatCurrency(totalCorretoresAno)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Receita Voluire — {MESES[Number(mesGerencial) - 1]}</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(mesSel.receita)}</p>
                <p className="text-xs text-muted-foreground mt-1">ano: {formatCurrency(totalReceitaCompAno)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Despesas — {MESES[Number(mesGerencial) - 1]}</CardTitle>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(mesSel.despesas)}</p>
                <p className="text-xs text-muted-foreground mt-1">ano: {formatCurrency(totalDespesasAno)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Resultado — {MESES[Number(mesGerencial) - 1]}</CardTitle>
                <Wallet className={`h-5 w-5 ${mesSel.resultado >= 0 ? "text-emerald-500" : "text-destructive"}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${mesSel.resultado >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {formatCurrency(mesSel.resultado)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ano: {formatCurrency(resultadoCompAno)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Resultado Mensal por Competência — {ano}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={competenciaComAcumulado}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="receita" name="Receita (Competência)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="acumulado" name="Resultado Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Contratos de {MESES[Number(mesGerencial) - 1]} {ano} — valor integral</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor da venda</TableHead>
                    <TableHead className="text-right">Comissão bruta</TableHead>
                    <TableHead className="text-right">Corretores</TableHead>
                    <TableHead className="text-right">Voluire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratosDoMesGerencial.map((c: any) => (
                    <TableRow key={c.vendas.id}>
                      <TableCell className="font-medium">{c.vendas.numero_contrato}</TableCell>
                      <TableCell>{c.vendas.cliente_nome}</TableCell>
                      <TableCell>{FORMA_PAGAMENTO_LABELS[c.vendas.forma_pagamento] ?? c.vendas.forma_pagamento}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(Number(c.vendas.valor))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(c.valor_total))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(c.valor_corretores))}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(Number(c.valor_empresa))}</TableCell>
                    </TableRow>
                  ))}
                  {contratosDoMesGerencial.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma venda neste mês</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Despesas detalhadas por mês */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
        <div>
          <h2 className="text-lg font-semibold">Despesas Detalhadas</h2>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie as despesas do mês</p>
        </div>
        <div className="flex gap-2">
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Despesa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createDespesa.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
                <div className="space-y-2"><Label>Categoria</Label><Input name="categoria" required /></div>
                <div className="space-y-2"><Label>Descrição</Label><Input name="descricao" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Valor (R$)</Label><Input name="valor" type="number" step="0.01" required /></div>
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select name="mes" defaultValue={filtroMes}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MESES.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <input type="hidden" name="tipo" value="empresa" />
                <Button type="submit" className="w-full" disabled={createDespesa.isPending}>Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Despesas — {MESES[Number(filtroMes) - 1]}</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold">{formatCurrency(totalEmpresa)}</p></CardContent>
      </Card>

      <Card><CardContent className="p-0"><DespesaTable items={filteredEmpresa} /></CardContent></Card>
    </div>
  );
}
