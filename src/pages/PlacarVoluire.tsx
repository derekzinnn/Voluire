import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, parseLocalDate } from "@/lib/format";
import { Trophy, Plus, Star, Check, X, Gift, Award, Upload, Loader2 } from "lucide-react";

const TRIMESTRES = [1, 2, 3, 4];
const TRIMESTRE_LABELS: Record<number, string> = { 1: "1º Trimestre", 2: "2º Trimestre", 3: "3º Trimestre", 4: "4º Trimestre" };

function getCurrentTrimestre() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function isWeekDeadlinePassed(weekStart: string): boolean {
  // Deadline: Friday 15:00 of that week
  const start = new Date(weekStart + "T12:00:00");
  const friday = new Date(start);
  friday.setDate(start.getDate() + 4); // Monday + 4 = Friday
  friday.setHours(15, 0, 0, 0);
  return new Date() > friday;
}

function getRecentWeeks(count: number): string[] {
  const weeks: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getWeekStartDate(d));
  }
  return weeks;
}

export default function PlacarVoluire() {
  const [openTarefa, setOpenTarefa] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [uploadCorretorId, setUploadCorretorId] = useState("");
  const [uploadSemana, setUploadSemana] = useState(getWeekStartDate(new Date()));
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedTrimestre, setSelectedTrimestre] = useState(getCurrentTrimestre());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const { data: tarefas = [] } = useQuery({
    queryKey: ["placar-tarefas"],
    queryFn: async () => {
      const { data } = await supabase.from("placar_tarefas").select("*").eq("ativa", true).order("pontos", { ascending: false });
      return data || [];
    },
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["placar-entregas", currentYear, selectedTrimestre],
    queryFn: async () => {
      const { data } = await supabase.from("placar_entregas").select("*, corretores(nome), placar_tarefas(nome, pontos)")
        .eq("ano", currentYear).eq("trimestre", selectedTrimestre);
      return data || [];
    },
  });

  const { data: corretores = [] } = useQuery({
    queryKey: ["corretores"],
    queryFn: async () => {
      const { data } = await supabase.from("corretores").select("*").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data } = await supabase.from("vendas").select("valor, data_venda, corretor_id, status").neq("status", "distrato");
      return data || [];
    },
  });

  const { data: captacoes = [] } = useQuery({
    queryKey: ["captacoes"],
    queryFn: async () => {
      const { data } = await supabase.from("captacoes").select("id, data_captacao, corretor_id");
      return data || [];
    },
  });

  const createTarefa = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("placar_tarefas").insert({
        nome: formData.get("nome") as string,
        pontos: Number(formData.get("pontos")),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placar-tarefas"] });
      setOpenTarefa(false);
      toast({ title: "Tarefa criada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const registrarEntrega = useMutation({
    mutationFn: async ({ corretorId, tarefaId }: { corretorId: string; tarefaId: string }) => {
      const today = new Date();
      const { error } = await supabase.from("placar_entregas").insert({
        corretor_id: corretorId,
        tarefa_id: tarefaId,
        semana_inicio: getWeekStartDate(today),
        trimestre: selectedTrimestre,
        ano: currentYear,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["placar-entregas"] });
      toast({ title: "Entrega registrada!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleUploadPlacar = async () => {
    if (!uploadFile || !uploadCorretorId) {
      toast({ title: "Selecione o corretor e o arquivo", variant: "destructive" });
      return;
    }
    if (uploadSemana !== thisWeekStart || isWeekDeadlinePassed(uploadSemana)) {
      toast({ title: "Prazo encerrado", description: "Só é permitido enviar o placar da semana atual antes de sexta-feira às 15:00.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const uploadTrimestre = Math.ceil((new Date(uploadSemana + "T12:00:00").getMonth() + 1) / 3);
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("corretor_id", uploadCorretorId);
      formData.append("trimestre", String(uploadTrimestre));
      formData.append("ano", String(currentYear));
      formData.append("semana_inicio", uploadSemana);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/process-placar-upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          body: formData,
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro no processamento");

      queryClient.invalidateQueries({ queryKey: ["placar-entregas"] });
      setOpenUpload(false);
      setUploadFile(null);
      setUploadCorretorId("");
      toast({
        title: `✅ ${result.totalPontos} pontos registrados!`,
        description: result.detalhes?.map((d: any) => `${d.tarefa}: ${d.quantidade}x (${d.pontos}pts)`).join(" | "),
      });
    } catch (e: any) {
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Calculate ranking
  const ranking = useMemo(() => {
    const startMonth = (selectedTrimestre - 1) * 3;
    const endMonth = startMonth + 3;

    return corretores.map(c => {
      // Points from tasks
      const corretorEntregas = entregas.filter(e => e.corretor_id === c.id);
      const pontos = corretorEntregas.reduce((sum, e) => {
        const tarefa = e.placar_tarefas as any;
        return sum + (tarefa?.pontos || 0);
      }, 0);

      // VGV for the trimester
      const vgvTri = vendas
        .filter(v => {
          if (v.corretor_id !== c.id) return false;
          const d = parseLocalDate(v.data_venda);
          if (!d || d.getFullYear() !== currentYear) return false;
          const m = d.getMonth();
          return m >= startMonth && m < endMonth;
        })
        .reduce((sum, v) => sum + Number(v.valor), 0);

      // Captações (agenciamentos) from placar tasks
      const agenciamentoTarefaIds = tarefas
        .filter(t => t.nome.toLowerCase().startsWith("agenciamento"))
        .map(t => t.id);
      const captTri = corretorEntregas.filter(e => agenciamentoTarefaIds.includes(e.tarefa_id)).length;

      const metaPontos = pontos >= 120;
      const metaVgv = vgvTri >= 900000;
      const metaCaptacoes = captTri >= 15;
      const elegivel = metaPontos && metaVgv && metaCaptacoes;

      return { ...c, pontos, vgvTri, captTri, metaPontos, metaVgv, metaCaptacoes, elegivel };
    }).sort((a, b) => b.pontos - a.pontos);
  }, [corretores, entregas, vendas, tarefas, selectedTrimestre, currentYear]);

  const thisWeekStart = getWeekStartDate(new Date());

  return (
    <div className="space-y-6">
      {/* Header with rules */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Placar Voluire — Cultura & Comportamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Entrega</p>
              <p className="text-sm">Toda sexta-feira até 15:00</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Mínimo de Pontos</p>
              <p className="text-sm font-semibold">120 pontos</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Mínimo VGV</p>
              <p className="text-sm font-semibold">R$ 900.000</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Mínimo Captações</p>
              <p className="text-sm font-semibold">15 agenciamentos</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-yellow-500" />
              <span>Troféu trimestral + foto digital</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-pink-500" />
              <span>Experiência Spa + Jantar (R$ 200)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trimestre selector + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(selectedTrimestre)} onValueChange={v => setSelectedTrimestre(Number(v))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRIMESTRES.map(t => (
              <SelectItem key={t} value={String(t)}>{TRIMESTRE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Dialog open={openUpload} onOpenChange={(v) => { setOpenUpload(v); if (!v) { setUploadFile(null); setUploadCorretorId(""); setUploadSemana(thisWeekStart); } }}>
            <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-2" />Upload Placar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Placar Semanal</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Corretor</Label>
                  <Select value={uploadCorretorId} onValueChange={setUploadCorretorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o corretor" /></SelectTrigger>
                    <SelectContent>
                      {corretores.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Semana</Label>
                  <Select value={uploadSemana} onValueChange={setUploadSemana}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getRecentWeeks(8).map(w => {
                        const isCurrent = w === thisWeekStart;
                        const blocked = !isCurrent || isWeekDeadlinePassed(w);
                        const label = `Semana de ${new Date(w + "T12:00:00").toLocaleDateString("pt-BR")}`;
                        return (
                          <SelectItem key={w} value={w} disabled={blocked}>
                            {label}{!isCurrent ? " (encerrada)" : isWeekDeadlinePassed(w) ? " (prazo encerrado)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {(uploadSemana !== thisWeekStart || isWeekDeadlinePassed(uploadSemana)) && (
                    <p className="text-sm text-destructive">⚠️ Só é permitido enviar na semana atual antes de sexta 15:00.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Planilha (.xlsx)</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button
                  onClick={handleUploadPlacar}
                  className="w-full"
                  disabled={uploading || !uploadFile || !uploadCorretorId || uploadSemana !== thisWeekStart || isWeekDeadlinePassed(uploadSemana)}
                >
                  {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</> : "Enviar e Contabilizar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openTarefa} onOpenChange={setOpenTarefa}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Nova Tarefa</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Tarefa do Placar</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createTarefa.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
                <div className="space-y-2"><Label>Nome da Tarefa</Label><Input name="nome" required /></div>
                <div className="space-y-2"><Label>Pontuação</Label><Input name="pontos" type="number" required /></div>
                <Button type="submit" className="w-full" disabled={createTarefa.isPending}>Criar Tarefa</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking — {TRIMESTRE_LABELS[selectedTrimestre]} {currentYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-center">Pontos</TableHead>
                  <TableHead className="text-center">VGV Tri</TableHead>
                  <TableHead className="text-center">Captações</TableHead>
                  <TableHead className="text-center">Elegível</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((c, i) => (
                  <TableRow key={c.id} className={c.elegivel ? "bg-green-50 dark:bg-green-950/20" : ""}>
                    <TableCell className="font-bold">
                      {i === 0 && c.pontos > 0 ? <Trophy className="h-4 w-4 text-yellow-500" /> : `${i + 1}º`}
                    </TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.metaPontos ? "default" : "secondary"} className={c.metaPontos ? "bg-green-600" : ""}>
                        {c.pontos}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={c.metaVgv ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                        {formatCurrency(c.vgvTri)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={c.metaCaptacoes ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                        {c.captTri}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {c.elegivel
                        ? <Check className="h-5 w-5 text-green-600 mx-auto" />
                        : <X className="h-5 w-5 text-muted-foreground mx-auto" />
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Registrar entregas da semana */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Registrar Entregas — Semana de {new Date(thisWeekStart + "T12:00:00").toLocaleDateString("pt-BR")}
            {isWeekDeadlinePassed(thisWeekStart) && (
              <Badge variant="destructive" className="text-xs">Prazo encerrado</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tarefas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa cadastrada. Clique em "Nova Tarefa" para começar.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead className="text-center w-20">Pts</TableHead>
                    {corretores.map(c => (
                      <TableHead key={c.id} className="text-center text-xs min-w-[80px]">{c.nome.split(" ")[0]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarefas.map(tarefa => (
                    <TableRow key={tarefa.id}>
                      <TableCell className="text-sm">{tarefa.nome}</TableCell>
                      <TableCell className="text-center font-semibold text-primary">{tarefa.pontos}</TableCell>
                      {corretores.map(c => {
                        const delivered = entregas.some(
                          e => e.corretor_id === c.id && e.tarefa_id === tarefa.id && e.semana_inicio === thisWeekStart
                        );
                        return (
                          <TableCell key={c.id} className="text-center">
                            <Checkbox
                              checked={delivered}
                              disabled={delivered || registrarEntrega.isPending || isWeekDeadlinePassed(thisWeekStart)}
                              onCheckedChange={() => registrarEntrega.mutate({ corretorId: c.id, tarefaId: tarefa.id })}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
