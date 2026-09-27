import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, MESES } from "@/lib/format";
import { useUserRole } from "@/hooks/useUserRole";
import {
  anosDisponiveis, faltaParaMeta, hojeSP, mesesDoPeriodo, metaDoPeriodo, progressoMeta,
  type MetaRow, type TipoPeriodo,
} from "@/lib/metas";

const mesDe = (d: string | null) => (d ? Number(d.slice(5, 7)) : 0);
const anoDe = (d: string | null) => (d ? Number(d.slice(0, 4)) : 0);

/** Busca VGV realizado (por data da venda) e quitado (por data do pagamento) do ano, das views vw_vgv_*. */
function useVgvAno(ano: number) {
  const { role, corretorId } = useUserRole();
  const soMeu = role === "corretor";
  return useQuery({
    queryKey: ["dash-vgv-ano", ano, soMeu, corretorId],
    queryFn: async () => {
      const ini = `${ano}-01-01`, fim = `${ano}-12-31`;
      if (soMeu) {
        if (!corretorId) return { vendas: [], parcelas: [] };
        const { data: fatias, error } = await supabase
          .from("vw_vgv_corretor" as any).select("venda_id, data_venda, vgv_realizado, fatia").eq("corretor_id", corretorId);
        if (error) throw error;
        const f = (fatias ?? []) as any[];
        const fatiaPor = new Map(f.map((x) => [x.venda_id, Number(x.fatia)]));
        const ids = f.map((x) => x.venda_id);
        let parcelas: any[] = [];
        if (ids.length) {
          const { data: p, error: e2 } = await supabase
            .from("vw_vgv_parcelas" as any).select("venda_id, data_recebimento, vgv_quitado")
            .in("venda_id", ids).gte("data_recebimento", ini).lte("data_recebimento", fim);
          if (e2) throw e2;
          parcelas = ((p ?? []) as any[]).map((x) => ({ ...x, vgv_quitado: Number(x.vgv_quitado) * (fatiaPor.get(x.venda_id) ?? 0) }));
        }
        return {
          vendas: f.filter((x) => anoDe(x.data_venda) === ano).map((x) => ({ data_venda: x.data_venda, vgv: Number(x.vgv_realizado) })),
          parcelas,
        };
      }
      const [v, p] = await Promise.all([
        supabase.from("vw_vgv_vendas" as any).select("data_venda, vgv_realizado").gte("data_venda", ini).lte("data_venda", fim),
        supabase.from("vw_vgv_parcelas" as any).select("data_recebimento, vgv_quitado").gte("data_recebimento", ini).lte("data_recebimento", fim),
      ]);
      if (v.error) throw v.error;
      if (p.error) throw p.error;
      return {
        vendas: ((v.data ?? []) as any[]).map((x) => ({ data_venda: x.data_venda, vgv: Number(x.vgv_realizado) })),
        parcelas: ((p.data ?? []) as any[]).map((x) => ({ ...x, vgv_quitado: Number(x.vgv_quitado) })),
      };
    },
  });
}

function somar(dados: { vendas: any[]; parcelas: any[] } | undefined, meses: number[]) {
  if (!dados) return { realizado: 0, quitado: 0 };
  return {
    realizado: dados.vendas.filter((x) => meses.includes(mesDe(x.data_venda))).reduce((s, x) => s + x.vgv, 0),
    quitado: dados.parcelas.filter((x) => meses.includes(mesDe(x.data_recebimento))).reduce((s, x) => s + x.vgv_quitado, 0),
  };
}

function Bloco({ titulo, seletor, meta, v, mostrarMeta }: {
  titulo: string; seletor: React.ReactNode; meta: number | null;
  v: { realizado: number; quitado: number }; mostrarMeta: boolean;
}) {
  const falta = faltaParaMeta(meta, v);
  const pct = progressoMeta(meta, v);
  const linha = (rotulo: string, valor: string, destaque?: string) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span className={`font-semibold tabular-nums ${destaque ?? ""}`}>{valor}</span>
    </div>
  );
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">{titulo}</CardTitle>
        {seletor}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {mostrarMeta && linha("Meta", meta == null ? "Sem meta" : formatCurrency(meta))}
        {linha("VGV Realizado", formatCurrency(v.realizado), "text-primary")}
        {linha("VGV Quitado", formatCurrency(v.quitado), "text-emerald-600")}
        {mostrarMeta && linha("Falta para meta", falta == null ? "—" : formatCurrency(falta), "text-amber-600")}
        {mostrarMeta && (
          <div className="space-y-1 pt-1">
            <Progress value={Math.min(pct ?? 0, 100)} />
            <p className="text-right text-xs text-muted-foreground">
              {pct == null ? "Defina uma meta para ver o progresso" : `${pct.toFixed(1)}% da meta`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BlocosMeta() {
  const hoje = hojeSP();
  const { role } = useUserRole();
  const mostrarMeta = role !== "corretor";
  const anos = anosDisponiveis(hoje.ano);

  const [mesSel, setMesSel] = useState({ ano: hoje.ano, p: hoje.mes });
  const [triSel, setTriSel] = useState({ ano: hoje.ano, p: hoje.trimestre });
  const [anoSel, setAnoSel] = useState(hoje.ano);

  const dMes = useVgvAno(mesSel.ano);
  const dTri = useVgvAno(triSel.ano);
  const dAno = useVgvAno(anoSel);

  const { data: metas = [] } = useQuery({
    queryKey: ["metas-vgv"],
    enabled: mostrarMeta,
    queryFn: async () => {
      const { data, error } = await supabase.from("metas_vgv").select("tipo, ano, periodo, valor");
      if (error) throw error;
      return (data ?? []) as MetaRow[];
    },
  });

  const vMes = useMemo(() => somar(dMes.data, [mesSel.p]), [dMes.data, mesSel.p]);
  const vTri = useMemo(() => somar(dTri.data, mesesDoPeriodo("trimestre", triSel.p)), [dTri.data, triSel.p]);
  const vAno = useMemo(() => somar(dAno.data, mesesDoPeriodo("ano", 0)), [dAno.data]);

  const anoSelect = (valor: number, on: (a: number) => void) => (
    <Select value={String(valor)} onValueChange={(x) => on(Number(x))}>
      <SelectTrigger className="h-8 w-[84px]"><SelectValue /></SelectTrigger>
      <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
    </Select>
  );
  const periodoSelect = (tipo: TipoPeriodo, valor: number, on: (p: number) => void) => (
    <Select value={String(valor)} onValueChange={(x) => on(Number(x))}>
      <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {tipo === "mes"
          ? MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)
          : [1, 2, 3, 4].map((t) => <SelectItem key={t} value={String(t)}>{t}º trimestre</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Bloco
        titulo="Mês"
        mostrarMeta={mostrarMeta}
        meta={metaDoPeriodo(metas, "mes", mesSel.ano, mesSel.p)}
        v={vMes}
        seletor={<div className="flex gap-1.5">{periodoSelect("mes", mesSel.p, (p) => setMesSel((s) => ({ ...s, p })))}{anoSelect(mesSel.ano, (ano) => setMesSel((s) => ({ ...s, ano })))}</div>}
      />
      <Bloco
        titulo="Trimestre"
        mostrarMeta={mostrarMeta}
        meta={metaDoPeriodo(metas, "trimestre", triSel.ano, triSel.p)}
        v={vTri}
        seletor={<div className="flex gap-1.5">{periodoSelect("trimestre", triSel.p, (p) => setTriSel((s) => ({ ...s, p })))}{anoSelect(triSel.ano, (ano) => setTriSel((s) => ({ ...s, ano })))}</div>}
      />
      <Bloco
        titulo="Ano"
        mostrarMeta={mostrarMeta}
        meta={metaDoPeriodo(metas, "ano", anoSel, 0)}
        v={vAno}
        seletor={anoSelect(anoSel, setAnoSel)}
      />
    </div>
  );
}
