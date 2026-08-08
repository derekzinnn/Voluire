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
          <CardTitle className="text-base">Campanha Placar Voluire — {TRIMESTRE_ATUAL}º trimestre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pontos (mínimo {META_PONTOS})</span>
              <span className="font-medium">
                {triAtual?.pontos ?? 0}/{META_PONTOS}
              </span>
            </div>
            <Progress value={Math.min(100, ((triAtual?.pontos ?? 0) / META_PONTOS) * 100)} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VGV (mínimo {formatCurrency(META_VGV)})</span>
              <span className="font-medium">{formatCurrency(triAtual?.vgv ?? 0)}</span>
            </div>
            <Progress value={Math.min(100, ((triAtual?.vgv ?? 0) / META_VGV) * 100)} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Captações (mínimo {META_CAPTACOES})</span>
              {semCaptacoes ? (
                <Badge variant="secondary">Sem dados</Badge>
              ) : (
                <span className="font-medium">
                  {captacoes.filter((c) => trimestreDe(c.data_captacao) === TRIMESTRE_ATUAL && anoDe(c.data_captacao) === ANO).length}/
                  {META_CAPTACOES}
                </span>
              )}
            </div>
            {semCaptacoes ? (
              <p className="text-xs text-muted-foreground">
                O cadastro de captações/agenciamentos entra em uma etapa futura. Até lá este critério não é avaliado.
              </p>
            ) : (
              <Progress
                value={Math.min(
                  100,
                  (captacoes.filter((c) => trimestreDe(c.data_captacao) === TRIMESTRE_ATUAL && anoDe(c.data_captacao) === ANO).length /
                    META_CAPTACOES) *
                    100
                )}
              />
            )}
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metas individuais — {ANO}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metasComRealizado.map((m) => (
            <div key={m.id} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {m.categoria === "vendas" ? "Nº de vendas" : "VGV"} ·{" "}
                  {m.mes ? `${m.mes}/${m.ano}` : m.trimestre ? `${m.trimestre}º tri` : "Ano"}
                </span>
                <span className="font-medium">
                  {m.categoria === "vendas"
                    ? `${m.realizado}/${Number(m.valor)}`
                    : `${formatCurrency(m.realizado)} / ${formatCurrency(Number(m.valor))}`}
                </span>
              </div>
              <Progress value={m.pct} />
            </div>
          ))}
          {metasComRealizado.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma meta individual cadastrada para este corretor em {ANO}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
