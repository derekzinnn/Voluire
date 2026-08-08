import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, parseLocalDate } from "@/lib/format";
import { Plus, Target, Users, Pencil } from "lucide-react";

export default function Metas() {
  const [open, setOpen] = useState(false);
  const [editMeta, setEditMeta] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();


  const { data: metas = [] } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*, corretores(nome)").eq("ano", currentYear);
      return data || [];
    },
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("valor, data_venda, status").neq("status", "distrato");
      return data || [];
    },
  });

  const { data: captacoes = [] } = useQuery({
    queryKey: ["captacoes"],
    queryFn: async () => {
      const { data } = await supabase.from("captacoes").select("id, data_captacao");
      return data || [];
    },
  });

  const createMeta = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("metas").insert({
        tipo: formData.get("tipo") as string,
        valor: Number(formData.get("valor")),
        ano: currentYear,
        mes: formData.get("mes") ? Number(formData.get("mes")) : null,
        trimestre: formData.get("trimestre") ? Number(formData.get("trimestre")) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setOpen(false);
      toast({ title: "Meta criada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await supabase.from("metas").update({ valor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setEditMeta(null);
      toast({ title: "Meta atualizada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });



  const vendasAno = vendas.filter(v => {
    const d = parseLocalDate(v.data_venda);
    return d && d.getFullYear() === currentYear;
  });
  const vgvAno = vendasAno.reduce((s, v) => s + Number(v.valor), 0);
  const captacoesAno = captacoes.filter(c => {
    const d = parseLocalDate(c.data_captacao);
    return d && d.getFullYear() === currentYear;
  });
  const totalCaptacoesAno = captacoesAno.length;

  // Separate metas by categoria
  const metasVgv = metas.filter(m => (m as any).categoria !== "agenciamentos");
  const metasAgenciamentos = metas.filter(m => (m as any).categoria === "agenciamentos");

  const metaAnualVgv = metasVgv.find(m => m.tipo === "anual");
  const metaAnualAgenciamentos = metasAgenciamentos.find(m => m.tipo === "anual");

  const getVgvForMeta = (meta: any) => {
    if (meta.tipo === "trimestral" && meta.trimestre) {
      const startMonth = (meta.trimestre - 1) * 3;
      return vendasAno.filter(v => {
        const m = parseLocalDate(v.data_venda)?.getMonth();
        return m !== undefined && m >= startMonth && m < startMonth + 3;
      }).reduce((s, v) => s + Number(v.valor), 0);
    } else if (meta.tipo === "mensal" && meta.mes) {
      return vendasAno.filter(v => {
        const m = parseLocalDate(v.data_venda)?.getMonth();
        return m !== undefined && m + 1 === meta.mes;
      }).reduce((s, v) => s + Number(v.valor), 0);
    }
    return 0;
  };

  const getCaptacoesForMeta = (meta: any) => {
    if (meta.tipo === "trimestral" && meta.trimestre) {
      const startMonth = (meta.trimestre - 1) * 3;
      return captacoesAno.filter(c => {
        const m = parseLocalDate(c.data_captacao)?.getMonth();
        return m !== undefined && m >= startMonth && m < startMonth + 3;
      }).length;
    } else if (meta.tipo === "mensal" && meta.mes) {
      return captacoesAno.filter(c => {
        const m = parseLocalDate(c.data_captacao)?.getMonth();
        return m !== undefined && m + 1 === meta.mes;
      }).length;
    }
    return 0;
  };

  const renderMetaCard = (meta: any, realizado: number, metaValor: number, isCurrency: boolean) => {
    const pct = metaValor > 0 ? (realizado / metaValor) * 100 : 0;
    const metaBatida = pct >= 100;
    return (
      <Card key={meta.id} className={metaBatida ? "border-green-500 bg-green-50 dark:bg-green-950/30" : ""}>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className={`text-sm ${metaBatida ? "text-green-700 dark:text-green-400" : ""}`}>
            {meta.tipo === "trimestral" ? `${meta.trimestre}º Trimestre` : meta.tipo === "mensal" && meta.mes ? `Mês ${meta.mes}` : meta.tipo}
            {metaBatida && " ✅"}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditMeta(meta)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>

        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={metaBatida ? "text-green-700 dark:text-green-400 font-semibold" : ""}>
              {isCurrency ? formatCurrency(realizado) : realizado}
            </span>
            <span className="text-muted-foreground">
              {isCurrency ? formatCurrency(metaValor) : metaValor}
            </span>
          </div>
          <Progress value={Math.min(pct, 100)} className={metaBatida ? "[&>div]:bg-green-500" : ""} />
          <p className={`text-xs text-center ${metaBatida ? "text-green-600 dark:text-green-400 font-semibold" : "text-muted-foreground"}`}>{pct.toFixed(1)}%</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Meta</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMeta.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select name="tipo" defaultValue="anual">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Valor (R$)</Label><Input name="valor" type="number" step="0.01" required /></div>
              <Button type="submit" className="w-full" disabled={createMeta.isPending}>Criar Meta</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* === META VGV === */}
      {metaAnualVgv && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Meta VGV Anual {currentYear}</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditMeta(metaAnualVgv)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>VGV Realizado: <strong>{formatCurrency(vgvAno)}</strong></span>
              <span>Meta: <strong>{formatCurrency(Number(metaAnualVgv.valor))}</strong></span>
            </div>
            <Progress value={Math.min((vgvAno / Number(metaAnualVgv.valor)) * 100, 100)} />
            <p className="text-sm text-muted-foreground text-center">
              {((vgvAno / Number(metaAnualVgv.valor)) * 100).toFixed(1)}% da meta
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metasVgv.filter(m => m.tipo !== "anual").map(meta =>
          renderMetaCard(meta, getVgvForMeta(meta), Number(meta.valor), true)
        )}
      </div>

      {/* === META AGENCIAMENTOS === */}
      {metaAnualAgenciamentos && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Meta Agenciamentos {currentYear}</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditMeta(metaAnualAgenciamentos)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Captações Realizadas: <strong>{totalCaptacoesAno}</strong></span>
                <span>Meta: <strong>{Number(metaAnualAgenciamentos.valor)}</strong></span>
              </div>
              <Progress value={Math.min((totalCaptacoesAno / Number(metaAnualAgenciamentos.valor)) * 100, 100)} />
              <p className="text-sm text-muted-foreground text-center">
                {((totalCaptacoesAno / Number(metaAnualAgenciamentos.valor)) * 100).toFixed(1)}% da meta
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metasAgenciamentos.filter(m => m.tipo !== "anual").map(meta =>
              renderMetaCard(meta, getCaptacoesForMeta(meta), Number(meta.valor), false)
            )}
          </div>
        </>
      )}

      {metas.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma meta cadastrada. Clique em "Nova Meta" para começar.</CardContent></Card>
      )}

      <Dialog open={!!editMeta} onOpenChange={o => !o && setEditMeta(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar meta{editMeta ? ` — ${editMeta.tipo === "mensal" ? `Mês ${editMeta.mes}` : editMeta.tipo === "trimestral" ? `${editMeta.trimestre}º Trimestre` : "Anual"}` : ""}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              const valor = Number(new FormData(e.currentTarget).get("valor"));
              updateMeta.mutate({ id: editMeta.id, valor });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input name="valor" type="number" step="0.01" defaultValue={editMeta ? Number(editMeta.valor) : 0} required />
            </div>
            <Button type="submit" className="w-full" disabled={updateMeta.isPending}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
