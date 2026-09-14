import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.jpg";
import { registrarLog } from "@/lib/logs";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState<"verificando" | "pronto" | "invalido">("verificando");
  const [erroLink, setErroLink] = useState("");
  const [email, setEmail] = useState("");
  const [reenviando, setReenviando] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const erro = hash.get("error_description") || hash.get("error");
    if (erro) {
      setErroLink(
        hash.get("error_code") === "otp_expired"
          ? "Este link expirou ou já foi usado. Peça um novo link para cadastrar a senha."
          : decodeURIComponent(erro),
      );
      setEstado("invalido");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setEstado("pronto");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setEstado("pronto");
      } else {
        // dá um tempo para o Supabase processar o token do link
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (s) setEstado("pronto");
            else {
              setErroLink("Não conseguimos validar este link. Ele pode ter expirado ou já ter sido usado.");
              setEstado("invalido");
            }
          });
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const reenviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setReenviando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "Link enviado!", description: "Confira seu e-mail e abra o link mais recente." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setReenviando(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Senha fraca", description: "A senha deve ter no mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast({ title: "Senha fraca", description: "A senha deve conter pelo menos uma letra maiúscula.", variant: "destructive" });
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast({ title: "Senha fraca", description: "A senha deve conter pelo menos um número.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await registrarLog("cadastrou a senha", { descricao: "Senha definida pelo link de acesso" });
      toast({ title: "Senha atualizada!", description: "Sua senha foi redefinida com sucesso." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Voluire" className="mx-auto mb-4 h-16 w-16 rounded-xl object-cover" />
          <CardTitle className="text-2xl">Cadastrar senha</CardTitle>
          <CardDescription>
            {estado === "invalido" ? "Link inválido ou expirado" : "Escolha a senha de acesso ao sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estado === "verificando" && (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {estado === "invalido" && (
            <div className="space-y-4">
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erroLink}</p>
              <form onSubmit={reenviar} className="space-y-3">
                <Input
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" disabled={reenviando}>
                  {reenviando ? "Enviando..." : "Enviar novo link"}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="w-full text-center text-sm text-muted-foreground underline hover:text-foreground"
              >
                Voltar ao login
              </button>
            </div>
          )}

          {estado === "pronto" && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="relative">
                <Input
                  type={ver ? "text" : "password"}
                  placeholder="Mín. 8 caracteres, 1 maiúscula e 1 número"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
