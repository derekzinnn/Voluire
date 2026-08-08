import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2, Pencil, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  ativa: "bg-emerald-100 text-emerald-800",
  distrato: "bg-red-100 text-red-800",
  quitada: "bg-blue-100 text-blue-800",
};

const PAGE_SIZE = 15;

function EmpreendimentoCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Selecione ou digite novo"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar ou criar..." value={search} onValueChange={setSearch} />
          <CommandList className="max-h-48">
            <CommandEmpty>
              {search.trim() ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                  onClick={() => {
                    onChange(search.trim());
                    setOpen(false);
                  }}
                >
                  Criar "{search.trim()}"
                </button>
              ) : (
                "Nenhum empreendimento"
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.nome}
                  onSelect={() => {
                    onChange(e.nome);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === e.nome ? "opacity-100" : "opacity-0")} />
                  {e.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const STATUS_OPTIONS = ["ativa", "distrato", "quitada"];

function StatusPopover({ status, onSelect }: { status: string; onSelect: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button">
          <Badge className={cn("cursor-pointer hover:opacity-80", statusColors[status] || "")}>{status}</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        {STATUS_OPTIONS.filter((s) => s !== status).map((s) => (
          <button
            key={s}
            type="button"
            className="w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent"
            onClick={() => {
              onSelect(s);
              setOpen(false);
            }}
          >
            {s}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function Vendas() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editEmpreendimento, setEditEmpreendimento] = useState("");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroCorretor, setFiltroCorretor] = useState<string>("todos");
  const [filtroEmpreendimento, setFiltroEmpreendimento] = useState<string>("todos");
  const [empreendimentoInput, setEmpreendimentoInput] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("*, corretores(nome), empreendimentos(nome), comissoes(status)").order("data_venda", { ascending: false });
      return data || [];
    },
  });

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("*").eq("ativo", true);
      return data || [];
    },
  });

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["empreendimentos"],
    queryFn: async () => {
      const { data } = await supabase.from("empreendimentos").select("*");
      return data || [];
    },
  });

  const resolveEmpreendimento = async (nome: string) => {
    const empNome = nome.trim();
    if (!empNome) return null;
    const existing = empreendimentos.find(e => e.nome.toLowerCase() === empNome.toLowerCase());
    if (existing) return existing.id;
    const { data: newEmp, error } = await supabase.from("empreendimentos").insert({ nome: empNome }).select().single();
    if (error) throw error;
    return newEmp.id;
  };

  const createVenda = useMutation({
    mutationFn: async (formData: FormData) => {
      const empreendimentoId = await resolveEmpreendimento(empreendimentoInput);

      const venda = {
        empreendimento_id: empreendimentoId,
        unidade: formData.get("unidade") as string,
        cliente_nome: formData.get("cliente_nome") as string,
        corretor_id: formData.get("corretor_id") as string || null,
        valor: Number(formData.get("valor")),
        data_venda: formData.get("data_venda") as string,
        roi_trafego: formData.get("roi_trafego") as string || null,
        status: "ativa",
      };
      const { data, error } = await supabase.from("vendas").insert(venda).select().single();
      if (error) throw error;

      // Auto-create comissao
      const corretor = corretores.find(c => c.id === venda.corretor_id);
      const percentualCorretor = corretor?.comissao_percentual || 50;
      const valorTotal = venda.valor * 0.06;
      const valorEmpresa = valorTotal * (1 - percentualCorretor / 100);
      const valorCorretor = valorTotal * (percentualCorretor / 100);

      await supabase.from("comissoes").insert({
        venda_id: data.id,
        corretor_id: venda.corretor_id,
        percentual_total: 6,
        valor_total: valorTotal,
        valor_empresa: valorEmpresa,
        valor_corretor: valorCorretor,
        status: "a_receber",
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      queryClient.invalidateQueries({ queryKey: ["empreendimentos"] });
      setEmpreendimentoInput("");
      setOpen(false);
      toast({ title: "Venda cadastrada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateVenda = useMutation({
    mutationFn: async (formData: FormData) => {
      const empreendimentoId = await resolveEmpreendimento(editEmpreendimento);
      const payload = {
        empreendimento_id: empreendimentoId,
        unidade: formData.get("unidade") as string,
        cliente_nome: formData.get("cliente_nome") as string,
        corretor_id: (formData.get("corretor_id") as string) || null,
        valor: Number(formData.get("valor")),
        data_venda: formData.get("data_venda") as string,
        roi_trafego: (formData.get("roi_trafego") as string) || null,
        status: formData.get("status") as string,
      };
      const { error } = await supabase.from("vendas").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["empreendimentos"] });
      setEditing(null);
      toast({ title: "Venda atualizada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("vendas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteVenda = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["corretores"] });
      toast({ title: "Venda removida" });
    },
  });

  const filtered = vendas.filter(v => {
    if (filtroMes !== "todos") {
      const m = new Date(v.data_venda).getMonth() + 1;
      if (m.toString() !== filtroMes) return false;
    }
    if (filtroCorretor !== "todos" && v.corretor_id !== filtroCorretor) return false;
    if (filtroEmpreendimento !== "todos" && v.empreendimento_id !== filtroEmpreendimento) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [filtroMes, filtroCorretor, filtroEmpreendimento]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const vgvFiltrado = filtered.filter(v => v.status === "ativa").reduce((s, v) => s + Number(v.valor), 0);

  const currentYear = new Date().getFullYear();

  const isQuitada = (v: any) => {
    const comissoes = (v as any).comissoes;
    if (!comissoes || !Array.isArray(comissoes)) return false;
    return comissoes.some((c: any) => c.status === "recebido");
  };

  const vendasAno = vendas.filter(v => {
    const d = new Date(v.data_venda + "T12:00:00");
    return d.getFullYear() === currentYear && v.status !== "distrato";
  });

  const vendasByQ = [0, 1, 2, 3].map(q =>
    vendasAno.filter(v => {
      const m = new Date(v.data_venda + "T12:00:00").getMonth();
      return m >= q * 3 && m < (q + 1) * 3;
    })
  );

  const currentQuarter = Math.floor(new Date().getMonth() / 3); // 0-based

  const calcStats = (list: any[]) => ({
    qtd: list.length,
    vgv: list.reduce((s, v) => s + Number(v.valor), 0),
    quitado: list.filter(v => isQuitada(v)).reduce((s, v) => s + Number(v.valor), 0),
  });

  const statsAno = calcStats(vendasAno);
  const statsQ = vendasByQ.map(calcStats);
  const triLabels = ["1º Tri", "2º Tri", "3º Tri", "4º Tri"];

  const openEdit = (venda: any) => {
    setEditing(venda);
    setEditEmpreendimento((venda.empreendimentos as any)?.nome || "");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {new Date(2026, i).toLocaleString("pt-BR", { month: "long" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroCorretor} onValueChange={setFiltroCorretor}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Corretor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos corretores</SelectItem>
              {corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroEmpreendimento} onValueChange={setFiltroEmpreendimento}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empreendimento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos empreend.</SelectItem>
              {empreendimentos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards do Ano - destaque */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm text-muted-foreground">{currentYear} — Vendas</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3"><p className="text-2xl font-bold">{statsAno.qtd}</p></CardContent>
        </Card>
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm text-muted-foreground">{currentYear} — VGV</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3"><p className="text-2xl font-bold">{formatCurrency(statsAno.vgv)}</p></CardContent>
        </Card>
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm text-muted-foreground">{currentYear} — Quitado</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3"><p className="text-2xl font-bold text-emerald-600">{formatCurrency(statsAno.quitado)}</p></CardContent>
        </Card>
      </div>

      {/* Cards por Trimestre */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statsQ.map((s, i) => (
          <Card key={i} className={i === currentQuarter ? "ring-2 ring-primary/40" : ""}>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground">{triLabels[i]}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              <p className="text-sm"><span className="font-semibold">{s.qtd}</span> <span className="text-muted-foreground">{s.qtd === 1 ? "venda" : "vendas"}</span></p>
              <p className="text-sm">VGV: <span className="font-semibold">{formatCurrency(s.vgv)}</span></p>
              <p className="text-sm">Quitado: <span className="font-semibold text-emerald-600">{formatCurrency(s.quitado)}</span></p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">VGV filtrado: <span className="font-bold text-foreground">{formatCurrency(vgvFiltrado)}</span></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Venda</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Venda</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createVenda.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empreendimento</Label>
                  <EmpreendimentoCombobox
                    value={empreendimentoInput}
                    onChange={setEmpreendimentoInput}
                    options={empreendimentos}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input name="unidade" required />
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input name="cliente_nome" required />
                </div>
                <div className="space-y-2">
                  <Label>Corretor</Label>
                  <Select name="corretor_id">
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input name="valor" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label>Data da Venda</Label>
                  <Input name="data_venda" type="date" required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>ROI Tráfego</Label>
                  <Input name="roi_trafego" placeholder="Ex: Facebook, Google..." />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createVenda.isPending}>
                {createVenda.isPending ? "Salvando..." : "Cadastrar Venda"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog de edição */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Venda</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={e => { e.preventDefault(); updateVenda.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Empreendimento</Label>
                  <EmpreendimentoCombobox
                    value={editEmpreendimento}
                    onChange={setEditEmpreendimento}
                    options={empreendimentos}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input name="unidade" defaultValue={editing.unidade || ""} required />
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input name="cliente_nome" defaultValue={editing.cliente_nome || ""} required />
                </div>
                <div className="space-y-2">
                  <Label>Corretor</Label>
                  <Select name="corretor_id" defaultValue={editing.corretor_id || undefined}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {corretores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input name="valor" type="number" step="0.01" defaultValue={editing.valor} required />
                </div>
                <div className="space-y-2">
                  <Label>Data da Venda</Label>
                  <Input name="data_venda" type="date" defaultValue={editing.data_venda} required />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select name="status" defaultValue={editing.status}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">ativa</SelectItem>
                      <SelectItem value="distrato">distrato</SelectItem>
                      <SelectItem value="quitada">quitada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ROI Tráfego</Label>
                  <Input name="roi_trafego" defaultValue={editing.roi_trafego || ""} placeholder="Ex: Facebook, Google..." />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={updateVenda.isPending}>
                {updateVenda.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Empreendimento</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Corretor</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(venda => (
                <TableRow key={venda.id}>
                  <TableCell>{formatDate(venda.data_venda)}</TableCell>
                  <TableCell>{(venda.empreendimentos as any)?.nome || "—"}</TableCell>
                  <TableCell>{venda.unidade}</TableCell>
                  <TableCell>{venda.cliente_nome}</TableCell>
                  <TableCell>{(venda.corretores as any)?.nome || "—"}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(Number(venda.valor))}</TableCell>
                  <TableCell>
                    <StatusPopover
                      status={venda.status}
                      onSelect={(s) => updateStatus.mutate({ id: venda.id, status: s })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(venda)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteVenda.mutate(venda.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma venda encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Anterior
            </Button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
