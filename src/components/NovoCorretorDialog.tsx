import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const SEM_EQUIPE = "__sem_equipe__";

/** Cria apenas a ficha do corretor. O login é criado depois em "Vincular usuário". */
export default function NovoCorretorDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [comissao, setComissao] = useState("50");
  const [equipeId, setEquipeId] = useState(SEM_EQUIPE);

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes"],
    queryFn: async () => {
      const { data } = await supabase.from("equipes").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const reset = () => {
    setNome("");
    setEmail("");
    setComissao("50");
    setEquipeId(SEM_EQUIPE);
  };

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("corretores").insert({
        nome: nome.trim(),
        email: email.trim() || null,
        comissao_percentual: Math.min(100, Math.max(0, Number(comissao) || 0)),
        equipe_id: equipeId === SEM_EQUIPE ? null : equipeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      ["corretores", "corretores-sem-login"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: "Corretor cadastrado", description: "Complete a ficha ou vincule um login quando quiser." });
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Novo corretor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo corretor</DialogTitle>
          <DialogDescription>Cadastre a ficha. O acesso ao sistema é vinculado depois.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); criar.mutate(); }}>
          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <Input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Split do corretor (%)</Label>
              <Input type="number" min="0" max="100" value={comissao} onChange={(e) => setComissao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select value={equipeId} onValueChange={setEquipeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_EQUIPE}>Sem equipe</SelectItem>
                  {equipes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={!nome.trim() || criar.isPending}>
            {criar.isPending ? "Salvando..." : "Cadastrar corretor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
