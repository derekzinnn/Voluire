import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { formatCurrency, MESES } from "@/lib/format";
import { TrendingUp, Users, Briefcase, Building2, CheckCircle2 } from "lucide-react";
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

type CategoriaPopup = "corretores" | "gestores" | "voluire";

const CATEGORIA_INFO: Record<CategoriaPopup, { titulo: string; cor: string; descricao: string }> = {
  corretores: { titulo: "Corretores", cor: "text-emerald-600", descricao: "Repasse de comissão aos corretores" },
  gestores: { titulo: "Gestores", cor: "text-amber-600", descricao: "Comissão de gestão das equipes" },
  voluire: { titulo: "Voluire", cor: "text-primary", descricao: "Receita líquida da empresa" },
};

export default function Dashboard() {
  const anoAtual = new Date().getFullYear();
  const { role, isGestor, loading: roleLoading } = useUserRole();
  const [anoSel, setAnoSel] = useState(anoAtual);
  const [popupCat, setPopupCat] = useState<CategoriaPopup | null>(null);

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

  const pctQuitado =
    totais.vgv > 0 ? `${((totais.vgv_quitado / totais.vgv) * 100).toFixed(1)}%` : "—";

  // Quitado / em aberto por categoria (proporcional ao VGV quitado de cada mês)
  const quitadoPorCat = useMemo(() => {
    const calc = (cat: "corretores" | "gestores" | "voluire") => {
      let quitado = 0;
      let aberto = 0;
      for (const r of resumo) {
        const total = r[cat];
        if (r.vgv > 0) {
          const ratio = r.vgv_quitado / r.vgv;
          quitado += total * ratio;
        } else {
          aberto += total;
        }
      }
      const totalGeral = totais[cat];
      aberto = totalGeral - quitado;
      return { total: totalGeral, quitado, aberto };
    };
    return {
      corretores: calc("corretores"),
      gestores: calc("gestores"),
      voluire: calc("voluire"),
    };
  }, [resumo, totais]);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">VGV bruto</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totais.vgv)}</p>
            <p className="text-xs text-muted-foreground">{totais.qtd} vendas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">VGV quitado</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totais.vgv_quitado)}</p>
            <p className="text-xs text-muted-foreground">{pctQuitado} do VGV bruto</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setPopupCat("corretores")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Corretores (geral)</CardTitle>
            <Users className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totais.corretores)}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setPopupCat("gestores")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gestores (geral)</CardTitle>
            <Briefcase className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totais.gestores)}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setPopupCat("voluire")}>
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
                <Bar dataKey="corretores" name="Corretores" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gestores" name="Gestores" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="voluire" name="Voluire" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Dialog open={popupCat !== null} onOpenChange={(open) => !open && setPopupCat(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {popupCat === "corretores" && <Users className="h-5 w-5 text-emerald-500" />}
              {popupCat === "gestores" && <Briefcase className="h-5 w-5 text-amber-500" />}
              {popupCat === "voluire" && <Building2 className="h-5 w-5 text-primary" />}
              {popupCat ? CATEGORIA_INFO[popupCat].titulo : ""}
            </DialogTitle>
            <DialogDescription>
              {popupCat ? CATEGORIA_INFO[popupCat].descricao : ""} — {anoSel}
            </DialogDescription>
          </DialogHeader>

          {popupCat && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Quitado
                  </div>
                  <p className="mt-1 text-xl font-bold text-emerald-600">
                    {formatCurrency(quitadoPorCat[popupCat].quitado)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-amber-500" /> Em aberto
                  </div>
                  <p className="mt-1 text-xl font-bold text-amber-600">
                    {formatCurrency(quitadoPorCat[popupCat].aberto)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className={`text-xl font-bold ${CATEGORIA_INFO[popupCat].cor}`}>
                  {formatCurrency(quitadoPorCat[popupCat].total)}
                </span>
              </div>

              {(() => {
                const q = quitadoPorCat[popupCat];
                const pct = q.total > 0 ? `${((q.quitado / q.total) * 100).toFixed(1)}%` : "—";
                return (
                  <p className="text-center text-sm text-muted-foreground">
                    {pct} quitado do total
                  </p>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
