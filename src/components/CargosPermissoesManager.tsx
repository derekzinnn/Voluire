import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";
import { PERMISSOES, ROLES_CONFIGURAVEIS, ROLE_LABELS, type AppRole } from "@/hooks/useUserRole";

export default function CargosPermissoesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("id, role, permission, allowed");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ role, permission, allowed }: { role: AppRole; permission: string; allowed: boolean }) => {
      const { error } = await supabase
        .from("role_permissions")
        .upsert({ role, permission, allowed }, { onConflict: "role,permission" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast({ title: "Permissão atualizada" });
    },
    onError: (e: any) => toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" }),
  });

  const isAllowed = (role: string, permission: string) =>
    rows.some((r: any) => r.role === role && r.permission === permission && r.allowed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Cargos e permissões
        </CardTitle>
        <CardDescription>
          Marque o que cada cargo pode fazer. O Diretor sempre tem acesso total e não aparece aqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left font-medium">Permissão</th>
              {ROLES_CONFIGURAVEIS.map((r) => (
                <th key={r} className="px-3 py-2 text-center font-medium">
                  <Badge variant="secondary">{ROLE_LABELS[r]}</Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSOES.map((p) => (
              <tr key={p.key} className="border-b last:border-0">
                <td className="py-3 pr-4">
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.descricao}</p>
                </td>
                {ROLES_CONFIGURAVEIS.map((r) => (
                  <td key={r} className="px-3 py-3 text-center">
                    <Checkbox
                      checked={isAllowed(r, p.key)}
                      onCheckedChange={(v) =>
                        toggle.mutate({ role: r, permission: p.key, allowed: v === true })
                      }
                      aria-label={`${ROLE_LABELS[r]} — ${p.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
