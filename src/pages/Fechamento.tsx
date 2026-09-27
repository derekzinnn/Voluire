import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Trophy } from "lucide-react";
import { formatCurrency, MESES } from "@/lib/format";
import { anosDisponiveis, hojeSP } from "@/lib/metas";
import { useUserRole } from "@/hooks/useUserRole";

type Tipo = "mes" | "trimestre" | "ano";
interface Linha { corretor_id: string; corretor_nome: string; realizado: number; quitado: number; a_receber: number }
interface Totais { realizado: number; quitado: number; a_receber: number }

const pad = (n: number) => String(n).padStart(2, "0");
const ultimoDia = (a: number, m: number) => new Date(a, m, 0).getDate();

export function intervalo(tipo: Tipo, ano: number, p: number) {
  if (tipo === "mes") return { ini: `${ano}-${pad(p)}-01`, fim: `${ano}-${pad(p)}-${pad(ultimoDia(ano, p))}` };
  if (tipo === "trimestre") {
    const m1 = (p - 1) * 3 + 1, m3 = m1 + 2;
    return { ini: `${ano}-${pad(m1)}-01`, fim: `${ano}-${pad(m3)}-${pad(ultimoDia(ano, m3))}` };
  }
  return { ini: `${ano}-01-01`, fim: `${ano}-12-31` };
}

function rotulo(tipo: Tipo, ano: number, p: number) {
  if (tipo === "mes") return `${MESES[p - 1]} ${ano}`;
  if (tipo === "trimestre") return `${p}º tri ${ano}`;
  return String(ano);
}

function useFechamento(tipo: Tipo, ano: number, p: number) {
  const { ini, fim } = intervalo(tipo, ano, p);
  return useQuery({
    queryKey: ["fechamento", ini, fim],
    queryFn: async () => {
      const [c, t] = await Promise.all([
        supabase.rpc("fechamento_corretores" as any, { p_ini: ini, p_fim: fim }),
        supabase.rpc("fechamento_totais" as any, { p_ini: ini, p_fim: fim }),
      ]);
      if (c.error) throw c.error;
      if (t.error) throw t.error;
      const linhas: Linha[] = ((c.data ?? []) as any[]).map((r) => ({
        corretor_id: r.corretor_id, corretor_nome: r.corretor_nome,
        realizado: Number(r.realizado), quitado: Number(r.quitado), a_receber: Number(r.a_receber),
      }));
      const t0 = ((t.data ?? []) as any[])[0] ?? {};
      const totais: Totais = { realizado: Number(t0.realizado ?? 0), quitado: Number(t0.quitado ?? 0), a_receber: Number(t0.a_receber ?? 0) };
      return { linhas, totais };
    },
  });
}

/** Ranking com empates: mesmo valor = mesma posição (1, 1, 3). */
function ranquear(linhas: Linha[], campo: "realizado" | "quitado") {
  const ord = [...linhas].filter((l) => l[campo] > 0).sort((a, b) => b[campo] - a[campo]);
  let pos = 0;
  return ord.map((l, i) => {
    if (i === 0 || l[campo] !== ord[i - 1][campo]) pos = i + 1;
    return { pos, nome: l.corretor_nome, valor: l[campo] };
  });
}

function exportarCSV(linhas: Linha[], totais: Totais, nome: string) {
  const f = (n: number) => n.toFixed(2).replace(".", ",");
  const rows = [
    ["Corretor", "Realizado", "Quitado", "A receber"],
    ...linhas.map((l) => [l.corretor_nome, f(l.realizado), f(l.quitado), f(l.a_receber)]),
    ["TOTAL GERAL", f(totais.realizado), f(totais.quitado), f(totais.a_receber)],
  ];
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `fechamento-${nome.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Ranking({ titulo, itens }: { titulo: string; itens: { pos: number; nome: string; valor: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Trophy className="h-4 w-4 text-amber-500" />{titulo}</CardTitle></CardHeader>
      <CardContent>
        {itens.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados no período.</p> : (
          <ol className="space-y-1.5">
            {itens.slice(0, 10).map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2"><Badge variant={r.pos <= 3 ? "default" : "outline"} className="w-8 justify-center">{r.pos}º</Badge>{r.nome}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(r.valor)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function Totalizador({ label, valor, cls }: { label: string; valor: number; cls?: string }) {
  return (
    <Card><CardContent className="pt-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${cls ?? ""}`}>{formatCurrency(valor)}</p>
    </CardContent></Card>
  );
}

export default function Fechamento() {
  const hoje = hojeSP();
  const { role } = useUserRole();
  const gestao = role !== "corretor";
  const anos = anosDisponiveis(hoje.ano);

  const [tipo, setTipo] = useState<Tipo>("mes");
  const [ano, setAno] = useState(hoje.ano);
  const [mes, setMes] = useState(hoje.mes);
  const [tri, setTri] = useState(hoje.trimestre);
  const [corretorSel, setCorretorSel] = useState<string>("todos");
  const p = tipo === "mes" ? mes : tipo === "trimestre" ? tri : 0;

  const atual = useFechamento(tipo, ano, p);
  // Visão lado a lado (mês / trimestre / ano) e rankings usam o mês/tri selecionados no ano selecionado
  const vMes = useFechamento("mes", ano, mes);
  const vTri = useFechamento("trimestre", ano, tri);
  const vAno = useFechamento("ano", ano, 0);

  const linhas = atual.data?.linhas ?? [];
  const totais = atual.data?.totais ?? { realizado: 0, quitado: 0, a_receber: 0 };
  const nomePeriodo = rotulo(tipo, ano, p);

  const lado = useMemo(() => {
    const alvo = gestao ? corretorSel : linhas[0]?.corretor_id;
    if (!alvo || alvo === "todos") return null;
    const pega = (d?: { linhas: Linha[] }) => d?.linhas.find((l) => l.corretor_id === alvo);
    return { nome: pega(vAno.data)?.corretor_nome ?? "", mes: pega(vMes.data), tri: pega(vTri.data), ano: pega(vAno.data) };
  }, [gestao, corretorSel, linhas, vMes.data, vTri.data, vAno.data]);

  const linhasTabela = gestao && corretorSel !== "todos" ? linhas.filter((l) => l.corretor_id === corretorSel) : linhas;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
          <TabsList>
            <TabsTrigger value="mes">Mensal</TabsTrigger>
            <TabsTrigger value="trimestre">Trimestral</TabsTrigger>
            <TabsTrigger value="ano">Anual</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {tipo === "mes" && (
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {tipo === "trimestre" && (
            <Select value={String(tri)} onValueChange={(v) => setTri(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4].map((t) => <SelectItem key={t} value={String(t)}>{t}º trimestre</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          {gestao && (
            <Select value={corretorSel} onValueChange={setCorretorSel}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Corretor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os corretores</SelectItem>
                {(vAno.data?.linhas ?? []).map((l) => <SelectItem key={l.corretor_id} value={l.corretor_id}>{l.corretor_nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Totalizador label={`Realizado · ${nomePeriodo}`} valor={totais.realizado} cls="text-primary" />
        <Totalizador label={`Quitado · ${nomePeriodo}`} valor={totais.quitado} cls="text-emerald-600" />
        <Totalizador label={`A receber · até o fim do período`} valor={totais.a_receber} cls="text-amber-600" />
      </div>

      {lado && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{lado.nome} — mês, trimestre e ano</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead /><TableHead className="text-right">{rotulo("mes", ano, mes)}</TableHead><TableHead className="text-right">{rotulo("trimestre", ano, tri)}</TableHead><TableHead className="text-right">{ano}</TableHead></TableRow></TableHeader>
              <TableBody>
                {(["realizado", "quitado", "a_receber"] as const).map((c) => (
                  <TableRow key={c}>
                    <TableCell className="font-medium">{c === "realizado" ? "Realizado" : c === "quitado" ? "Quitado" : "A receber"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(lado.mes?.[c] ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(lado.tri?.[c] ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(lado.ano?.[c] ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Por corretor · {nomePeriodo}</CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportarCSV(linhasTabela, totais, nomePeriodo)}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Corretor</TableHead><TableHead className="text-right">Realizado</TableHead><TableHead className="text-right">Quitado</TableHead><TableHead className="text-right">A receber</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {linhasTabela.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>}
              {linhasTabela.map((l) => (
                <TableRow key={l.corretor_id}>
                  <TableCell className="font-medium">{l.corretor_nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.realizado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.quitado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.a_receber)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total geral</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totais.realizado)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totais.quitado)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totais.a_receber)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {gestao && (
        <div className="grid gap-4 md:grid-cols-2">
          <Ranking titulo={`Realizado · ${rotulo("mes", ano, mes)}`} itens={ranquear(vMes.data?.linhas ?? [], "realizado")} />
          <Ranking titulo={`Quitado · ${rotulo("mes", ano, mes)}`} itens={ranquear(vMes.data?.linhas ?? [], "quitado")} />
          <Ranking titulo={`Realizado · ${ano}`} itens={ranquear(vAno.data?.linhas ?? [], "realizado")} />
          <Ranking titulo={`Quitado · ${ano}`} itens={ranquear(vAno.data?.linhas ?? [], "quitado")} />
        </div>
      )}
    </div>
  );
}
