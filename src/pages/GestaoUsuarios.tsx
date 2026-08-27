import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, Shield, Link2, Unlink } from "lucide-react";
import type { AppRole } from "@/hooks/useUserRole";
import EquipesManager from "@/components/EquipesManager";
import GestorFaixasManager from "@/components/GestorFaixasManager";
import VincularUsuarioDialog from "@/components/VincularUsuarioDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ROLE_LABELS: Record<string, string> = {
  diretor: "Diretor",
  gerente: "Gerente",
  corretor: "Corretor",
};

const ROLE_COLORS: Record<string, string> = {
  diretor: "bg-red-100 text-red-800",
  gerente: "bg-blue-100 text-blue-800",
  corretor: "bg-green-100 text-green-800",
};

export default function GestaoUsuarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();


  // Fetch users via secure RPC function
  const { data: users = [] } = useQuery({
    queryKey: ["list-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("id, nome, user_id, ativo, email").order("nome");
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
      return data || [];
    },
  });




  // Link corretor to user
  const linkMutation = useMutation({
    mutationFn: async ({ corretorId, userId }: { corretorId: string; userId: string }) => {
      const { error } = await supabase.from("corretores").update({ user_id: userId }).eq("id", corretorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      toast({ title: "Corretor vinculado!" });
    },
    onError: () => toast({ title: "Erro ao vincular", variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (corretorId: string) => {
      const { error } = await supabase.from("corretores").update({ user_id: null }).eq("id", corretorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      toast({ title: "Vínculo removido" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast({ title: "Função atualizada!" });
    },
    onError: () => toast({ title: "Erro ao atualizar função", variant: "destructive" }),
  });

  const getUserRole = (userId: string) => {
    const r = roles.find((r: any) => r.user_id === userId);
    return r?.role as AppRole | undefined;
  };

  const getLinkedCorretor = (userId: string) => {
    return corretores.find((c: any) => c.user_id === userId);
  };

  const getUnlinkedCorretores = () => {
    return corretores.filter((c: any) => !c.user_id);
  };




  return (
    <Tabs defaultValue="usuarios" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários e permissões</TabsTrigger>
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>
        <VincularUsuarioDialog />
      </div>

      <TabsContent value="usuarios" className="space-y-6">
      {/* Users & Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Usuários e Permissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Corretor Vinculado</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: any) => {
                const role = getUserRole(user.id);
                const linkedCorretor = getLinkedCorretor(user.id);
                const unlinked = getUnlinkedCorretores();

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={role || ""}
                        onValueChange={(val) => roleMutation.mutate({ userId: user.id, newRole: val as AppRole })}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Sem função">
                            {role ? (
                              <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                            ) : "Sem função"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diretor">Diretor</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                          <SelectItem value="corretor">Corretor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {linkedCorretor ? (
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-600" />
                          <span>{linkedCorretor.nome}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unlinkMutation.mutate(linkedCorretor.id)}>
                            <Unlink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <Select onValueChange={(corretorId) => linkMutation.mutate({ corretorId, userId: user.id })}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Vincular corretor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {unlinked.map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {linkedCorretor && (
                        <Badge variant="outline" className="gap-1">
                          <Link2 className="h-3 w-3" />Vinculado
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum usuário cadastrado ainda. Use o botão "Convidar Usuário" acima.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unlinked corretores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corretores sem vínculo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {getUnlinkedCorretores().map((c: any) => (
              <Badge key={c.id} variant="secondary">{c.nome}</Badge>
            ))}
            {getUnlinkedCorretores().length === 0 && (
              <p className="text-sm text-muted-foreground">Todos os corretores estão vinculados!</p>
            )}
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="equipes">
        <EquipesManager />
      </TabsContent>

      <TabsContent value="comissoes">
        <GestorFaixasManager />
      </TabsContent>
    </Tabs>
  );
}

