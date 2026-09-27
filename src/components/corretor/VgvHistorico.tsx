import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

/** VGV de toda a carreira na Voluire (sem distrato), por ano. */
export default function VgvHistorico({ corretorId }: { corretorId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["vgv-historico", corretorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("corretor_vgv_historico" as any, { p_corretor_id: corretorId });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ano: Number(r.ano), realizado: Number(r.realizado), quitado: Number(r.quitado), qtd: Number(r.qtd_vendas),
      }));
    },
  });
  const tot = data.reduce((s, r) => ({ realizado: s.realizado + r.realizado, quitado: s.quitado + r.quitado, qtd: s.qtd + r.qtd }), { realizado: 0, quitado: 0, qtd: 0 });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">VGV desde a entrada na Voluire</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Ano</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Realizado</TableHead><TableHead className="text-right">Quitado</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma venda registrada.</TableCell></TableRow>}
            {data.map((r) => (
              <TableRow key={r.ano}>
                <TableCell className="font-medium">{r.ano}</TableCell>
                <TableCell className="text-right">{r.qtd}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.realizado)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.quitado)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter><TableRow>
            <TableCell>Total da carreira</TableCell>
            <TableCell className="text-right">{tot.qtd}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(tot.realizado)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(tot.quitado)}</TableCell>
          </TableRow></TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
