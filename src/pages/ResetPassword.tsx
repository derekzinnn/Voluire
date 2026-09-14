import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.jpg";
import { registrarLog } from "@/lib/logs";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      // Supabase handles session from the hash automatically
    }
  }, []);

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
          <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
          <CardDescription>Digite sua nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <Input type="password" placeholder="Nova senha" value={password} onChange={e => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Carregando..." : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
