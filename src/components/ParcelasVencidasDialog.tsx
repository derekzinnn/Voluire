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
import { CalendarIcon, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";

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

export default function ParcelasVencidasDialog() {
  const { isGestor, loading } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [skips, setSkips] = useState<string[]>(() => lerSkips());
  const [modoNaoPaga, setModoNaoPaga] = useState(false);
  const [novaData, setNovaData] = useState<string>("");
  const [dias, setDias] = useState("30");

  const { data: pendentes = [] } = useQuery({
    queryKey: ["parcelas-vencidas"],
    enabled: !loading && isGestor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_parcelas")
        .select("id, numero, valor, data_prevista, dias_adiados, tipo, venda_id, vendas(numero_contrato, cliente_nome, forma_pagamento)")
        .neq("status", "recebida")
        .lte("data_prevista", hoje())
        .order("data_prevista");
      if (error) throw error;
      return data ?? [];
    },
  });

  const fila = useMemo(
    () => (pendentes as any[]).filter((p) => !skips.includes(p.id)),
    [pendentes, skips]
  );
  const atual = fila[0];

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("venda_parcelas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcelas-vencidas"] });
      queryClient.invalidateQueries({ queryKey: ["venda-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      setModoNaoPaga(false);
      setNovaData("");
      setDias("30");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (loading || !isGestor || !atual) return null;

  const venda = atual.vendas ?? {};
  const dataDate = novaData ? new Date(novaData + "T12:00:00") : undefined;

  function confirmarPaga() {
    atualizar.mutate({
      id: atual.id,
      patch: { status: "recebida", data_recebimento: hoje() },
    });
    toast({ title: "Parcela marcada como paga" });
  }

  function reagendarPorDias() {
    const n = Number(dias);
    if (!n || n < 1) return;
    const d = new Date(atual.data_prevista + "T12:00:00");
    d.setDate(d.getDate() + n);
    atualizar.mutate({
      id: atual.id,
      patch: {
        data_prevista: d.toISOString().split("T")[0],
        dias_adiados: (atual.dias_adiados || 0) + n,
        status: "adiada",
      },
    });
  }

  function reagendarPorData() {
    if (!novaData) return;
    atualizar.mutate({
      id: atual.id,
      patch: { data_prevista: novaData, status: "adiada" },
    });
  }

  function pularAgora() {
    addSkip(atual.id);
    setSkips(lerSkips());
    setModoNaoPaga(false);
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Parcela paga ou não?
          </DialogTitle>
          <DialogDescription>
            {fila.length > 1
              ? `${fila.length} parcelas com vencimento até hoje aguardam confirmação.`
              : "Confirme o recebimento desta parcela para atualizar o fluxo de caixa."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Contrato</span>
            <span className="font-medium">{venda.numero_contrato ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium">{venda.cliente_nome ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Parcela</span>
            <span className="font-medium">
              #{atual.numero} — {formatCurrency(Number(atual.valor))}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Vencimento</span>
            <span className="font-medium">
              {formatDate(atual.data_prevista)}{" "}
              {atual.data_prevista < hoje() && <Badge variant="destructive" className="ml-1">Em atraso</Badge>}
            </span>
          </div>
        </div>

        {!modoNaoPaga ? (
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={pularAgora}>Decidir depois</Button>
            <Button variant="outline" onClick={() => setModoNaoPaga(true)}>Não foi paga</Button>
            <Button onClick={confirmarPaga} disabled={atualizar.isPending}>Sim, foi paga</Button>
          </DialogFooter>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure a parcela: adie por um número de dias ou defina uma nova data de vencimento.
            </p>
            <div className="space-y-2">
              <Label>Adiar por quantos dias?</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} />
                <Button variant="outline" onClick={reagendarPorDias} disabled={atualizar.isPending}>Adiar</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ou nova data de vencimento</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start font-normal">
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
                <Button variant="outline" onClick={reagendarPorData} disabled={!novaData || atualizar.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={() => setModoNaoPaga(false)}>Voltar</Button>
              <Button
                variant="outline"
                onClick={() => {
                  pularAgora();
                  navigate("/vendas");
                }}
              >
                Editar parcelas do contrato
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
