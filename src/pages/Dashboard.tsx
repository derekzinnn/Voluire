import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, MESES } from "@/lib/format";
import { DollarSign, TrendingUp, CheckCircle, Clock, XCircle, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useUserRole } from "@/hooks/useUserRole";

const TRIMESTRES = [
  { value: 1, label: "1º Trimestre (Jan-Mar)", meses: [1, 2, 3] },
  { value: 2, label: "2º Trimestre (Abr-Jun)", meses: [4, 5, 6] },
  { value: 3, label: "3º Trimestre (Jul-Set)", meses: [7, 8, 9] },
  { value: 4, label: "4º Trimestre (Out-Dez)", meses: [10, 11, 12] },
];

const TODOS_MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface LinhaMes {
  mes: number;
  vgv: number;
  vgv_quitado: number;
  comissao_a_receber: number;
  comissao_recebida: number;
}

export default function Dashboard() {
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const trimestreAtual = Math.floor(new Date().getMonth() / 3) + 1;

  const { role, isGestor, isDiretor, loading: roleLoading } = useUserRole();
  const [trimestre, setTrimestre] = useState(trimestreAtual);
  const [periodoRanking, setPeriodoRanking] = useState("ano");

  // Uma única consulta agregada no banco cobre todos os cartões e o gráfico mensal.
  const { data: mensal = [] } = useQuery({
    queryKey: ["dashboard-mensal", ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_mensal", { p_ano: ano });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        mes: Number(r.mes),
        vgv: Number(r.vgv),
        vgv_quitado: Number(r.vgv_quitado),
        comissao_a_receber: Number(r.comissao_a_receber),
        comissao_recebida: Number(r.comissao_recebida),
      })) as LinhaMes[];
    },
  });

  const mesesRanking = useMemo(() => {
    if (periodoRanking === "ano") return TODOS_MESES;
    if (periodoRanking === "mes") return [mesAtual];
    if (periodoRanking.startsWith("tri")) {
      const t = Number(periodoRanking.replace("tri", ""));
      return TRIMESTRES.find((x) => x.value === t)?.meses ?? TODOS_MESES;
    }
    return [Number(periodoRanking.replace("m", ""))];
  }, [periodoRanking, mesAtual]);

  const { data: ranking = [] } = useQuery({
    queryKey: ["ranking-periodo", ano, mesesRanking],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ranking_periodo", { p_ano: ano, p_meses: mesesRanking });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ["totais-empresa", ano],
    enabled: isGestor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("totais_empresa", { p_ano: ano });
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["dashboard-vendas", ano],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas")
        .select("id, cliente_nome, unidade, valor, data_venda, status, corretores(nome), empreendimentos(nome)")
        .order("data_venda", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const mesesTri = TRIMESTRES.find((t) => t.value === trimestre)?.meses ?? [];
  const soma = (linhas: LinhaMes[], campo: keyof LinhaMes) => linhas.reduce((s, l) => s + Number(l[campo]), 0);
  const doTri = mensal.filter((l) => mesesTri.includes(l.mes));

  const vgvAno = soma(mensal, "vgv");
  const vgvQuitadoAno = soma(mensal, "vgv_quitado");
  const vgvTri = soma(doTri, "vgv");
  const vgvQuitadoTri = soma(doTri, "vgv_quitado");
  const aReceber = soma(mensal, "comissao_a_receber");
  const recebidas = soma(mensal, "comissao_recebida");

  const escopo = isDiretor ? "Empresa" : role === "gerente" ? "Minha equipe" : "Meus números";

  const stats = [
    { label: `VGV ${ano}`, value: formatCurrency(vgvAno), icon: TrendingUp, color: "text-primary" },
    { label: `VGV Quitado ${ano}`, value: formatCurrency(vgvQuitadoAno), icon: CheckCircle, color: "text-emerald-500" },
    { label: `VGV ${trimestre}º Tri`, value: formatCurrency(vgvTri), icon: TrendingUp, color: "text-primary" },
    { label: `VGV Quitado ${trimestre}º Tri`, value: formatCurrency(vgvQuitadoTri), icon: CheckCircle, color: "text-emerald-500" },
    { label: "Comissões a Receber", value: formatCurrency(aReceber), icon: Clock, color: "text-amber-500" },
    { label: "Comissões Recebidas", value: formatCurrency(recebidas), icon: DollarSign, color: "text-emerald-500" },
  ];

  const chartData = mensal.map((l) => ({
    mes: MESES[l.mes - 1].substring(0, 3),
    vgv: l.vgv,
    vgvQuitado: l.vgv_quitado,
  }));

  const distratos = vendas.filter((v: any) => v.status === "distrato");
  const empresaVgv = Number(empresa?.vgv ?? 0);
  const participacao = empresaVgv > 0 ? (vgvAno / empresaVgv) * 100 : 0;

  if (roleLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
          <Building2 className="h-3.5 w-3.5" /> {escopo} · {ano}
        </Badge>
        <Select value={String(trimestre)} onValueChange={(v) => setTrimestre(Number(v))}>
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIMESTRES.map((t) => (
              <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="visao">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao">Visão Geral</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="trimestres">Trimestres</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="visao" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {role === "gerente" && empresa && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Minha equipe x Empresa ({ano})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">VGV da equipe</p>
                    <p className="text-xl font-bold">{formatCurrency(vgvAno)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">VGV da empresa</p>
                    <p className="text-xl font-bold">{formatCurrency(empresaVgv)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Participação</p>
                    <p className="text-xl font-bold">{participacao.toFixed(1)}%</p>
                  </div>
                </div>
                <Progress value={Math.min(100, participacao)} />
                <p className="text-xs text-muted-foreground">
                  Os totais da empresa são exibidos apenas de forma agregada — sem detalhamento de outras equipes.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>VGV Mensal {ano}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="vgv" name="VGV Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vgvQuitado" name="VGV Quitado" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENDAS */}
        <TabsContent value="vendas" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendas recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empreendimento</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Corretor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.filter((v: any) => v.status !== "distrato").slice(0, 25).map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.cliente_nome}</TableCell>
                      <TableCell>{v.empreendimentos?.nome ?? "—"}</TableCell>
                      <TableCell>{v.unidade}</TableCell>
                      <TableCell>{v.corretores?.nome ?? "—"}</TableCell>
                      <TableCell>{formatDate(v.data_venda)}</TableCell>
                      <TableCell>{formatCurrency(Number(v.valor))}</TableCell>
                      <TableCell>
                        <Badge variant={v.status === "ativa" ? "default" : "secondary"}>{v.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vendas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        Nenhuma venda registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {distratos.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">Distratos ({distratos.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Empreendimento</TableHead>
                      <TableHead>Corretor</TableHead>
                      <TableHead>Data Venda</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distratos.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.cliente_nome}</TableCell>
                        <TableCell>{v.empreendimentos?.nome ?? "—"}</TableCell>
                        <TableCell>{v.corretores?.nome ?? "—"}</TableCell>
                        <TableCell>{formatDate(v.data_venda)}</TableCell>
                        <TableCell className="text-muted-foreground line-through">
                          {formatCurrency(Number(v.valor))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TRIMESTRES */}
        <TabsContent value="trimestres" className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRIMESTRES.map((t) => {
              const linhas = mensal.filter((l) => t.meses.includes(l.mes));
              return (
                <Card key={t.value} className={t.value === trimestre ? "border-primary" : undefined}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-xl font-bold">{formatCurrency(soma(linhas, "vgv"))}</p>
                    <p className="text-sm text-emerald-500">
                      Quitado: {formatCurrency(soma(linhas, "vgv_quitado"))}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhe mensal</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>VGV</TableHead>
                    <TableHead>VGV Quitado</TableHead>
                    <TableHead>Comissão a receber</TableHead>
                    <TableHead>Comissão recebida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mensal.map((l) => (
                    <TableRow key={l.mes} className={mesesTri.includes(l.mes) ? "bg-muted/40" : undefined}>
                      <TableCell className="font-medium">{MESES[l.mes - 1]}</TableCell>
                      <TableCell>{formatCurrency(l.vgv)}</TableCell>
                      <TableCell>{formatCurrency(l.vgv_quitado)}</TableCell>
                      <TableCell>{formatCurrency(l.comissao_a_receber)}</TableCell>
                      <TableCell>{formatCurrency(l.comissao_recebida)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RANKING */}
        <TabsContent value="ranking" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Ranking de corretores</CardTitle>
              <Select value={periodoRanking} onValueChange={setPeriodoRanking}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ano">Ano {ano}</SelectItem>
                  <SelectItem value="tri1">1º Trimestre</SelectItem>
                  <SelectItem value="tri2">2º Trimestre</SelectItem>
                  <SelectItem value="tri3">3º Trimestre</SelectItem>
                  <SelectItem value="tri4">4º Trimestre</SelectItem>
                  <SelectItem value="mes">Mês atual</SelectItem>
                  {MESES.map((m, i) => (
                    <SelectItem key={m} value={`m${i + 1}`}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="vgv">
                <TabsList className="mb-4">
                  <TabsTrigger value="vgv">VGV</TabsTrigger>
                  <TabsTrigger value="quitado">VGV Quitado</TabsTrigger>
                </TabsList>

                {(["vgv", "quitado"] as const).map((modo) => {
                  const campo = modo === "vgv" ? "vgv" : "vgv_quitado";
                  const campoQtd = modo === "vgv" ? "qtd_vendas" : "qtd_quitadas";
                  const lista = [...ranking]
                    .filter((r: any) => Number(r[campo]) > 0)
                    .sort((a: any, b: any) => Number(b[campo]) - Number(a[campo]));
                  return (
                    <TabsContent key={modo} value={modo} className="space-y-4">
                      {lista.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
                      ) : (
                        lista.map((r: any, idx: number) => (
                          <div key={r.corretor_id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-5 text-sm font-bold text-muted-foreground">{idx + 1}º</span>
                              <div>
                                <p className="font-medium">{r.corretor_nome}</p>
                                <p className="text-sm text-muted-foreground">
                                  {Number(r[campoQtd])} {Number(r[campoQtd]) === 1 ? "venda" : "vendas"}
                                </p>
                              </div>
                            </div>
                            <p className="font-semibold">{formatCurrency(Number(r[campo]))}</p>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
