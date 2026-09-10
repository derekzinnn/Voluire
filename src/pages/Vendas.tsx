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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatCurrency, formatDate, formatPercent, formatCurrencyInput, numberToCurrencyInput, parseCurrencyInput } from "@/lib/format";
import { FORMA_PAGAMENTO_LABELS, EMPREENDIMENTO_TIPO_LABELS } from "@/lib/vendas";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, Pencil, Trash2, Receipt, CalendarIcon, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";

const NONE = "__none__";

function AdiarPopover({ onConfirm }: { onConfirm: (dias: number) => void }) {
  const [open, setOpen] = useState(false);
  const [dias, setDias] = useState("30");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">Adiar</Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2 pointer-events-auto" align="end">
        <Label>Adiar por quantos dias?</Label>
        <Input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} />
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            const n = Number(dias);
            if (!n || n < 1) return;
            onConfirm(n);
            setOpen(false);
          }}
        >
          Confirmar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function DatePickerField({ value, onChange, placeholder = "Selecione" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const date = value ? new Date(value + "T12:00:00") : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? d.toISOString().split("T")[0] : "")}
          initialFocus
          className="p-3 pointer-events-auto"
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}
const statusColors: Record<string, string> = {
  ativa: "bg-emerald-100 text-emerald-800",
  distrato: "bg-red-100 text-red-800",
  quitada: "bg-blue-100 text-blue-800",
};

const STEPS = [
  { title: "Contrato", desc: "Etapa 1 de 4 — identificação do contrato e do imóvel." },
  { title: "Informações", desc: "Etapa 2 de 4 — comprador, vendedor, agenciamento e corretores." },
  { title: "Valores", desc: "Etapa 3 de 4 — valor da venda e comissão bruta." },
  { title: "Pagamento", desc: "Etapa 4 de 4 — forma de pagamento e cronograma de recebimento." },
];

type FormState = {
  numero_contrato: string;
  cliente_nome: string;
  vendedor_nome: string;
  tem_parceria: string;
  parceria_nome: string;
  unidade: string;
  empreendimento_id: string;
  valor: string;
  data_venda: string;
  comissao_percentual_bruta: string;
  forma_pagamento: string;
  captador_corretor_id: string;
  agenciador_tipo: string;
  status: string;
  observacao: string;
  corretor1_id: string;
  corretor1_part: string;
  corretor2_id: string;
  corretor2_part: string;
  qtd_parcelas: string;
  primeira_parcela: string;
};

const emptyForm = (): FormState => ({
  numero_contrato: "",
  cliente_nome: "",
  vendedor_nome: "",
  tem_parceria: "nao",
  parceria_nome: "",
  unidade: "",
  empreendimento_id: NONE,
  valor: "",
  data_venda: new Date().toISOString().split("T")[0],
  comissao_percentual_bruta: "6",
  forma_pagamento: "a_vista",
  captador_corretor_id: NONE,
  agenciador_tipo: "proprio",
  status: "ativa",
  observacao: "",
  corretor1_id: "",
  corretor1_part: "50",
  corretor2_id: NONE,
  corretor2_part: "0",
  qtd_parcelas: "1",
  primeira_parcela: new Date().toISOString().split("T")[0],
});

export default function Vendas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = useUserRole();
  const isGestor = can("vendas.gerenciar");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [parcelasVenda, setParcelasVenda] = useState<any | null>(null);
  const [parcelasEdit, setParcelasEdit] = useState<{ valor: string; data_prevista: string }[]>([]);
  const [step, setStep] = useState(0);
  const [temOutroCorretor, setTemOutroCorretor] = useState(false);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function avancar() {
    const erro = (msg: string) => {
      toast({ title: "Complete a etapa", description: msg, variant: "destructive" });
      return true;
    };
    if (step === 0) {
      if (!form.numero_contrato.trim()) return erro("Informe o número do contrato.");
      if (!form.data_venda) return erro("Informe a data da venda.");
      if (!form.unidade.trim()) return erro("Informe a unidade.");
      if (!isPronto && form.empreendimento_id === NONE) return erro("Selecione o tipo de imóvel.");
    }
    if (step === 1) {
      if (!form.cliente_nome.trim()) return erro("Informe o cliente comprador.");
      if (isPronto && !form.vendedor_nome.trim()) return erro("Informe o cliente vendedor (proprietário).");
      if (isPronto) {
        if (form.agenciador_tipo === "corretor" && form.captador_corretor_id === NONE)
          return erro("Selecione o colega que agenciou o imóvel.");
      } else {
        if (!form.vendedor_nome.trim()) return erro("Informe o nome da construtora (vendedor).");
      }
      if (!form.corretor1_id) return erro("Selecione o corretor responsável.");
      if (temOutroCorretor && form.corretor2_id === NONE) return erro("Selecione qual foi o outro corretor da venda.");
      if (form.corretor2_id !== NONE && isPronto) {
        const p1 = Number(form.corretor1_part) || 0;
        const p2 = Number(form.corretor2_part) || 0;
        if (p1 < 0 || p1 > 100) return erro("Participação do corretor responsável deve estar entre 0% e 100%.");
        if (p2 < 0 || p2 > 100) return erro("Participação do outro corretor deve estar entre 0% e 100%.");
        if (Math.abs(p1 + p2 - 100) > 0.01) return erro("A participação dos dois corretores deve somar 100%.");
      }
    }
    if (step === 2) {
      if (!(Number(form.valor) > 0)) return erro("Informe o valor da venda.");
      if (!(Number(form.comissao_percentual_bruta) > 0)) return erro("Informe a comissão bruta (%).");
      if (form.tem_parceria === "sim" && !form.parceria_nome.trim()) return erro("Informe o nome do parceiro.");
    }
    if (step === 3) {
      if (form.forma_pagamento === "a_vista") {
        if (!form.primeira_parcela) return erro("Informe a data prevista de recebimento.");
      } else {
        if (parcelasEdit.length === 0) return erro("Gere ou adicione as parcelas.");
        if (parcelasEdit.some((p) => !p.data_prevista)) return erro("Informe a data de todas as parcelas.");
        if (Math.abs(totalParcelas - (Number(form.valor) || 0)) > 0.05)
          return erro("A soma das parcelas deve fechar com o valor da venda.");
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function gerarParcelas(qtd: number, primeira: string, valorTotal: number) {
    const n = Math.max(1, qtd || 1);
    const base = new Date((primeira || new Date().toISOString().split("T")[0]) + "T12:00:00");
    const bruto = Math.round(((valorTotal || 0) / n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      // última parcela absorve a diferença de centavos
      const valor = i === n - 1 ? Math.round(((valorTotal || 0) - bruto * (n - 1)) * 100) / 100 : bruto;
      return { valor: String(valor), data_prevista: d.toISOString().split("T")[0] };
    });
  }

  const regenerar = () =>
    setParcelasEdit(gerarParcelas(Number(form.qtd_parcelas), form.primeira_parcela, Number(form.valor)));

  const setParcela = (i: number, k: "valor" | "data_prevista", v: string) =>
    setParcelasEdit((arr) => arr.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));

  const totalParcelas = parcelasEdit.reduce((s, p) => s + (Number(p.valor) || 0), 0);

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select(
          "*, empreendimentos(nome), venda_corretores(id, corretor_id, percentual_corretor, participacao_percentual, corretores(nome)), comissoes(valor_total, valor_corretores, valor_empresa, status)"
        )
        .order("data_venda", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("id, nome, comissao_percentual").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["empreendimentos"],
    queryFn: async () => {
      const { data } = await supabase.from("empreendimentos").select("id, nome, tipo").order("nome");
      return data ?? [];
    },
  });


  const { data: parcelas = [] } = useQuery({
    queryKey: ["venda-parcelas", parcelasVenda?.id],
    enabled: !!parcelasVenda,
    queryFn: async () => {
      const { data } = await supabase
        .from("venda_parcelas")
        .select("*")
        .eq("venda_id", parcelasVenda.id)
        .order("numero");
      return data ?? [];
    },
  });

  const empSelecionado = (empreendimentos as any[]).find((e) => e.id === form.empreendimento_id);
  const isPronto = empSelecionado?.tipo === "pronto";
  const vendedorFinal = form.vendedor_nome;
  const pctBruta = Number(form.comissao_percentual_bruta) || 0;
  const comissaoBruta = (Number(form.valor) || 0) * pctBruta / 100;
  const descontoAgenciador = !isPronto
    ? 0
    : form.agenciador_tipo === "voluire"
      ? 5
      : form.agenciador_tipo === "corretor"
        ? 10
        : 0;
  const splitCorretor1 = Number(corretores.find((c) => c.id === form.corretor1_id)?.comissao_percentual) || 50;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.numero_contrato.trim()) throw new Error("Informe o número do contrato.");
      if (!form.corretor1_id) throw new Error("Selecione o corretor responsável.");
      if (temOutroCorretor && form.corretor2_id === NONE) throw new Error("Selecione qual foi o outro corretor da venda.");
      if (isPronto) {
        if (form.agenciador_tipo === "corretor" && form.captador_corretor_id === NONE)
          throw new Error("Selecione o colega que agenciou o imóvel.");
      } else if (form.empreendimento_id !== NONE && !form.vendedor_nome.trim()) {
        throw new Error("Venda de empreendimento exige o nome da construtora (vendedor).");
      }
      const p1 = Number(form.corretor1_part) || 0;
      const p2 = form.corretor2_id !== NONE ? Number(form.corretor2_part) || 0 : 0;
      if (form.corretor2_id !== NONE && isPronto) {
        if (p1 < 0 || p1 > 100) throw new Error("Participação do corretor responsável deve estar entre 0% e 100%.");
        if (p2 < 0 || p2 > 100) throw new Error("Participação do outro corretor deve estar entre 0% e 100%.");
        if (Math.abs(p1 + p2 - 100) > 0.01) throw new Error("A participação dos dois corretores deve somar 100%.");
      }

      const payload = {
        numero_contrato: form.numero_contrato.trim(),
        cliente_nome: form.cliente_nome,
        vendedor_nome: vendedorFinal.trim() ? vendedorFinal.trim() : null,
        tem_parceria: form.tem_parceria === "sim",
        parceria_nome: form.tem_parceria === "sim" ? form.parceria_nome.trim() || null : null,
        unidade: form.unidade,
        empreendimento_id: form.empreendimento_id === NONE ? null : form.empreendimento_id,
        parceiro_id: null,
        valor: Number(form.valor),
        data_venda: form.data_venda,
        comissao_percentual_bruta:
          form.tem_parceria === "sim" ? Number(form.comissao_percentual_bruta) || 6 : 6,
        forma_pagamento: form.forma_pagamento,
        captador_corretor_id:
          isPronto && form.agenciador_tipo === "corretor" && form.captador_corretor_id !== NONE
            ? form.captador_corretor_id
            : form.captador_corretor_id === NONE
              ? null
              : form.captador_corretor_id,
        agenciador_tipo: isPronto ? form.agenciador_tipo : "proprio",
        status: form.status,
        observacao: form.observacao || null,
      };

      let vendaId = editId;
      if (editId) {
        const { error } = await supabase.from("vendas").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("venda_corretores").delete().eq("venda_id", editId);
      } else {
        const { data, error } = await supabase.from("vendas").insert([payload]).select("id").single();
        if (error) throw error;
        vendaId = data.id;
      }

      const pct = (id: string) => Number(corretores.find((c) => c.id === id)?.comissao_percentual) || 50;
      let part1: number, part2: number;
      if (isPronto) {
        part1 = form.corretor2_id !== NONE ? p1 : 100;
        part2 = p2;
      } else {
        if (form.corretor2_id !== NONE) {
          part1 = pct(form.corretor1_id) / 2;
          part2 = pct(form.corretor2_id) / 2;
        } else {
          part1 = pct(form.corretor1_id);
          part2 = 0;
        }
      }
      const rows = [
        { venda_id: vendaId!, corretor_id: form.corretor1_id, participacao_percentual: part1, percentual_corretor: pct(form.corretor1_id) },
      ];
      if (form.corretor2_id !== NONE)
        rows.push({ venda_id: vendaId!, corretor_id: form.corretor2_id, participacao_percentual: part2, percentual_corretor: pct(form.corretor2_id) });
      const { error: vcErr } = await supabase.from("venda_corretores").insert(rows);
      if (vcErr) throw vcErr;

      // Parcelas: recriadas conforme a forma de pagamento
      await supabase.from("venda_parcelas").delete().eq("venda_id", vendaId!);
      const cronograma =
        form.forma_pagamento === "a_vista"
          ? [{ valor: form.valor, data_prevista: form.primeira_parcela }]
          : parcelasEdit.length > 0
            ? parcelasEdit
            : gerarParcelas(Number(form.qtd_parcelas), form.primeira_parcela, Number(form.valor));
      if (cronograma.some((p) => !p.data_prevista)) throw new Error("Informe a data prevista de todas as parcelas.");
      const parcelasRows = cronograma.map((p, i) => ({
        venda_id: vendaId!,
        numero: i + 1,
        valor: Number(p.valor) || 0,
        data_prevista: p.data_prevista,
        tipo: form.forma_pagamento,
        status: "prevista",
      }));
      const { error: pErr } = await supabase.from("venda_parcelas").insert(parcelasRows);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast({ title: editId ? "Contrato atualizado!" : "Contrato registrado!" });
      setOpen(false);
      setEditId(null);
      setForm(emptyForm());
      setParcelasEdit([]);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast({ title: "Contrato excluído" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const atualizarParcela = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("venda_parcelas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venda-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      toast({ title: "Parcela atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  async function abrirEdicao(v: any) {
    const parts = v.venda_corretores ?? [];
    setEditId(v.id);
    const { data: ps } = await supabase
      .from("venda_parcelas")
      .select("valor, data_prevista")
      .eq("venda_id", v.id)
      .order("numero");
    setParcelasEdit((ps ?? []).map((p: any) => ({ valor: String(p.valor), data_prevista: p.data_prevista })));
    setForm({
      numero_contrato: v.numero_contrato ?? "",
      cliente_nome: v.cliente_nome ?? "",
      vendedor_nome: v.vendedor_nome ?? "",
      tem_parceria: v.tem_parceria ? "sim" : "nao",
      parceria_nome: v.parceria_nome ?? "",
      unidade: v.unidade ?? "",
      empreendimento_id: v.empreendimento_id ?? NONE,
      valor: String(v.valor ?? ""),
      data_venda: v.data_venda ?? "",
      comissao_percentual_bruta: String(v.comissao_percentual_bruta ?? 6),
      forma_pagamento: v.forma_pagamento ?? "a_vista",
      captador_corretor_id: v.captador_corretor_id ?? NONE,
      agenciador_tipo: v.agenciador_tipo ?? "proprio",
      status: v.status ?? "ativa",
      observacao: v.observacao ?? "",
      corretor1_id: parts[0]?.corretor_id ?? "",
      corretor1_part: String(parts[0]?.participacao_percentual ?? 100),
      corretor2_id: parts[1]?.corretor_id ?? NONE,
      corretor2_part: String(parts[1]?.participacao_percentual ?? 0),
      qtd_parcelas: String((ps ?? []).length || 1),
      primeira_parcela: (ps ?? [])[0]?.data_prevista ?? v.data_venda ?? new Date().toISOString().split("T")[0],
    });
    setTemOutroCorretor(!!parts[1]?.corretor_id);
    setStep(0);
    setOpen(true);
  }

  const totais = useMemo(() => {
    const ativas = (vendas as any[]).filter((v) => v.status !== "distrato");
    const bruto = ativas.reduce((s, v) => s + (Number(v.valor) || 0), 0);
    const com = ativas.reduce((s, v) => s + (Number(v.comissoes?.valor_total ?? v.comissoes?.[0]?.valor_total) || 0), 0);
    return { qtd: ativas.length, bruto, com };
  }, [vendas]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Contratos ativos</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totais.qtd}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vendas brutas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totais.bruto)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Comissão bruta</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totais.com)}</p></CardContent>
        </Card>
      </div>

      {isGestor && (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm()); setParcelasEdit([]); setStep(0); setTemOutroCorretor(false); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo contrato</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader className="flex-row items-start justify-between gap-4">
              <div className="space-y-1.5">
                <DialogTitle>{editId ? "Editar contrato" : "Novo contrato"}</DialogTitle>
                <DialogDescription>{STEPS[step].desc}</DialogDescription>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="quitada">Quitada</SelectItem>
                    <SelectItem value="distrato">Distrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogHeader>

            {/* Stepper */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s.title} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                      i === step && "border-primary bg-primary text-primary-foreground",
                      i < step && "border-primary bg-primary/10 text-primary",
                      i > step && "text-muted-foreground"
                    )}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                  <span className={cn("hidden text-xs sm:block", i === step ? "font-medium" : "text-muted-foreground")}>
                    {s.title}
                  </span>
                  {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
                </div>
              ))}
            </div>

            {/* Etapa 1 — Contrato */}
            {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nº do contrato *</Label>
                <Input value={form.numero_contrato} onChange={(e) => set("numero_contrato", e.target.value)} placeholder="CT-2026-001" />
              </div>
              <div className="space-y-2">
                <Label>Data da venda (competência) *</Label>
                <DatePickerField value={form.data_venda} onChange={(v) => set("data_venda", v)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de imóvel</Label>
                <Select value={form.empreendimento_id} onValueChange={(v) => set("empreendimento_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não definido</SelectItem>
                    {(empreendimentos as any[]).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome} · {EMPREENDIMENTO_TIPO_LABELS[e.tipo] ?? e.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
              </div>
            </div>
            )}

            {/* Etapa 2 — Informações */}
            {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente comprador *</Label>
                <Input value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} placeholder="Quem está comprando" />
              </div>
              <div className="space-y-2">
                <Label>{isPronto ? "Cliente vendedor (proprietário) *" : "Construtora (cliente vendedor) *"}</Label>
                <Input
                  value={form.vendedor_nome}
                  onChange={(e) => set("vendedor_nome", e.target.value)}
                  placeholder={isPronto ? "Dono do imóvel" : "Nome da construtora"}
                />
                <p className="text-xs text-muted-foreground">
                  {isPronto
                    ? "Imóvel pronto: informe o proprietário que está vendendo."
                    : "Empreendimento: o vendedor é a construtora."}
                </p>
              </div>
              {isPronto && (
                <>
                  <div className="space-y-2">
                    <Label>Agenciador *</Label>
                    <Select value={form.agenciador_tipo} onValueChange={(v) => { set("agenciador_tipo", v); if (v !== "corretor") set("captador_corretor_id", NONE); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proprio">O próprio corretor da venda (sem desconto)</SelectItem>
                        <SelectItem value="voluire">Voluire (5%)</SelectItem>
                        <SelectItem value="corretor">Outro corretor / colega (10%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O agenciador retira pontos do percentual do corretor.
                    </p>
                  </div>
                  {form.agenciador_tipo === "corretor" && (
                    <div className="space-y-2">
                      <Label>Colega que agenciou *</Label>
                      <Select value={form.captador_corretor_id} onValueChange={(v) => set("captador_corretor_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value={NONE}>Selecione</SelectItem>
                          {corretores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
            )}

            {/* Etapa 3 — Valores */}
            {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor da venda (R$) *</Label>
                <Input
                  inputMode="numeric"
                  placeholder="0,00"
                  value={numberToCurrencyInput(form.valor)}
                  onChange={(e) => {
                    const masked = formatCurrencyInput(e.target.value);
                    set("valor", masked ? String(parseCurrencyInput(masked)) : "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Venda em parceria? *</Label>
                <Select
                  value={form.tem_parceria}
                  onValueChange={(v) => {
                    set("tem_parceria", v);
                    if (v !== "sim") {
                      set("parceria_nome", "");
                      set("comissao_percentual_bruta", "6");
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não — comissão de 6%</SelectItem>
                    <SelectItem value="sim">Sim — comissão diferente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.tem_parceria === "sim" && (
                <div className="space-y-2">
                  <Label>Nome do parceiro *</Label>
                  <Input
                    value={form.parceria_nome}
                    onChange={(e) => set("parceria_nome", e.target.value)}
                    placeholder="Quem entrou na parceria"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Comissão bruta (%) *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-28"
                    disabled={form.tem_parceria !== "sim"}
                    value={form.comissao_percentual_bruta}
                    onChange={(e) => set("comissao_percentual_bruta", e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">= {formatCurrency(comissaoBruta)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.tem_parceria === "sim"
                    ? "Parceria: informe o percentual acordado no contrato."
                    : "Sem parceria: comissão fixa de 6%."}
                </p>
              </div>
              <div className="rounded-md border p-3 text-sm sm:col-span-2">
                <p className="font-medium">Como a comissão será distribuída</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPronto
                    ? descontoAgenciador > 0
                      ? `Imóvel pronto: o agenciador fica com ${descontoAgenciador}% (${formatCurrency(comissaoBruta * descontoAgenciador / 100)}), retirados do percentual do corretor — ${splitCorretor1}% passa a ${Math.max(splitCorretor1 - descontoAgenciador, 0)}%.`
                      : "Imóvel pronto agenciado pelo próprio corretor: a comissão da ficha não muda."
                    : "Corretor conforme a comissão da ficha e o restante fica com a Voluire."}
                </p>
              </div>
            </div>
            )}

            {/* Etapa 4 — Pagamento */}
            {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(v) => {
                    set("forma_pagamento", v);
                    if (v === "a_vista") setParcelasEdit([]);
                    else if (parcelasEdit.length === 0)
                      setParcelasEdit(gerarParcelas(Number(form.qtd_parcelas) || 1, form.primeira_parcela, Number(form.valor)));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.forma_pagamento !== "a_vista" && (
                <>
                  <div className="space-y-2">
                    <Label>Qtd. de parcelas</Label>
                    <Input type="number" min="1" value={form.qtd_parcelas} onChange={(e) => set("qtd_parcelas", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>1ª parcela prevista</Label>
                    <DatePickerField value={form.primeira_parcela} onChange={(v) => set("primeira_parcela", v)} />
                  </div>
                  <div className="space-y-3 sm:col-span-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label>Cronograma de parcelas</Label>
                        <p className="text-xs text-muted-foreground">
                          Pré-definido, mas totalmente editável: altere valor e data de cada parcela.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={regenerar}>
                        Gerar {form.qtd_parcelas}x automático
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {parcelasEdit.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-8 text-sm text-muted-foreground">{i + 1}º</span>
                          <Input
                            inputMode="numeric"
                            value={p.valor ? numberToCurrencyInput(p.valor) : ""}
                            onChange={(e) => {
                              const masked = formatCurrencyInput(e.target.value);
                              setParcela(i, "valor", masked ? String(parseCurrencyInput(masked)) : "");
                            }}
                            placeholder="0,00"
                          />
                          <DatePickerField
                            value={p.data_prevista}
                            onChange={(v) => setParcela(i, "data_prevista", v)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setParcelasEdit((arr) => arr.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {parcelasEdit.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhuma parcela — gere ou adicione manualmente.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setParcelasEdit((arr) => {
                            const last = arr[arr.length - 1];
                            const d = last ? new Date(last.data_prevista + "T12:00:00") : new Date();
                            if (last) d.setMonth(d.getMonth() + 1);
                            return [...arr, { valor: "0", data_prevista: d.toISOString().split("T")[0] }];
                          })
                        }
                      >
                        <Plus className="mr-1 h-4 w-4" />Adicionar parcela
                      </Button>
                      <span className={`text-sm ${Math.abs(totalParcelas - (Number(form.valor) || 0)) < 0.05 ? "text-muted-foreground" : "text-destructive"}`}>
                        Soma: {formatCurrency(totalParcelas)} de {formatCurrency(Number(form.valor) || 0)}
                      </span>
                    </div>
                  </div>
                </>
              )}
              {form.forma_pagamento === "a_vista" && (
                <div className="space-y-2">
                  <Label>Recebimento previsto</Label>
                  <DatePickerField value={form.primeira_parcela} onChange={(v) => set("primeira_parcela", v)} />
                </div>
              )}

              <div className="rounded-md border bg-muted/40 p-3 text-sm sm:col-span-2">
                <p className="mb-2 font-medium">Resumo do contrato</p>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Contrato: {form.numero_contrato || "—"}</span>
                  <span>Data: {form.data_venda ? formatDate(form.data_venda) : "—"}</span>
                  <span>Comprador: {form.cliente_nome || "—"}</span>
                  <span>Vendedor: {vendedorFinal || "—"}</span>
                  <span>Unidade: {form.unidade || "—"}</span>
                  <span>Valor: {formatCurrency(Number(form.valor) || 0)}</span>
                  <span>Comissão bruta: {formatCurrency(comissaoBruta)}</span>
                  <span>Pagamento: {FORMA_PAGAMENTO_LABELS[form.forma_pagamento] ?? form.forma_pagamento}</span>
                  <span>
                    Parcelas: {form.forma_pagamento === "a_vista" ? "1 (à vista)" : `${parcelasEdit.length}x`}
                  </span>
                </div>
              </div>
            </div>
            )}

            {/* Etapa 2 (continuação) — Corretores */}
            {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Corretor responsável *</Label>
                <div className="flex gap-2">
                  <Select value={form.corretor1_id} onValueChange={(v) => set("corretor1_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {corretores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isPronto ? (
                    form.corretor2_id !== NONE && (
                      <Input className="w-28" type="number" min="0" max="100" step="0.1" value={form.corretor1_part} onChange={(e) => set("corretor1_part", e.target.value)} placeholder="% part." />
                    )
                  ) : (
                    <div className="flex w-28 items-center justify-center rounded-md border bg-muted px-2 text-sm">
                      {form.corretor2_id !== NONE
                        ? ((Number(corretores.find((c) => c.id === form.corretor1_id)?.comissao_percentual) || 50) / 2).toFixed(1).replace(".0", "")
                        : (Number(corretores.find((c) => c.id === form.corretor1_id)?.comissao_percentual) || 50).toFixed(1).replace(".0", "")}%
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Houve outro corretor na venda?</Label>
                <Select
                  value={form.corretor2_id !== NONE || temOutroCorretor ? "sim" : "nao"}
                  onValueChange={(v) => {
                    setTemOutroCorretor(v === "sim");
                    if (v === "nao") { set("corretor2_id", NONE); if (isPronto) { set("corretor1_part", "100"); set("corretor2_part", "0"); } }
                    else if (isPronto && Number(form.corretor2_part) === 0) { set("corretor1_part", "50"); set("corretor2_part", "50"); }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(form.corretor2_id !== NONE || temOutroCorretor) && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Qual outro corretor? *</Label>
                  <div className="flex gap-2">
                    <Select value={form.corretor2_id} onValueChange={(v) => { set("corretor2_id", v); if (isPronto && v !== NONE && Number(form.corretor2_part) === 0) { set("corretor1_part", "50"); set("corretor2_part", "50"); } }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {corretores.filter((c) => c.id !== form.corretor1_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.corretor2_id !== NONE && (
                      isPronto ? (
                        <Input className="w-28" type="number" min="0" max="100" step="0.1" value={form.corretor2_part} onChange={(e) => set("corretor2_part", e.target.value)} placeholder="% part." />
                      ) : (
                        <div className="flex w-28 items-center justify-center rounded-md border bg-muted px-2 text-sm">
                          {((Number(corretores.find((c) => c.id === form.corretor2_id)?.comissao_percentual) || 50) / 2).toFixed(1).replace(".0", "")}%
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
              {isPronto ? (
                <div className="rounded-md border p-3 text-sm sm:col-span-2">
                  <p className="font-medium">Agenciamento</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.agenciador_tipo === "voluire"
                      ? "Voluire agenciou — 5% saem do percentual do corretor."
                      : form.agenciador_tipo === "corretor"
                        ? `Agenciado por ${corretores.find((c) => c.id === form.captador_corretor_id)?.nome ?? "—"} — 10% saem do percentual do corretor.`
                        : "Agenciado pelo próprio corretor — sem desconto."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Captador</Label>
                  <Select value={form.captador_corretor_id} onValueChange={(v) => set("captador_corretor_id", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value={NONE}>Sem captador</SelectItem>
                      {corretores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>Observação</Label>
                <Textarea value={form.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} />
              </div>
            </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />Voltar
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={avancar}>
                  Continuar<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  {salvar.isPending ? "Salvando..." : editId ? "Salvar alterações" : "Registrar contrato"}
                </Button>
              )}
            </DialogFooter>

          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Comprador / Vendedor</TableHead>
                <TableHead>Tipo de imóvel</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Corretores</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendas as any[]).map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.numero_contrato}</TableCell>
                  <TableCell>
                    <div className="font-medium">{v.cliente_nome}</div>
                    <div className="text-xs text-muted-foreground">
                      Vendedor: {v.vendedor_nome ?? "—"} · Un. {v.unidade}
                    </div>
                  </TableCell>
                  <TableCell>{v.empreendimentos?.nome ?? "—"}</TableCell>
                  <TableCell>{v.tem_parceria ? v.parceria_nome ?? "—" : "—"}</TableCell>
                  <TableCell className="text-sm">
                    {(v.venda_corretores ?? []).map((p: any) => (
                      <div key={p.id} className="whitespace-nowrap">
                        {p.corretores?.nome}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {formatPercent(Number(p.percentual_corretor))}
                          {Number(p.participacao_percentual) !== 100 ? ` · ${formatPercent(Number(p.participacao_percentual))}` : ""}
                        </span>
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(Number(v.valor))}</TableCell>
                  <TableCell>{FORMA_PAGAMENTO_LABELS[v.forma_pagamento] ?? v.forma_pagamento}</TableCell>
                  <TableCell>{formatDate(v.data_venda)}</TableCell>
                  <TableCell><Badge className={statusColors[v.status]}>{v.status}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => setParcelasVenda(v)} title="Parcelas">
                      <Receipt className="h-4 w-4" />
                    </Button>
                    {isGestor && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => abrirEdicao(v)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir este contrato?")) excluir.mutate(v.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Nenhum contrato registrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!parcelasVenda} onOpenChange={(o) => !o && setParcelasVenda(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fluxo de caixa — contrato {parcelasVenda?.numero_contrato}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Prevista</TableHead>
                <TableHead>Recebida</TableHead>
                <TableHead>Adiada</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(parcelas as any[]).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.numero}</TableCell>
                  <TableCell>{formatCurrency(Number(p.valor))}</TableCell>
                  <TableCell>{formatDate(p.data_prevista)}</TableCell>
                  <TableCell>{p.data_recebimento ? formatDate(p.data_recebimento) : "—"}</TableCell>
                  <TableCell>{p.dias_adiados ? `${p.dias_adiados} dias` : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {isGestor && p.status !== "recebida" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            atualizarParcela.mutate({
                              id: p.id,
                              patch: { status: "recebida", data_recebimento: new Date().toISOString().split("T")[0] },
                            })
                          }
                        >
                          Receber
                        </Button>
                        {parcelasVenda?.forma_pagamento === "financiamento" && (
                          <AdiarPopover
                            onConfirm={(dias) => {
                              const d = new Date(p.data_prevista + "T12:00:00");
                              d.setDate(d.getDate() + dias);
                              atualizarParcela.mutate({
                                id: p.id,
                                patch: {
                                  data_prevista: d.toISOString().split("T")[0],
                                  dias_adiados: (p.dias_adiados || 0) + dias,
                                  status: "adiada",
                                },
                              });
                            }}
                          />
                        )}
                      </>
                    )}
                    {p.status === "recebida" && <Badge className="bg-emerald-100 text-emerald-800">Recebida</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {parcelas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Sem parcelas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
