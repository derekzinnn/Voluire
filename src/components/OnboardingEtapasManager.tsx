import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function OnboardingEtapasManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [novo, setNovo] = useState(false);

  const { data: etapas = [] } = useQuery({
    queryKey: ["onboarding-etapas-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_etapas")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["onboarding-etapas-admin"] });
    queryClient.invalidateQueries({ queryKey: ["onboarding-etapas"] });
  };

  const criar = useMutation({
    mutationFn: async (v: { nome: string; descricao: string; ordem: number }) => {
      const { error } = await supabase.from("onboarding_etapas").insert(v);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      setNovo(false);
      toast({ title: "Etapa criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...campos }: any) => {
      const { error } = await supabase.from("onboarding_etapas").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Etapa removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Etapas de onboarding</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setNovo((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> Nova etapa
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {novo && (
          <form
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              criar.mutate({
                nome: fd.get("nome") as string,
                descricao: fd.get("descricao") as string,
                ordem: Number(fd.get("ordem") || etapas.length + 1),
              });
            }}
          >
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input name="nome" required />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input name="descricao" />
            </div>
            <div className="space-y-1">
              <Label>Ordem</Label>
              <Input name="ordem" type="number" defaultValue={etapas.length + 1} />
            </div>
            <Button type="submit" disabled={criar.isPending}>Salvar</Button>
          </form>
        )}

        {etapas.map((e: any) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <Input
              className="w-16"
              type="number"
              defaultValue={e.ordem}
              onBlur={(ev) =>
                Number(ev.target.value) !== e.ordem &&
                atualizar.mutate({ id: e.id, ordem: Number(ev.target.value) })
              }
            />
            <Input
              className="min-w-48 flex-1"
              defaultValue={e.nome}
              onBlur={(ev) => ev.target.value !== e.nome && atualizar.mutate({ id: e.id, nome: ev.target.value })}
            />
            <Input
              className="min-w-48 flex-1"
              defaultValue={e.descricao ?? ""}
              placeholder="Descrição"
              onBlur={(ev) =>
                ev.target.value !== (e.descricao ?? "") && atualizar.mutate({ id: e.id, descricao: ev.target.value })
              }
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ativa</span>
              <Switch checked={e.ativa} onCheckedChange={(v) => atualizar.mutate({ id: e.id, ativa: v })} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => remover.mutate(e.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {etapas.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
        )}
      </CardContent>
    </Card>
  );
}
