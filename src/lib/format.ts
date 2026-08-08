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
