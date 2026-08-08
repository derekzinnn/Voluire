import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchVendasPorCorretor } from "@/lib/vendas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Trophy, MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

const hoje = new Date();
const ANO = hoje.getFullYear();
const MES = hoje.getMonth() + 1;
const TRIMESTRE = Math.floor(hoje.getMonth() / 3) + 1;

export default function MinhaEquipe() {
  const { isDiretor } = useUserRole();
  const navigate = useNavigate();

  const [equipeSel, setEquipeSel] = useState<string>("");

  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipes")
        .select("id, nome, gestor_user_id, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const equipeAtiva = equipeSel || equipes[0]?.id || "";

  const { data: corretores = [] } = useQuery({
    queryKey: ["equipe-corretores", equipeAtiva],
    enabled: !!equipeAtiva,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corretores")
        .select("id, nome, ativo, email, comissao_percentual")
        .eq("equipe_id", equipeAtiva)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ids = useMemo(() => corretores.map((c) => c.id), [corretores]);

  const { data: vendas = [] } = useQuery({
    queryKey: ["equipe-vendas", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const rows = await fetchVendasPorCorretor(ids);
      return rows.filter((v) => v.status === "ativa");
    },
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["equipe-entregas", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placar_entregas")
        .select("corretor_id, trimestre, ano, placar_tarefas(pontos)")
        .in("corretor_id", ids)
        .eq("ano", ANO)
        .eq("trimestre", TRIMESTRE);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: captacoes = [] } = useQuery({
    queryKey: ["equipe-captacoes", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captacoes")
        .select("corretor_id, data_captacao")
        .in("corretor_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const porCorretor = useMemo(() => {
    return corretores.map((c) => {
      const vs = vendas.filter((v) => v.corretor_id === c.id);
      const vgvMes = vs
        .filter((v) => {
          const d = new Date(v.data_venda + "T12:00:00");
          return d.getFullYear() === ANO && d.getMonth() + 1 === MES;
        })
        .reduce((s, v) => s + Number(v.valor), 0);
      const vgvAno = vs
        .filter((v) => new Date(v.data_venda + "T12:00:00").getFullYear() === ANO)
        .reduce((s, v) => s + Number(v.valor), 0);
      const pontos = entregas
        .filter((e) => e.corretor_id === c.id)
        .reduce((s, e: any) => s + (e.placar_tarefas?.pontos ?? 0), 0);
      const caps = captacoes.filter((cap) => {
        if (cap.corretor_id !== c.id) return false;
        const d = new Date(cap.data_captacao + "T12:00:00");
        return d.getFullYear() === ANO && Math.floor(d.getMonth() / 3) + 1 === TRIMESTRE;
      }).length;
      return { ...c, vgvMes, vgvAno, vendas: vs.length, pontos, captacoes: caps };
    });
  }, [corretores, vendas, entregas, captacoes]);

  const totais = useMemo(
    () => ({
      ativos: porCorretor.filter((c) => c.ativo).length,
      vgvMes: porCorretor.reduce((s, c) => s + c.vgvMes, 0),
      vgvAno: porCorretor.reduce((s, c) => s + c.vgvAno, 0),
      pontos: porCorretor.reduce((s, c) => s + c.pontos, 0),
    }),
    [porCorretor]
  );

  const nomeEquipe = equipes.find((e) => e.id === equipeAtiva)?.nome ?? "—";

  if (equipes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma equipe disponível. O diretor pode criar equipes em Gestão Usuários.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{nomeEquipe}</h2>
          <p className="text-sm text-muted-foreground">
            {TRIMESTRE}º trimestre de {ANO}
          </p>
        </div>
        {isDiretor && equipes.length > 1 && (
          <Select value={equipeAtiva} onValueChange={setEquipeSel}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {equipes.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Corretores ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totais.ativos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VGV do mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totais.vgvMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VGV do ano</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totais.vgvAno)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos no Placar</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totais.pontos}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {porCorretor.map((c) => (
          <Card key={c.id} className="cursor-pointer transition-colors hover:border-primary" onClick={() => navigate(`/corretores/${c.id}`)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{c.nome}</CardTitle>
                <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
              </div>
              {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">VGV do mês</span>
                <span className="font-medium">{formatCurrency(c.vgvMes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VGV do ano</span>
                <span className="font-medium">{formatCurrency(c.vgvAno)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendas ativas</span>
                <span className="font-medium">{c.vendas}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pontos no trimestre</span>
                <span className="font-medium">{c.pontos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Captações
                </span>
                <span className="font-medium">{c.captacoes}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {porCorretor.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum corretor atribuído a esta equipe ainda.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
