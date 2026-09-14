import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, KeyRound, Link2 } from "lucide-react";

const SEM_EQUIPE = "__sem_equipe__";
const SEM_FICHA = "__sem_ficha__";

interface Props {
  triggerLabel?: string;
}

/** Vincula acesso (login) a um corretor já cadastrado — sem recadastrar a ficha. */
export default function VincularUsuarioDialog({ triggerLabel = "Vincular usuário" }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [corretorId, setCorretorId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("corretor");
  const [equipeId, setEquipeId] = useState(SEM_EQUIPE);
  const [resultado, setResultado] = useState<{ email: string; password: string; userId: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [enviandoLink, setEnviandoLink] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores-sem-login"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("corretores")
        .select("id, nome, email, equipe_id, comissao_percentual")
        .is("user_id", null)
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes"],
    queryFn: async () => {
      const { data } = await supabase.from("equipes").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const selecionado = useMemo(
    () => (corretores as any[]).find((c) => c.id === corretorId),
    [corretores, corretorId]
  );

  function escolherCorretor(id: string) {
    setCorretorId(id);
    const c = (corretores as any[]).find((x) => x.id === id);
    if (c) {
      if (c.email) setEmail(c.email);
      setEquipeId(c.equipe_id ?? SEM_EQUIPE);
    }
  }

  const reset = () => {
    setResultado(null);
    setLinkEnviado(false);
    setEnviandoLink(false);
    setCorretorId("");
    setEmail("");
    setRole("corretor");
    setEquipeId(SEM_EQUIPE);
    setCopiado(false);
  };

  const vincular = useMutation({
    mutationFn: async () => {
      const semFicha = corretorId === SEM_FICHA;
      const { data, error } = await supabase.functions.invoke("invite-corretor", {
        body: {
          nome: semFicha ? email.split("@")[0] : selecionado?.nome,
          email,
          role,
          equipe_id: equipeId === SEM_EQUIPE ? null : equipeId,
          corretor_id_existente: semFicha ? null : corretorId,
          criar_corretor: false,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      ["corretores", "corretores-sem-login", "list-users", "user-roles", "equipes"].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
      setResultado({ email, password: data.tempPassword, userId: data.userId });
      toast({ title: "Acesso criado e vinculado!" });
    },
    onError: (e: any) => toast({ title: "Nada foi vinculado", description: e.message, variant: "destructive" }),
  });

  const copiar = () => {
    if (!resultado) return;
    navigator.clipboard.writeText(`Email: ${resultado.email}\nSenha temporária: ${resultado.password}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const podeSalvar = !!corretorId && !!email.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Link2 className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Vincular usuário
          </DialogTitle>
          <DialogDescription>
            Cria o login e vincula à ficha de um corretor já cadastrado. A ficha não é duplicada.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium">Credenciais criadas</p>
              <p className="text-sm text-muted-foreground">Envie ao usuário. Ele pode trocar a senha em "Esqueci a senha".</p>
              <div className="mt-3 space-y-1 rounded border bg-background p-3 font-mono text-sm">
                <p><span className="text-muted-foreground">Email:</span> {resultado.email}</p>
                <p><span className="text-muted-foreground">Senha:</span> {resultado.password}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={copiar}>
                {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copiado ? "Copiado!" : "Copiar credenciais"}
              </Button>
              <Button className="flex-1" onClick={() => { reset(); setOpen(false); }}>Fechar</Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); vincular.mutate(); }}
          >
            <div className="space-y-2">
              <Label>Corretor cadastrado *</Label>
              <Select value={corretorId} onValueChange={escolherCorretor}>
                <SelectTrigger><SelectValue placeholder="Selecione a ficha" /></SelectTrigger>
                <SelectContent>
                  {(corretores as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                  <SelectItem value={SEM_FICHA}>Acesso administrativo (sem ficha)</SelectItem>
                </SelectContent>
              </Select>
              {corretores.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todos os corretores ativos já têm login. Cadastre a ficha em Corretores primeiro.
                </p>
              )}
              {selecionado && (
                <p className="text-xs text-muted-foreground">
                  Comissão atual: {Number(selecionado.comissao_percentual)}%
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>E-mail de acesso *</Label>
              <Input
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@voluire.com"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Corretor</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                    <SelectItem value="diretor">Diretor</SelectItem>
                  </SelectContent>
                </Select>
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
                {role === "gerente" && equipeId !== SEM_EQUIPE && (
                  <p className="text-xs text-muted-foreground">Será definido como gestor desta equipe.</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!podeSalvar || vincular.isPending}>
              {vincular.isPending ? "Vinculando..." : "Criar acesso e vincular"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
