import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";

interface Props {
  userId: string;
  email: string;
  /** Renderiza como item de lista/tabela quando falso */
  trigger?: React.ReactNode;
}

/** Diretor: envia o link de cadastro de senha ou define a senha na hora. */
export default function DefinirSenhaDialog({ userId, email, trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviarLink = async () => {
    setEnviando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Link enviado!", description: `${email} vai receber o e-mail para cadastrar a senha.` });
    } catch (e: any) {
      toast({ title: "Não foi possível enviar", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  const definir = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-set-password", {
        body: { user_id: userId, password: senha },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Senha definida!", description: `Informe a nova senha a ${email}.` });
      setSenha("");
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao definir a senha", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Senha
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Senha de {email}</DialogTitle>
          <DialogDescription>
            Envie o link para a pessoa cadastrar a própria senha, ou defina uma senha agora.
          </DialogDescription>
        </DialogHeader>

        <Button variant="outline" className="w-full gap-2" onClick={enviarLink} disabled={enviando}>
          <Mail className="h-4 w-4" />
          {enviando ? "Enviando..." : "Enviar link para cadastrar senha"}
        </Button>

        <div className="relative py-1 text-center text-xs uppercase text-muted-foreground">
          <span className="bg-background px-2">ou</span>
        </div>

        <form onSubmit={definir} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Definir senha agora</Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={ver ? "text" : "password"}
                placeholder="Mín. 8 caracteres, 1 maiúscula e 1 número"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setVer((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={salvando || senha.length < 8}>
            {salvando ? "Salvando..." : "Salvar senha"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
