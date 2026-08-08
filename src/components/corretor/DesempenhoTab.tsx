import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchVendasPorCorretor } from "@/lib/vendas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ANO = new Date().getFullYear();
const TRIMESTRE_ATUAL = Math.floor(new Date().getMonth() / 3) + 1;

function trimestreDe(dataISO: string) {
  return Math.floor(new Date(dataISO + "T12:00:00").getMonth() / 3) + 1;
}
function anoDe(dataISO: string) {
  return new Date(dataISO + "T12:00:00").getFullYear();
}

export default function DesempenhoTab({ corretorId }: { corretorId: string }) {
  const { data: vendas = [] } = useQuery({
    queryKey: ["desempenho-vendas", corretorId],
    queryFn: async () => {
      const rows = await fetchVendasPorCorretor([corretorId]);
      return rows.filter((v) => v.status !== "distrato");
    },
  });

  const { data: captacoes = [] } = useQuery({
    queryKey: ["desempenho-captacoes", corretorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captacoes")
        .select("id, data_captacao")
        .eq("corretor_id", corretorId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const vendasAno = useMemo(() => vendas.filter((v) => anoDe(v.data_venda) === ANO), [vendas]);

  const vgvAno = vendasAno.reduce((s, v) => s + Number(v.valor), 0);

  const porTrimestre = useMemo(
    () =>
      [1, 2, 3, 4].map((t) => {
        const vs = vendasAno.filter((v) => trimestreDe(v.data_venda) === t);
        return {
          trimestre: `${t}º tri`,
          numero: t,
          vgv: vs.reduce((s, v) => s + Number(v.valor), 0),
          vendas: vs.length,
        };
      }),
    [vendasAno]
  );

  const triAtual = porTrimestre[TRIMESTRE_ATUAL - 1];
  const semCaptacoes = captacoes.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">VGV do ano</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(vgvAno)}</p>
            <p className="text-xs text-muted-foreground">{vendasAno.length} vendas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">VGV do trimestre</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(triAtual?.vgv ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{TRIMESTRE_ATUAL}º trimestre de {ANO}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Captações</CardTitle>
          </CardHeader>
          <CardContent>
            {semCaptacoes ? (
              <>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground">Sem dados: módulo de captações ainda não liberado</p>
              </>
            ) : (
              <p className="text-2xl font-bold">{captacoes.length}</p>
            )}
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">VGV por trimestre — {ANO}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porTrimestre}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="trimestre" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="vgv" name="VGV" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
}
