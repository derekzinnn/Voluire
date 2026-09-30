import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Trash2, IdCard, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import NovoCorretorDialog from "@/components/NovoCorretorDialog";
import VincularUsuarioDialog from "@/components/VincularUsuarioDialog";
import { fetchVendasPorCorretor } from "@/lib/vendas";
import { useUserRole } from "@/hooks/useUserRole";
import { Mail } from "lucide-react";

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Corretores() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");



  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("*").order("nome");
      return data || [];
    },
  });

  const { can } = useUserRole();
  const podeEditar = can("corretores.gerenciar");
  const { data: usuarios = [] } = useQuery({
    queryKey: ["list-users-status"],
    queryFn: async () => {
      const { data } = await supabase.rpc("list_users_status" as any);
      return (data ?? []) as any[];
    },
  });
  const statusAcesso = (c: any) => {
    if (!c.user_id) return { label: "Não convidado", variant: "outline" as const };
    const u = usuarios.find((x) => x.id === c.user_id);
    if (u?.banned_until && new Date(u.banned_until) > new Date()) return { label: "Desativado", variant: "secondary" as const };
    if (u && !u.last_sign_in_at) return { label: "Convite pendente", variant: "secondary" as const, email: u.email };
    return { label: "Ativo", variant: "default" as const };
  };
  const reenviar = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    toast(error ? { title: "Erro ao reenviar", description: error.message, variant: "destructive" } : { title: "Convite reenviado", description: email });
  };

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
                <TableHead>Acesso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corretores.map((c: any) => {
                const cv = vendas.filter(v => v.corretor_id === c.id && v.status !== "distrato");
                const vgv = cv.reduce((s, v) => s + Number(v.valor), 0);
                const acesso = statusAcesso(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.email || "—"}</TableCell>
                    <TableCell>{formatPercent(Number(c.comissao_percentual))}</TableCell>
                    <TableCell>{formatCurrency(vgv)}</TableCell>
                    <TableCell>{cv.length}</TableCell>
                    <TableCell><Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={acesso.variant}>{acesso.label}</Badge>
                        {acesso.email && podeEditar && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reenviar convite" onClick={() => reenviar(acesso.email!)}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild title="Abrir ficha">
                        <Link to={`/corretores/${c.id}`}><IdCard className="h-4 w-4" /></Link>
                      </Button>
                      {podeEditar && <NovoCorretorDialog corretor={c} />}
                      <Button variant="ghost" size="icon" onClick={() => deleteCorretor.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>


                  </TableRow>
                );
              })}
              {corretores.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum corretor cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
