export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function parseLocalDate(date: string): Date | null {
  if (!date) return null;
  const parsed = new Date(date + (date.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDate(date: string): string {
  const parsed = parseLocalDate(date);
  if (!parsed) return "—";
  return new Intl.DateTimeFormat('pt-BR').format(parsed);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Máscara de moeda para input: digita-se em centavos e exibe 1.234.567,89.
 */
export function formatCurrencyInput(value: string): string {
  const d = onlyDigits(value);
  if (!d) return "";
  const n = Number(d) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte o valor numérico (string) para a máscara de moeda de input. */
export function numberToCurrencyInput(value: string | number): string {
  const n = Number(value);
  if (!value || Number.isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Extrai o número a partir da máscara de moeda de input. */
export function parseCurrencyInput(value: string): number {
  const d = onlyDigits(value);
  return d ? Number(d) / 100 : 0;
}

/**
 * Formata uma string como CPF: 000.000.000-00.
 * Limita a 11 dígitos. Retorna a string formatada (parcial enquanto digita).
 */
export function formatCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Formata uma string como telefone brasileiro: (51) 90000-0000.
 * Limita a 11 dígitos. Retorna a string formatada (parcial enquanto digita).
 */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
