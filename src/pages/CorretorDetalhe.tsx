import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { useUserRole } from "@/hooks/useUserRole";
import PerfilTab from "@/components/corretor/PerfilTab";
import EquipeTab from "@/components/corretor/EquipeTab";
import DesenvolvimentoTab from "@/components/corretor/DesenvolvimentoTab";
import DesempenhoTab from "@/components/corretor/DesempenhoTab";
import { useFotoUrl } from "@/components/corretor/useFotoUrl";

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function CorretorDetalhe() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { corretorId, isGestor, isDiretor, loading: roleLoading } = useUserRole();

  const podeGerenciar = isGestor;
  const ehProprio = corretorId === id;

  const { data: corretor, isLoading } = useQuery({
    queryKey: ["corretor-detalhe", id],
    enabled: !!id && !roleLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corretores")
        .select("id, nome, ativo, email, comissao_percentual, equipe_id, equipes(nome)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: perfil } = useQuery({
    queryKey: ["corretor-perfil", id],
    enabled: !!corretor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corretor_perfis")
        .select("*")
        .eq("corretor_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fotoUrl = useFotoUrl(perfil?.foto_url ?? null);

  if (roleLoading || isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!corretor) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Corretor não encontrado ou sem acesso</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Você só pode visualizar fichas de corretores da sua equipe.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const equipeNome = (corretor as any).equipes?.nome as string | undefined;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* Cabeçalho fixo: identidade do corretor permanece visível ao trocar de aba */}
      <div className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-5 py-5">
            <Avatar className="h-16 w-16">
              {fotoUrl && <AvatarImage src={fotoUrl} alt={`Foto de ${corretor.nome}`} />}
              <AvatarFallback className="text-lg">{iniciais(corretor.nome)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">{corretor.nome}</h2>
                <Badge variant={corretor.ativo ? "default" : "secondary"}>
                  {corretor.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{corretor.email || "Sem e-mail cadastrado"}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-sm">
                <span className="text-muted-foreground">
                  Equipe: <span className="text-foreground">{equipeNome ?? "Sem equipe"}</span>
                </span>
                <span className="text-muted-foreground">
                  Split:{" "}
                  <span className="text-foreground">{formatPercent(Number(corretor.comissao_percentual))}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ficha">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ficha">Ficha</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="desenvolvimento">Desenvolvimento</TabsTrigger>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
        </TabsList>

        <TabsContent value="ficha" className="mt-4">
          <PerfilTab
            corretorId={id}
            perfil={perfil}
            podeGerenciar={podeGerenciar}
            ehProprio={ehProprio}
            isDiretor={isDiretor}
          />
        </TabsContent>
        <TabsContent value="equipe" className="mt-4">
          <EquipeTab
            corretorId={id}
            equipeId={corretor.equipe_id}
            splitAtual={Number(corretor.comissao_percentual)}
            podeGerenciar={podeGerenciar}
          />

        </TabsContent>
        <TabsContent value="desenvolvimento" className="mt-4">
          <DesenvolvimentoTab corretorId={id} podeGerenciar={podeGerenciar} />
        </TabsContent>
        <TabsContent value="desempenho" className="mt-4">
          <DesempenhoTab corretorId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
