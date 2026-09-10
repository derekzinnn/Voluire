import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPercent, formatCNPJ, formatPhone } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, Pencil, Trash2 } from "lucide-react";

const TIPOS: Record<string, string> = { construtora: "Construtora", imobiliaria: "Imobiliária", outro: "Outro" };

type Form = {
  nome: string; tipo: string; cnpj: string; creci: string; pix: string;
  telefone: string; email: string; endereco: string; comissao_percentual: string;
  observacao: string; ativo: boolean;
};

const empty = (): Form => ({
  nome: "", tipo: "construtora", cnpj: "", creci: "", pix: "",
  telefone: "", email: "", endereco: "", comissao_percentual: "6",
  observacao: "", ativo: true,
});

export default function Parceiros() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useUserRole();
  const isGestor = can("parceiros.gerenciar");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty());
  const set = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parceiros").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do parceiro.");
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        cnpj: form.cnpj || null,
        creci: form.creci || null,
        pix: form.pix || null,
        telefone: form.telefone || null,
        email: form.email || null,
        endereco: form.endereco || null,
        comissao_percentual: Number(form.comissao_percentual) || 0,
        observacao: form.observacao || null,
        ativo: form.ativo,
      };
      if (editId) {
        const { error } = await supabase.from("parceiros").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parceiros").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parceiros"] });
      queryClient.invalidateQueries({ queryKey: ["parceiros-ativos"] });
      toast({ title: editId ? "Parceiro atualizado!" : "Parceiro cadastrado!" });
      setOpen(false); setEditId(null); setForm(empty());
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parceiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parceiros"] });
      toast({ title: "Parceiro excluído" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function abrirEdicao(p: any) {
    setEditId(p.id);
    setForm({
      nome: p.nome ?? "", tipo: p.tipo ?? "construtora", cnpj: p.cnpj ?? "", creci: p.creci ?? "",
      pix: p.pix ?? "", telefone: p.telefone ?? "", email: p.email ?? "", endereco: p.endereco ?? "",
      comissao_percentual: String(p.comissao_percentual ?? "6"), observacao: p.observacao ?? "", ativo: !!p.ativo,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      {isGestor && (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(empty()); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo parceiro</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Editar parceiro" : "Novo parceiro"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} maxLength={18} placeholder="00.000.000/0000-00" onChange={(e) => set("cnpj", formatCNPJ(e.target.value))} /></div>
              <div className="space-y-2"><Label>CRECI</Label><Input value={form.creci} onChange={(e) => set("creci", e.target.value)} /></div>
              <div className="space-y-2"><Label>Pix</Label><Input value={form.pix} onChange={(e) => set("pix", e.target.value)} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} maxLength={15} placeholder="(51) 90000-0000" onChange={(e) => set("telefone", formatPhone(e.target.value))} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Comissão padrão (%)</Label>
                <Input type="number" step="0.01" value={form.comissao_percentual} onChange={(e) => set("comissao_percentual", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Observação</Label><Textarea rows={2} value={form.observacao} onChange={(e) => set("observacao", e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select value={form.ativo ? "1" : "0"} onValueChange={(v) => set("ativo", v === "1")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Ativo</SelectItem>
                    <SelectItem value="0">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>CRECI</TableHead>
                <TableHead>Pix</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Situação</TableHead>
                {isGestor && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(parceiros as any[]).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{TIPOS[p.tipo] ?? p.tipo}</TableCell>
                  <TableCell>{p.cnpj ?? "—"}</TableCell>
                  <TableCell>{p.creci ?? "—"}</TableCell>
                  <TableCell>{p.pix ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    <div>{p.telefone ?? "—"}</div>
                    <div className="text-muted-foreground">{p.email ?? ""}</div>
                  </TableCell>
                  <TableCell>{formatPercent(Number(p.comissao_percentual))}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  {isGestor && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir este parceiro?")) excluir.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {parceiros.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum parceiro cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
