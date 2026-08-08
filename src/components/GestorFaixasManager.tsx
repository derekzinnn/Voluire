import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

export default function GestorFaixasManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: faixas = [] } = useQuery({
    queryKey: ["gestor-faixas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gestor_faixas").select("*").order("faturamento_min");
      if (error) throw error;
      return data ?? [];
    },
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, percentual }: { id: string; percentual: number }) => {
      const { error } = await supabase.from("gestor_faixas").update({ percentual }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestor-faixas"] });
      queryClient.invalidateQueries({ queryKey: ["comissao-gestor"] });
      toast({ title: "Faixa atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faixas de comissão do gestor</CardTitle>
        <CardDescription>
          Percentual aplicado sobre a comissão bruta gerada pela equipe no mês, conforme o faturamento da equipe.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faturamento da equipe no mês</TableHead>
              <TableHead className="w-40">Percentual (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(faixas as any[]).map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  {f.faturamento_max
                    ? `${formatCurrency(Number(f.faturamento_min))} até ${formatCurrency(Number(f.faturamento_max))}`
                    : `Acima de ${formatCurrency(Number(f.faturamento_min))}`}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    defaultValue={f.percentual}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== Number(f.percentual)) atualizar.mutate({ id: f.id, percentual: v });
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
            {faixas.length === 0 && (
              <TableRow><TableCell colSpan={2} className="py-6 text-center text-muted-foreground">Nenhuma faixa configurada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
