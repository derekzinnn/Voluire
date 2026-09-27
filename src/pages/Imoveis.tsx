import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { EMPREENDIMENTO_TIPO_LABELS, nomeImovelPronto } from "@/lib/vendas";
import { Plus, Pencil, Trash2, Home, Building2 } from "lucide-react";

type Modo = "empreendimento" | "pronto";
const VAZIO = { nome: "", tipo: "lancamento", descricao: "", rua: "", numero: "", complemento: "", condominio: "", bairro: "", cidade: "" };
const TIPOS_EMP = Object.entries(EMPREENDIMENTO_TIPO_LABELS).filter(([k]) => k !== "pronto");

export default function Imoveis() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useUserRole();
  const podeGerenciar = can("empreendimentos.gerenciar");
  const [modo, setModo] = useState<Modo | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [filtro, setFiltro] = useState<"todos" | Modo>("todos");
  const set = (k: keyof typeof VAZIO, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: itens = [] } = useQuery({
    queryKey: ["empreendimentos-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empreendimentos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = useMemo(
    () => (itens as any[]).filter((e) => filtro === "todos" || (filtro === "pronto" ? e.tipo === "pronto" : e.tipo !== "pronto")),
    [itens, filtro]
  );

  const fechar = () => { setModo(null); setEditId(null); setForm(VAZIO); };
  const abrir = (m: Modo, e?: any) => {
    setModo(m);
    setEditId(e?.id ?? null);
    setForm(e ? Object.fromEntries(Object.keys(VAZIO).map((k) => [k, e[k] ?? ""])) as typeof VAZIO : { ...VAZIO, tipo: m === "pronto" ? "pronto" : "lancamento" });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const t = (s: string) => s.trim() || null;
      let payload: any;
      if (modo === "pronto") {
        if (!form.rua.trim() || !form.numero.trim()) throw new Error("Rua e número são obrigatórios.");
        payload = {
          tipo: "pronto",
          rua: form.rua.trim(), numero: form.numero.trim(),
          complemento: t(form.complemento), condominio: t(form.condominio),
          bairro: t(form.bairro), cidade: t(form.cidade), descricao: t(form.descricao),
        };
        payload.nome = nomeImovelPronto(payload);
      } else {
        if (!form.nome.trim()) throw new Error("Informe o nome do empreendimento.");
        payload = { nome: form.nome.trim(), tipo: form.tipo, descricao: t(form.descricao), bairro: t(form.bairro), cidade: t(form.cidade) };
      }
      const { error } = editId
        ? await supabase.from("empreendimentos").update(payload).eq("id", editId)
        : await supabase.from("empreendimentos").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empreendimentos-admin"] });
      queryClient.invalidateQueries({ queryKey: ["empreendimentos"] });
      toast({ title: editId ? "Imóvel atualizado!" : "Imóvel cadastrado!" });
      fechar();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empreendimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empreendimentos-admin"] });
      queryClient.invalidateQueries({ queryKey: ["empreendimentos"] });
      toast({ title: "Imóvel excluído" });
    },
    onError: (e: any) => toast({ title: "Não foi possível excluir", description: "Há vendas ligadas a este imóvel. " + e.message, variant: "destructive" }),
  });

  const campo = (k: keyof typeof VAZIO, label: string, props: any = {}) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="empreendimento">Empreendimento</SelectItem>
            <SelectItem value="pronto">Imóvel Pronto</SelectItem>
          </SelectContent>
        </Select>
        {podeGerenciar && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => abrir("pronto")}><Plus className="mr-2 h-4 w-4" />Imóvel Pronto</Button>
            <Button onClick={() => abrir("empreendimento")}><Plus className="mr-2 h-4 w-4" />Empreendimento</Button>
          </div>
        )}
      </div>

      <Dialog open={modo !== null} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar" : "Novo"} {modo === "pronto" ? "imóvel pronto" : "empreendimento"}</DialogTitle>
          </DialogHeader>
          {modo === "pronto" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                {campo("rua", "Rua *", { maxLength: 150 })}
                {campo("numero", "Número *", { maxLength: 20 })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {campo("complemento", "Complemento", { placeholder: "Ex.: Apto 12 (casas geralmente não têm)", maxLength: 80 })}
                {campo("condominio", "Condomínio", { placeholder: "Deixe vazio se for casa", maxLength: 120 })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {campo("bairro", "Bairro", { maxLength: 80 })}
                {campo("cidade", "Cidade", { maxLength: 80 })}
              </div>
              {(form.rua || form.numero) && (
                <p className="text-sm text-muted-foreground">Aparecerá como: <span className="font-medium text-foreground">{nomeImovelPronto(form)}</span></p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {campo("nome", "Nome *", { maxLength: 120 })}
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_EMP.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {campo("bairro", "Bairro", { maxLength: 80 })}
                {campo("cidade", "Cidade", { maxLength: 80 })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Imóveis</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Bairro / Cidade</TableHead>
                <TableHead>Observações</TableHead>
                {podeGerenciar && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum imóvel cadastrado.</TableCell></TableRow>
              )}
              {lista.map((e) => {
                const pronto = e.tipo === "pronto";
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{pronto && e.rua ? nomeImovelPronto(e) : e.nome}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={pronto ? "default" : "secondary"} className="gap-1">
                          {pronto ? <Home className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {pronto ? "Imóvel Pronto" : "Empreendimento"}
                        </Badge>
                        {!pronto && <Badge variant="outline">{EMPREENDIMENTO_TIPO_LABELS[e.tipo] ?? e.tipo}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{[e.bairro, e.cidade].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.descricao || "—"}</TableCell>
                    {podeGerenciar && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => abrir(pronto ? "pronto" : "empreendimento", e)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => excluir.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
