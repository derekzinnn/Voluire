import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { CalendarIcon, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;
const hoje = () => new Date().toISOString().split("T")[0];
const SKIP_KEY = () => `parcelas-adiadas-hoje:${hoje()}`;

function lerSkips(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SKIP_KEY()) ?? "[]");
  } catch {
    return [];
  }
}

function addSkip(id: string) {
  const atual = lerSkips();
  sessionStorage.setItem(SKIP_KEY(), JSON.stringify([...atual, id]));
}

export function useParcelasVencidas() {
  const { can, loading } = useUserRole();
  const isGestor = can("financeiro.ver");
  return useQuery({
    queryKey: ["parcelas-vencidas"],
    enabled: !loading && isGestor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_parcelas_em_atraso")
        .select("*")
        .order("data_prevista");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        vendas: { numero_contrato: p.numero_contrato, cliente_nome: p.cliente_nome, forma_pagamento: p.forma_pagamento },
      }));
    },
  });
}

export function useParcelasVencidasCount() {
  const { data = [] } = useParcelasVencidas();
  const skips = lerSkips();
  return (data as any[]).filter((p) => !skips.includes(p.id)).length;
}

type Props = { open?: boolean; onOpenChange?: (v: boolean) => void };

export default function ParcelasVencidasDialog({ open, onOpenChange }: Props = {}) {
  const { can, loading } = useUserRole();
  const isGestor = can("financeiro.ver");
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [skips, setSkips] = useState<string[]>(() => lerSkips());
  const [aberta, setAberta] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [novaData, setNovaData] = useState<string>("");
  const [dias, setDias] = useState("30");
  const [fechado, setFechado] = useState(false);
  const controlado = open !== undefined;


  const { data: pendentes = [] } = useQuery({
    queryKey: ["parcelas-vencidas"],
    enabled: !loading && isGestor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_parcelas_em_atraso")
        .select("*")
        .order("data_prevista");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        vendas: { numero_contrato: p.numero_contrato, cliente_nome: p.cliente_nome, forma_pagamento: p.forma_pagamento },
      }));
    },
  });

  const fila = useMemo(
    () => (controlado ? (pendentes as any[]) : (pendentes as any[]).filter((p) => !skips.includes(p.id))),
    [pendentes, skips, controlado]
  );


  const totalPaginas = Math.max(1, Math.ceil(fila.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = fila.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE);
  const totalAberto = fila.reduce((s, p: any) => s + Number(p.valor || 0), 0);

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("venda_parcelas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcelas-vencidas"] });
      queryClient.invalidateQueries({ queryKey: ["venda-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      setAberta(null);
      setNovaData("");
      setDias("30");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (loading || !isGestor) return null;
  if (controlado ? !open : fila.length === 0 || fechado) return null;


  function confirmarPaga(p: any) {
    atualizar.mutate({ id: p.id, patch: { status: "recebida", data_recebimento: hoje() } });
    toast({ title: "Parcela marcada como paga" });
  }

  function reagendarPorDias(p: any) {
    const n = Number(dias);
    if (!n || n < 1) return;
    const d = new Date(p.data_prevista + "T12:00:00");
    d.setDate(d.getDate() + n);
    atualizar.mutate({
      id: p.id,
      patch: {
        data_prevista: d.toISOString().split("T")[0],
        dias_adiados: (p.dias_adiados || 0) + n,
        status: "adiada",
      },
    });
  }

  function reagendarPorData(p: any) {
    if (!novaData) return;
    atualizar.mutate({ id: p.id, patch: { data_prevista: novaData, status: "adiada" } });
  }

  function pular(p: any) {
    addSkip(p.id);
    setSkips(lerSkips());
    setAberta(null);
  }

  const dataDate = novaData ? new Date(novaData + "T12:00:00") : undefined;

  return (
    <Dialog open onOpenChange={(v) => (controlado ? onOpenChange?.(v) : setFechado(true))}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Parcelas em atraso
          </DialogTitle>
          <DialogDescription>
            {fila.length === 0
              ? "Nenhuma parcela em atraso no momento."
              : `${fila.length} parcela${fila.length > 1 ? "s" : ""} com vencimento até hoje — ${formatCurrency(totalAberto)} em aberto. Clique em uma parcela para confirmar.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">

          {visiveis.map((p: any) => {
            const venda = p.vendas ?? {};
            const expandida = aberta === p.id;
            return (
              <div key={p.id} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => {
                    setAberta(expandida ? null : p.id);
                    setNovaData("");
                    setDias("30");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                    expandida && "bg-muted/40"
                  )}
                >
                  {expandida ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {venda.numero_contrato ?? "—"} · {venda.cliente_nome ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Parcela #{p.numero} · vence {formatDate(p.data_prevista)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-medium">{formatCurrency(Number(p.valor))}</span>
                    {p.data_prevista < hoje() && <Badge variant="destructive">Em atraso</Badge>}
                  </div>
                </button>

                {expandida && (
                  <div className="space-y-4 border-t p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => confirmarPaga(p)} disabled={atualizar.isPending}>
                        Sim, foi paga
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => pular(p)}>
                        Decidir depois
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          pular(p);
                          navigate("/vendas");
                        }}
                      >
                        Editar parcelas do contrato
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Não foi paga — adiar por quantos dias?</Label>
                      <div className="flex gap-2">
                        <Input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} className="h-9" />
                        <Button size="sm" variant="outline" onClick={() => reagendarPorDias(p)} disabled={atualizar.isPending}>
                          Adiar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Ou nova data de vencimento</Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 justify-start font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dataDate ? format(dataDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                            <Calendar
                              mode="single"
                              selected={dataDate}
                              onSelect={(d) => setNovaData(d ? format(d, "yyyy-MM-dd") : "")}
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" variant="outline" onClick={() => reagendarPorData(p)} disabled={!novaData || atualizar.isPending}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {totalPaginas > 1 && (
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Página {paginaAtual + 1} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={paginaAtual === 0} onClick={() => { setPagina(paginaAtual - 1); setAberta(null); }}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={paginaAtual >= totalPaginas - 1} onClick={() => { setPagina(paginaAtual + 1); setAberta(null); }}>
                Próxima
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
