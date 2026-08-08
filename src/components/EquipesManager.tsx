import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UsersRound, Plus } from "lucide-react";

const SEM_EQUIPE = "__sem_equipe__";

export default function EquipesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipes")
        .select("id, nome, gestor_user_id, ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["list-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("corretores")
        .select("id, nome, user_id, ativo, email, equipe_id")
        .order("nome");
      return data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["equipes"] });
    queryClient.invalidateQueries({ queryKey: ["corretores"] });
  };

  const criarEquipe = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("equipes").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast({ title: "Equipe criada!" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar equipe", description: e.message, variant: "destructive" }),
  });

  const atualizarEquipe = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: { nome?: string; gestor_user_id?: string | null; ativo?: boolean } }) => {
      const { error } = await supabase.from("equipes").update(values).eq("id", id);
      if (error) throw error;

    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Equipe atualizada!" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const atribuirCorretor = useMutation({
    mutationFn: async ({ corretorId, equipeId }: { corretorId: string; equipeId: string | null }) => {
      const { error } = await supabase.from("corretores").update({ equipe_id: equipeId }).eq("id", corretorId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Corretor atribuído!" });
    },
    onError: (e: any) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            Equipes
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nova equipe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova equipe</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const nome = (new FormData(e.currentTarget).get("nome") as string).trim();
                  if (nome) criarEquipe.mutate(nome);
                }}
              >
                <div className="space-y-2">
                  <Label>Nome da equipe</Label>
                  <Input name="nome" required placeholder="Ex.: Equipe Andressa" />
                </div>
                <Button type="submit" className="w-full" disabled={criarEquipe.isPending}>
                  Criar equipe
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipe</TableHead>
                <TableHead>Gestora responsável</TableHead>
                <TableHead>Corretores</TableHead>
                <TableHead className="text-right">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipes.map((eq) => (
                <TableRow key={eq.id}>
                  <TableCell className="font-medium">{eq.nome}</TableCell>
                  <TableCell>
                    <Select
                      value={eq.gestor_user_id ?? ""}
                      onValueChange={(userId) =>
                        atualizarEquipe.mutate({ id: eq.id, values: { gestor_user_id: userId } })
                      }
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Definir gestora..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{corretores.filter((c) => c.equipe_id === eq.id).length}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={eq.ativo}
                      onCheckedChange={(v) => atualizarEquipe.mutate({ id: eq.id, values: { ativo: v } })}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {equipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhuma equipe criada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corretores por equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corretor</TableHead>
                <TableHead>Equipe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corretores.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    <Select
                      value={c.equipe_id ?? SEM_EQUIPE}
                      onValueChange={(v) =>
                        atribuirCorretor.mutate({
                          corretorId: c.id,
                          equipeId: v === SEM_EQUIPE ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SEM_EQUIPE}>Sem equipe</SelectItem>
                        {equipes
                          .filter((e) => e.ativo)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
