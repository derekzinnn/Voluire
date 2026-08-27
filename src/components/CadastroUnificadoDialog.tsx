import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, Copy, UserPlus } from "lucide-react";
import { formatCPF, formatPhone } from "@/lib/format";
import { DatePickerField } from "@/components/ui/date-picker-field";

const SEM_EQUIPE = "__sem_equipe__";
const NOVO_CORRETOR = "__novo__";

interface Props {
  triggerLabel?: string;
}

/** Cadastro unificado: cria login, corretor, perfil, CPF, equipe e função numa única ação. */
export default function CadastroUnificadoDialog({ triggerLabel = "Cadastrar usuário" }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("corretor");
  const [equipeId, setEquipeId] = useState(SEM_EQUIPE);
  const [vinculo, setVinculo] = useState(NOVO_CORRETOR);
  const [resultado, setResultado] = useState<{ email: string; password: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes"],
    queryFn: async () => {
      const { data } = await supabase.from("equipes").select("id, nome, ativo").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: corretoresSemLogin = [] } = useQuery({
    queryKey: ["corretores-sem-login"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("id, nome").is("user_id", null).order("nome");
      return data ?? [];
    },
  });

  const reset = () => {
    setResultado(null);
    setRole("corretor");
    setEquipeId(SEM_EQUIPE);
    setVinculo(NOVO_CORRETOR);
    setCopiado(false);
  };

  const cadastrar = useMutation({
    mutationFn: async (fd: FormData) => {
      const { data, error } = await supabase.functions.invoke("invite-corretor", {
        body: {
          nome: fd.get("nome"),
          email: fd.get("email"),
          role,
          equipe_id: equipeId === SEM_EQUIPE ? null : equipeId,
          corretor_id_existente: vinculo === NOVO_CORRETOR ? null : vinculo,
          criar_corretor: role !== "diretor" || vinculo !== NOVO_CORRETOR,
          comissao_percentual: fd.get("comissao_percentual"),
          cpf: fd.get("cpf"),
          creci: fd.get("creci"),
          telefone_pessoal: fd.get("telefone_pessoal"),
          email_pessoal: fd.get("email_pessoal"),
          data_nascimento: fd.get("data_nascimento"),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { ...data, email: fd.get("email") as string };
    },
    onSuccess: (data) => {
      ["corretores", "corretores-sem-login", "list-users", "user-roles", "equipes"].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
      setResultado({ email: data.email, password: data.tempPassword });
      toast({ title: "Cadastro concluído!" });
    },
    onError: (e: any) =>
      toast({ title: "Nada foi cadastrado", description: e.message, variant: "destructive" }),
  });

  const copiar = () => {
    if (!resultado) return;
    navigator.clipboard.writeText(`Email: ${resultado.email}\nSenha temporária: ${resultado.password}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Cadastro de usuário
          </DialogTitle>
          <DialogDescription>
            Login, ficha de corretor, equipe e função criados de uma só vez. Se qualquer etapa falhar, nada é gravado.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium">Credenciais criadas</p>
              <p className="text-sm text-muted-foreground">
                Envie ao usuário. Ele pode trocar a senha em "Esqueci a senha".
              </p>
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
            className="space-y-5"
            onSubmit={(e) => { e.preventDefault(); cadastrar.mutate(new FormData(e.currentTarget)); }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input name="nome" required maxLength={120} placeholder="Nome do usuário" />
              </div>
              <div className="space-y-2">
                <Label>E-mail de acesso *</Label>
                <Input name="email" type="email" required maxLength={255} placeholder="email@voluire.com" />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corretor">Corretor</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
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

            <Separator />

            <div className="space-y-2">
              <Label>Ficha de corretor</Label>
              <Select value={vinculo} onValueChange={setVinculo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOVO_CORRETOR}>Criar nova ficha</SelectItem>
                  {corretoresSemLogin.map((c) => (
                    <SelectItem key={c.id} value={c.id}>Vincular a: {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Corretores já cadastrados sem login aparecem aqui — evita ficha duplicada.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Split do corretor (%)</Label>
                <Input name="comissao_percentual" type="number" step="0.01" min={0} max={100} defaultValue={50} />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  name="cpf"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  onChange={(e) => {
                    e.target.value = formatCPF(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>CRECI</Label>
                <Input name="creci" maxLength={30} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  name="telefone_pessoal"
                  maxLength={15}
                  placeholder="(51) 90000-0000"
                  onChange={(e) => {
                    e.target.value = formatPhone(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail pessoal</Label>
                <Input name="email_pessoal" type="email" maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input name="data_nascimento" type="date" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O CPF fica em armazenamento protegido: gerentes veem apenas os dígitos mascarados.
            </p>

            <Button type="submit" className="w-full" disabled={cadastrar.isPending}>
              {cadastrar.isPending ? "Cadastrando..." : "Cadastrar usuário"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
