// Regras únicas de metas do Dashboard (Fase 3).

export type TipoPeriodo = "mes" | "trimestre" | "ano";

export interface MetaRow {
  tipo: TipoPeriodo;
  ano: number;
  periodo: number; // mês 1-12, trimestre 1-4, ano 0
  valor: number;
}

export const ANO_INICIAL = 2025;

/** Anos selecionáveis: de 2025 até `ate` (inclusive), mais recente primeiro. */
export function anosDisponiveis(ate: number): number[] {
  const out: number[] = [];
  for (let a = Math.max(ate, ANO_INICIAL); a >= ANO_INICIAL; a--) out.push(a);
  return out;
}

/** Hoje no fuso America/Sao_Paulo. */
export function hojeSP() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [ano, mes] = parts.split("-").map(Number);
  return { ano, mes, trimestre: Math.ceil(mes / 3) };
}

export function mesesDoPeriodo(tipo: TipoPeriodo, periodo: number): number[] {
  if (tipo === "mes") return [periodo];
  if (tipo === "trimestre") return [1, 2, 3].map((i) => (periodo - 1) * 3 + i);
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

/**
 * Meta do período: usa a meta específica (trimestre/ano) se existir;
 * senão, soma das metas mensais do período. Retorna null se não houver nenhuma.
 */
export function metaDoPeriodo(metas: MetaRow[], tipo: TipoPeriodo, ano: number, periodo: number): number | null {
  const especifica = metas.find((m) => m.tipo === tipo && m.ano === ano && m.periodo === (tipo === "ano" ? 0 : periodo));
  if (especifica) return Number(especifica.valor);
  const meses = mesesDoPeriodo(tipo, periodo);
  const mensais = metas.filter((m) => m.tipo === "mes" && m.ano === ano && meses.includes(m.periodo));
  if (mensais.length === 0) return null;
  return mensais.reduce((s, m) => s + Number(m.valor), 0);
}

/**
 * "Falta para meta" — ÚNICO lugar da fórmula.
 * Para passar a usar VGV quitado, troque `realizado` por `quitado` aqui.
 */
export function faltaParaMeta(meta: number | null, v: { realizado: number; quitado: number }): number | null {
  if (meta == null) return null;
  return Math.max(meta - v.realizado, 0);
}

/** % da meta atingida (mesma base de `faltaParaMeta`). */
export function progressoMeta(meta: number | null, v: { realizado: number; quitado: number }): number | null {
  if (meta == null || meta <= 0) return null;
  return (v.realizado / meta) * 100;
}
