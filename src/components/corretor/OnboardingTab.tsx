import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function OnboardingTab({
  corretorId,
  podeGerenciar,
}: {
  corretorId: string;
  podeGerenciar: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: etapas = [] } = useQuery({
    queryKey: ["onboarding-etapas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_etapas")
        .select("id, nome, descricao, ordem")
        .eq("ativa", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: progresso = [] } = useQuery({
    queryKey: ["onboarding-progresso", corretorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_progresso")
        .select("id, etapa_id, concluido, data_conclusao")
        .eq("corretor_id", corretorId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mapa = useMemo(
    () => new Map(progresso.map((p) => [p.etapa_id, p])),
    [progresso]
  );

  const concluidas = etapas.filter((e) => mapa.get(e.id)?.concluido).length;
  const pct = etapas.length ? Math.round((concluidas / etapas.length) * 100) : 0;

  const alternar = useMutation({
    mutationFn: async ({ etapaId, concluido }: { etapaId: string; concluido: boolean }) => {
      const { error } = await supabase.from("onboarding_progresso").upsert(
        {
          corretor_id: corretorId,
          etapa_id: etapaId,
          concluido,
          data_conclusao: concluido ? new Date().toISOString().slice(0, 10) : null,
          responsavel_user_id: concluido ? user?.id ?? null : null,
        },
        { onConflict: "corretor_id,etapa_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-progresso", corretorId] }),
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Onboarding</CardTitle>
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {concluidas} de {etapas.length} etapas concluídas
            </span>
            <span className="font-medium">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {etapas.map((e) => {
          const p = mapa.get(e.id);
          return (
            <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                className="mt-0.5"
                checked={!!p?.concluido}
                disabled={!podeGerenciar || alternar.isPending}
                onCheckedChange={(v) => alternar.mutate({ etapaId: e.id, concluido: !!v })}
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{e.nome}</p>
                {e.descricao && <p className="text-xs text-muted-foreground">{e.descricao}</p>}
                {p?.concluido && p.data_conclusao && (
                  <p className="text-xs text-muted-foreground">
                    Concluída em {new Date(p.data_conclusao + "T12:00:00").toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {etapas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma etapa de onboarding ativa. O diretor pode cadastrar etapas em Gestão Usuários.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
