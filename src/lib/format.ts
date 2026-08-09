/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
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
