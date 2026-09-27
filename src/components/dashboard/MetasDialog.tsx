import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MESES, formatCurrencyInput, numberToCurrencyInput, parseCurrencyInput } from "@/lib/format";
import { anosDisponiveis, hojeSP, type TipoPeriodo } from "@/lib/metas";
import { Target } from "lucide-react";

type Campo = { tipo: TipoPeriodo; periodo: number; label: string };
const CAMPOS: Campo[] = [
  ...MESES.map((m, i) => ({ tipo: "mes" as const, periodo: i + 1, label: m })),
  ...[1, 2, 3, 4].map((t) => ({ tipo: "trimestre" as const, periodo: t, label: `${t}º trimestre` })),
  { tipo: "ano", periodo: 0, label: "Ano inteiro" },
];
const k = (c: { tipo: string; periodo: number }) => `${c.tipo}-${c.periodo}`;

export function MetasDialog() {
  const hoje = hojeSP();
  const [open, setOpen] = useState(false);
  const [ano, setAno] = useState(hoje.ano);
  const [valores, setValores] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: metas } = useQuery({
    queryKey: ["metas-vgv-edit", ano],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("metas_vgv").select("tipo, periodo, valor").eq("ano", ano);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const v: Record<string, string> = {};
    (metas ?? []).forEach((m: any) => (v[k(m)] = numberToCurrencyInput(m.valor)));
    setValores(v);
  }, [metas]);

  const salvar = useMutation({
    mutationFn: async () => {
      const upserts: any[] = [];
      const apagar: Campo[] = [];
      CAMPOS.forEach((c) => {
        const s = (valores[k(c)] ?? "").trim();
        if (s) upserts.push({ tipo: c.tipo, ano, periodo: c.periodo, valor: parseCurrencyInput(s) });
        else apagar.push(c);
      });
      if (upserts.length) {
        const { error } = await supabase.from("metas_vgv").upsert(upserts, { onConflict: "tipo,ano,periodo" });
        if (error) throw error;
      }
      for (const c of apagar) {
        const { error } = await supabase.from("metas_vgv").delete().eq("ano", ano).eq("tipo", c.tipo).eq("periodo", c.periodo);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-vgv"] });
      qc.invalidateQueries({ queryKey: ["metas-vgv-edit"] });
      toast({ title: "Metas salvas" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const campo = (c: Campo) => (
    <div key={k(c)} className="space-y-1">
      <Label className="text-xs">{c.label}</Label>
      <Input
        inputMode="numeric"
        placeholder="—"
        value={valores[k(c)] ?? ""}
        onChange={(e) => setValores((s) => ({ ...s, [k(c)]: formatCurrencyInput(e.target.value) }))}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Target className="h-4 w-4" /> Metas</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Metas de VGV</DialogTitle>
          <DialogDescription>
            Trimestre e ano em branco = soma das metas mensais. Preencha só se quiser uma meta própria.
          </DialogDescription>
        </DialogHeader>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>{anosDisponiveis(hoje.ano + 1).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-sm font-medium">Mensais</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{CAMPOS.filter((c) => c.tipo === "mes").map(campo)}</div>
        <p className="text-sm font-medium">Específicas (opcional)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{CAMPOS.filter((c) => c.tipo !== "mes").map(campo)}</div>
        <DialogFooter>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar metas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
