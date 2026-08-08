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
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";

export default function Financeiro() {
  const [open, setOpen] = useState(false);
  const [filtroMes, setFiltroMes] = useState<string>((new Date().getMonth() + 1).toString());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data } = await supabase.from("despesas").select("*").eq("ano", currentYear).order("mes").order("categoria");
      return data || [];
    },
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes-financeiro"],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes").select("valor_empresa, status, data_recebimento, vendas(data_venda, status)");
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
        ano: currentYear,
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

  // === Fluxo de Caixa: Faturamento (comissões recebidas) x Despesas ===
  const fluxoMensal = MESES.map((mes, i) => {
    const faturamento = comissoes
      .filter(c => {
        if (c.status !== "recebido" || !c.data_recebimento) return false;
        const d = parseLocalDate(c.data_recebimento);
        return d?.getMonth() === i && d.getFullYear() === currentYear;
      })
      .reduce((s, c) => s + Number(c.valor_empresa), 0);

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

  // === Mês Gerencial (Competência): receita = comissão da empresa pela data_venda, despesa = mes lançado ===
  const competenciaMensal = MESES.map((mes, i) => {
    const receita = comissoes
      .filter(c => {
        const venda = (c as any).vendas;
        if (!venda || venda.status === "distrato") return false;
        const d = parseLocalDate(venda.data_venda);
        return d?.getMonth() === i && d.getFullYear() === currentYear;
      })
      .reduce((s, c) => s + Number(c.valor_empresa), 0);

    const despesasMes = despesas
      .filter(d => d.mes === i + 1)
      .reduce((s, d) => s + Number(d.valor), 0);

    return {
      mes: mes.substring(0, 3),
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
  const resultadoCompAno = totalReceitaCompAno - totalDespesasAno;

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
            Considera comissões da empresa <strong>efetivamente recebidas</strong> (pela data de recebimento) e despesas pelo mês lançado. Útil para acompanhar entradas e saídas reais.
          </p>

          {/* Cards resumo do ano */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Faturamento {currentYear}</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalFaturamentoAno)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Despesas {currentYear}</CardTitle>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(totalDespesasAno)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Saldo {currentYear}</CardTitle>
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
            <CardHeader><CardTitle>Fluxo de Caixa Mensal — {currentYear}</CardTitle></CardHeader>
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

          <Card>
            <CardHeader><CardTitle>Detalhamento Mensal</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Saldo do Mês</TableHead>
                    <TableHead className="text-right">Saldo Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fluxoComAcumulado.map(f => (
                    <TableRow key={f.mes}>
                      <TableCell className="font-medium">{f.mes}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(f.faturamento)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(f.despesas)}</TableCell>
                      <TableCell className={`text-right font-semibold ${f.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(f.saldo)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${f.acumulado >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(f.acumulado)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(totalFaturamentoAno)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(totalDespesasAno)}</TableCell>
                    <TableCell className={`text-right ${saldoAno >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {formatCurrency(saldoAno)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencia" className="space-y-6 mt-6">
          <p className="text-sm text-muted-foreground">
            Considera <strong>tudo que aconteceu no mês</strong>: receita = comissão da empresa de todas as vendas do mês (mesmo a receber/parceladas) e despesas lançadas. Útil para medir o resultado real do mês.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Receita {currentYear}</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalReceitaCompAno)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Despesas {currentYear}</CardTitle>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{formatCurrency(totalDespesasAno)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Resultado {currentYear}</CardTitle>
                <Wallet className={`h-5 w-5 ${resultadoCompAno >= 0 ? "text-emerald-500" : "text-destructive"}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${resultadoCompAno >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {formatCurrency(resultadoCompAno)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Resultado Mensal por Competência — {currentYear}</CardTitle></CardHeader>
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
            <CardHeader><CardTitle>Detalhamento Mensal</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Resultado do Mês</TableHead>
                    <TableHead className="text-right">Resultado Acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competenciaComAcumulado.map(f => (
                    <TableRow key={f.mes}>
                      <TableCell className="font-medium">{f.mes}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(f.receita)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(f.despesas)}</TableCell>
                      <TableCell className={`text-right font-semibold ${f.resultado >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(f.resultado)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${f.acumulado >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(f.acumulado)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(totalReceitaCompAno)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatCurrency(totalDespesasAno)}</TableCell>
                    <TableCell className={`text-right ${resultadoCompAno >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {formatCurrency(resultadoCompAno)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
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
