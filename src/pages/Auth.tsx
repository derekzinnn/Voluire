import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.jpg";
import { Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "Email enviado!", description: "Verifique seu email para redefinir a senha." });
        setIsForgotPassword(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
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
          <CardTitle className="text-2xl">Voluire CRM</CardTitle>
          {isForgotPassword && (
            <CardDescription>Digite seu email para redefinir a senha</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            {!isForgotPassword && (
              <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required />
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Carregando..." : isForgotPassword ? "Enviar link" : "Entrar"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            {isForgotPassword ? (
              <button type="button" className="underline hover:text-foreground" onClick={() => setIsForgotPassword(false)}>
                Voltar ao login
              </button>
            ) : (
              <button type="button" className="underline hover:text-foreground" onClick={() => setIsForgotPassword(true)}>
                Esqueci a senha
              </button>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Acesso exclusivo para membros convidados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
