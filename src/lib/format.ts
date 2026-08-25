import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number): string {
  return currency.format(value);
}

/** Mesma coisa, mas sem o "R$" — para tabelas onde a moeda já está no cabeçalho. */
export function formatAmount(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Máscara aplicada a cada tecla: separa milhar com ponto e aceita no máximo
 * duas casas depois da vírgula. Não completa os centavos aqui — fazer isso
 * enquanto a pessoa digita atrapalharia (digitar "12" viraria "12,00" e o
 * cursor pularia). O arredondamento fica para o blur.
 */
export function maskCurrencyInput(input: string, allowNegative = false): string {
  const isNegative = allowNegative && input.trimStart().startsWith("-");
  const cleaned = input.replace(/[^\d,]/g, "");

  const [rawInteger = "", ...rest] = cleaned.split(",");
  const hasComma = cleaned.includes(",");
  const decimals = rest.join("").slice(0, 2);

  // Zeros à esquerda somem, mas "0" sozinho continua digitável
  const integer = rawInteger.replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const body = hasComma ? `${grouped},${decimals}` : grouped;
  if (!body) return isNegative ? "-" : "";

  return `${isNegative ? "-" : ""}${body}`;
}

/** Prepara um número vindo do banco para ser editado num campo de moeda. */
export function toCurrencyInputValue(value: number | string | null): string {
  if (value === null || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatAmount(parsed) : "";
}

/** Converte "1.234,56" (como a pessoa digita) em 1234.56. */
export function parseCurrencyInput(input: string): number {
  const normalized = input
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** "2026-08-24" -> "24 ago 2026" */
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd MMM yyyy", { locale: ptBR });
}

/** "2026-08-24" -> "24/08" */
export function formatDayMonth(isoDate: string): string {
  return format(parseISO(isoDate), "dd/MM", { locale: ptBR });
}

/** "agosto de 2026", com a inicial maiúscula. */
export function formatMonthLabel(date: Date): string {
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Data de hoje no formato que a coluna `date` do Postgres espera. */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}
