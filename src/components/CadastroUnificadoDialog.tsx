import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, Copy, UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCPF, formatPhone } from "@/lib/format";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { cn } from "@/lib/utils";

const SEM_EQUIPE = "__sem_equipe__";

const STEPS = [
  { title: "Acesso", desc: "Etapa 1 de 3 — identificação, função e equipe." },
  { title: "Dados pessoais", desc: "Etapa 2 de 3 — documentos e contato (opcional)." },
  { title: "Comissão", desc: "Etapa 3 de 3 — split do corretor e conclusão." },
];

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
            ref={formRef}
            className="space-y-5"
            onSubmit={(e) => { e.preventDefault(); cadastrar.mutate(new FormData(e.currentTarget)); }}
          >
            {/* Stepper */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s.title} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                      i === step && "border-primary bg-primary text-primary-foreground",
                      i < step && "border-primary bg-primary/10 text-primary",
                      i > step && "text-muted-foreground"
                    )}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                  <span className={cn("hidden text-xs sm:block", i === step ? "font-medium" : "text-muted-foreground")}>
                    {s.title}
                  </span>
                  {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{STEPS[step].desc}</p>

            {/* Etapa 1 — Acesso */}
            <div className={cn("grid gap-4 sm:grid-cols-2", step !== 0 && "hidden")}>
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

            {/* Etapa 2 — Dados pessoais */}
            <div className={cn("grid gap-4 sm:grid-cols-2", step !== 1 && "hidden")}>
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
                <Label>Data de nascimento</Label>
                <DatePickerField name="data_nascimento" placeholder="dd/mm/aaaa" />
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
                <Label>CRECI</Label>
                <Input name="creci" maxLength={30} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                O CPF fica em armazenamento protegido: gerentes veem apenas os dígitos mascarados.
              </p>
            </div>

            {/* Etapa 3 — Comissão */}
            <div className={cn("space-y-4", step !== 2 && "hidden")}>
              <div className="space-y-2 sm:max-w-xs">
                <Label>Split do corretor (%)</Label>
                <Input name="comissao_percentual" type="number" step="0.01" min={0} max={100} defaultValue={50} />
                <p className="text-xs text-muted-foreground">
                  Percentual da comissão bruta que fica com o corretor nas vendas dele.
                </p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Ao concluir</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Serão criados: login de acesso, ficha de corretor, dados pessoais, equipe e função — tudo em uma única
                  ação. Se qualquer etapa falhar, nada é gravado.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />Voltar
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={avancar}>
                  Continuar<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={cadastrar.isPending}>
                  {cadastrar.isPending ? "Cadastrando..." : "Cadastrar usuário"}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
