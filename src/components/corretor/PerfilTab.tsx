import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Lock, Upload } from "lucide-react";
import { formatCPF, formatPhone } from "@/lib/format";

interface Props {
  corretorId: string;
  perfil: any;
  podeGerenciar: boolean;
  ehProprio: boolean;
  isDiretor?: boolean;
}




export default function PerfilTab({ corretorId, perfil, podeGerenciar, isDiretor = false }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  // CPF: valor completo só para diretor, mascarado para gerente, nulo para os demais.
  const { data: cpf } = useQuery({
    queryKey: ["corretor-cpf", corretorId],
    enabled: podeGerenciar,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_corretor_cpf", { p_corretor_id: corretorId });
      if (error) throw error;
      return (data as string | null) ?? "";
    },
  });

  const salvarCpf = useMutation({
    mutationFn: async (valor: string) => {
      const { error } = await supabase
        .from("corretor_documentos")
        .upsert({ corretor_id: corretorId, cpf: valor.trim() || null }, { onConflict: "corretor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corretor-cpf", corretorId] });
      toast({ title: "CPF atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar CPF", description: e.message, variant: "destructive" }),
  });

  const { data: notas } = useQuery({
    queryKey: ["corretor-notas", corretorId],
    enabled: podeGerenciar,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corretor_perfil_notas")
        .select("*")
        .eq("corretor_id", corretorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  const salvarPerfil = useMutation({
    mutationFn: async (valores: Record<string, any>) => {
      const { error } = await supabase
        .from("corretor_perfis")
        .upsert({ corretor_id: corretorId, ...valores }, { onConflict: "corretor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corretor-perfil", corretorId] });
      toast({ title: "Perfil salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const salvarNotas = useMutation({
    mutationFn: async (observacoes: string) => {
      const { error } = await supabase
        .from("corretor_perfil_notas")
        .upsert({ corretor_id: corretorId, observacoes }, { onConflict: "corretor_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corretor-notas", corretorId] });
      toast({ title: "Observações salvas" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const enviarFoto = async (file: File) => {
    setEnviandoFoto(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${corretorId}/foto-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("corretor-fotos").upload(path, file, { upsert: true });
    setEnviandoFoto(false);
    if (error) {
      toast({ title: "Erro no upload da foto", description: error.message, variant: "destructive" });
      return;
    }
    salvarPerfil.mutate({ foto_url: path });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = fd.get(k) as string;
      return v === "" ? null : Number(v);
    };
    const txt = (k: string) => {
      const v = (fd.get(k) as string)?.trim();
      return v ? v : null;
    };
    salvarPerfil.mutate({
      data_nascimento: txt("data_nascimento"),
      telefone_pessoal: txt("telefone_pessoal"),
      email_pessoal: txt("email_pessoal"),
      creci: txt("creci"),
    });
    // CPF vive em tabela protegida; só a diretoria enxerga e grava o valor real.
    if (isDiretor) {
      const novoCpf = ((fd.get("cpf") as string) ?? "").trim();
      if (novoCpf !== (cpf ?? "")) salvarCpf.mutate(novoCpf);
    }
  };


  const readOnly = !podeGerenciar;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input type="date" name="data_nascimento" defaultValue={perfil?.data_nascimento ?? ""} disabled={readOnly} />
              </div>
              <div className="space-y-2">
                <Label>Telefone pessoal</Label>
                <Input
                  name="telefone_pessoal"
                  defaultValue={perfil?.telefone_pessoal ?? ""}
                  disabled={readOnly}
                  maxLength={15}
                  placeholder="(51) 90000-0000"
                  onChange={(e) => {
                    e.target.value = formatPhone(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail pessoal</Label>
                <Input type="email" name="email_pessoal" defaultValue={perfil?.email_pessoal ?? ""} disabled={readOnly} />
              </div>
              <div className="space-y-2">
                <Label>CRECI</Label>
                <Input name="creci" defaultValue={perfil?.creci ?? ""} disabled={readOnly} />
              </div>
              {podeGerenciar && (
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    name="cpf"
                    key={cpf ?? "cpf"}
                    defaultValue={cpf ?? ""}
                    disabled={!isDiretor}
                    maxLength={14}
                    placeholder={isDiretor ? "000.000.000-00" : "Sem CPF cadastrado"}
                    onChange={(e) => {
                      e.target.value = formatCPF(e.target.value);
                    }}
                  />
                  {!isDiretor && (
                    <p className="text-xs text-muted-foreground">Mascarado — apenas a diretoria vê o CPF completo.</p>
                  )}
                </div>
              )}

            </div>




            {podeGerenciar && (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={salvarPerfil.isPending}>
                  {salvarPerfil.isPending ? "Salvando..." : "Salvar perfil"}
                </Button>
                <Label
                  htmlFor="foto-corretor"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  <Upload className="h-4 w-4" />
                  {enviandoFoto ? "Enviando..." : "Enviar foto"}
                </Label>
                <input
                  id="foto-corretor"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) enviarFoto(f);
                  }}
                />
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {podeGerenciar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-muted-foreground" /> Observações do gestor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                salvarNotas.mutate((fd.get("observacoes") as string) ?? "");
              }}
              className="space-y-3"
            >
              <Textarea
                name="observacoes"
                rows={5}
                defaultValue={notas?.observacoes ?? ""}
                key={notas?.id ?? "novo"}
                placeholder="Anotações internas visíveis apenas para diretoria e gestão da equipe."
              />
              <Button type="submit" disabled={salvarNotas.isPending}>
                {salvarNotas.isPending ? "Salvando..." : "Salvar observações"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
