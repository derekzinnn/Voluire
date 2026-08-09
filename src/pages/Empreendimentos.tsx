import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { EMPREENDIMENTO_TIPO_LABELS } from "@/lib/vendas";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function Empreendimentos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isGestor } = useUserRole();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "lancamento", descricao: "" });

  const { data: itens = [] } = useQuery({
    queryKey: ["empreendimentos-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empreendimentos").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do empreendimento.");
      const payload = { nome: form.nome.trim(), tipo: form.tipo, descricao: form.descricao || null };
      if (editId) {
        const { error } = await supabase.from("empreendimentos").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empreendimentos").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empreendimentos-admin"] });
      queryClient.invalidateQueries({ queryKey: ["empreendimentos"] });
      toast({ title: editId ? "Empreendimento atualizado!" : "Empreendimento criado!" });
      setOpen(false);
      setEditId(null);
      setForm({ nome: "", tipo: "lancamento", descricao: "" });
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
      toast({ title: "Empreendimento excluído" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {isGestor && (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm({ nome: "", tipo: "lancamento", descricao: "" }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo empreendimento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar empreendimento" : "Novo empreendimento"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPREENDIMENTO_TIPO_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.tipo === "pronto" && (
                  <p className="text-xs text-muted-foreground">
                    Imóvel pronto: da comissão bruta, 10% vai para o agenciador (captador) e 40% para o vendedor.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader><CardTitle>Empreendimentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                {isGestor && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum empreendimento cadastrado.</TableCell></TableRow>
              )}
              {(itens as any[]).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell>
                    <Badge variant={e.tipo === "pronto" ? "default" : "secondary"}>
                      {EMPREENDIMENTO_TIPO_LABELS[e.tipo as keyof typeof EMPREENDIMENTO_TIPO_LABELS] ?? e.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.descricao || "—"}</TableCell>
                  {isGestor && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditId(e.id); setForm({ nome: e.nome ?? "", tipo: e.tipo ?? "lancamento", descricao: e.descricao ?? "" }); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => excluir.mutate(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
