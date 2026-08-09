import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { formatCurrency, MESES } from "@/lib/format";
import { TrendingUp, Users, Briefcase, Building2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useUserRole } from "@/hooks/useUserRole";

interface ResumoMes {
  mes: number;
  vgv: number;
  vgv_quitado: number;
  comissao_bruta: number;
  corretores: number;
  gestores: number;
  voluire: number;
  qtd_vendas: number;
}

export default function Dashboard() {
  const anoAtual = new Date().getFullYear();
  const { role, isGestor, loading: roleLoading } = useUserRole();
  const [anoSel, setAnoSel] = useState(anoAtual);

  const { data: resumo = [] } = useQuery({
    queryKey: ["resumo-dashboard", anoSel],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resumo_dashboard_anual", { p_ano: anoSel });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        mes: Number(r.mes),
        vgv: Number(r.vgv),
        vgv_quitado: Number(r.vgv_quitado),
        comissao_bruta: Number(r.comissao_bruta),
        corretores: Number(r.corretores),
        gestores: Number(r.gestores),
        voluire: Number(r.voluire),
        qtd_vendas: Number(r.qtd_vendas),
      })) as ResumoMes[];
    },
  });

  const totais = useMemo(
    () => ({
      vgv: resumo.reduce((s, r) => s + r.vgv, 0),
      vgv_quitado: resumo.reduce((s, r) => s + r.vgv_quitado, 0),
      comissao_bruta: resumo.reduce((s, r) => s + r.comissao_bruta, 0),
      corretores: resumo.reduce((s, r) => s + r.corretores, 0),
      gestores: resumo.reduce((s, r) => s + r.gestores, 0),
      voluire: resumo.reduce((s, r) => s + r.voluire, 0),
      qtd: resumo.reduce((s, r) => s + r.qtd_vendas, 0),
    }),
    [resumo]
  );

  const chartData = resumo.map((r) => ({
    mes: MESES[r.mes - 1].substring(0, 3),
    corretores: r.corretores,
    gestores: r.gestores,
    voluire: r.voluire,
  }));

  const escopo = role === "diretor" ? "Empresa" : role === "gerente" ? "Minha equipe" : "Meus números";
  const anos = [anoAtual, anoAtual - 1, anoAtual - 2];

  if (roleLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const AnoSeletor = () => (
    <Select value={String(anoSel)} onValueChange={(v) => setAnoSel(Number(v))}>
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {anos.map((y) => (
          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // === Corretor: vê apenas suas vendas e o que vai receber ===
  if (!isGestor) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
            <Building2 className="h-3.5 w-3.5" /> {escopo} · {anoSel}
          </Badge>
          <AnoSeletor />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Meu VGV bruto</CardTitle>
              <TrendingUp className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totais.vgv)}</p>
              <p className="text-xs text-muted-foreground">{totais.qtd} vendas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Meu VGV quitado</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totais.vgv_quitado)}</p>
              <p className="text-xs text-muted-foreground">{pctQuitado} do VGV bruto</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">O que vou receber</CardTitle>
              <Users className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totais.corretores)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Minhas comissões por mês — {anoSel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="corretores" name="Comissão" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === Diretor / Gerente: vê vendas brutas, corretores, gestores e voluire ===
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
          <Building2 className="h-3.5 w-3.5" /> {escopo} · {anoSel}
        </Badge>
        <AnoSeletor />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas brutas</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totais.vgv)}</p>
            <p className="text-xs text-muted-foreground">{totais.qtd} vendas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Corretores (geral)</CardTitle>
            <Users className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totais.corretores)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gestores (geral)</CardTitle>
            <Briefcase className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totais.gestores)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Voluire (restante)</CardTitle>
            <Building2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totais.voluire)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição de comissões por mês — {anoSel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="corretores" name="Corretores" stackId="a" fill="#10b981" />
                <Bar dataKey="gestores" name="Gestores" stackId="a" fill="#f59e0b" />
                <Bar dataKey="voluire" name="Voluire" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
