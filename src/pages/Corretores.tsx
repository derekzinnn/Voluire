import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Trash2, IdCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import NovoCorretorDialog from "@/components/NovoCorretorDialog";
import VincularUsuarioDialog from "@/components/VincularUsuarioDialog";
import { fetchVendasPorCorretor } from "@/lib/vendas";

export default function Corretores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();



  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("*").order("nome");
      return data || [];
    },
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas-por-corretor"],
    queryFn: () => fetchVendasPorCorretor(),
  });







  const deleteCorretor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("corretores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      toast({ title: "Corretor removido" });
    },
  });




  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex gap-2">
          <NovoCorretorDialog />
          <VincularUsuarioDialog />
        </div>
      </div>





      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>% Comissão</TableHead>
                <TableHead>VGV</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corretores.map((c: any) => {
                const cv = vendas.filter(v => v.corretor_id === c.id && v.status !== "distrato");
                const vgv = cv.reduce((s, v) => s + Number(v.valor), 0);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.email || "—"}</TableCell>
                    <TableCell>{formatPercent(Number(c.comissao_percentual))}</TableCell>
                    <TableCell>{formatCurrency(vgv)}</TableCell>
                    <TableCell>{cv.length}</TableCell>
                    <TableCell><Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild title="Abrir ficha">
                        <Link to={`/corretores/${c.id}`}><IdCard className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCorretor.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>


                  </TableRow>
                );
              })}
              {corretores.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum corretor cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
