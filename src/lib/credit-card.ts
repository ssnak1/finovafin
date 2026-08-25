import {
  addMonths,
  endOfMonth,
  format,
  getDate,
  isAfter,
  parseISO,
  setDate,
  startOfMonth,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import type { AccountBalance, TransactionWithRelations } from "./supabase/types";

/** Padrões usados quando o cartão foi criado sem informar os dias. */
export const DEFAULT_CLOSING_DAY = 20;
export const DEFAULT_DUE_DAY = 28;

/**
 * Um dia pedido pode não existir no mês (dia 31 em fevereiro). Nesses casos
 * a data vai para o último dia do mês, que é como as operadoras tratam.
 */
function safeSetDate(month: Date, day: number): Date {
  const last = getDate(endOfMonth(month));
  return setDate(startOfMonth(month), Math.min(day, last));
}

export type StatementPeriod = {
  /** Dia 1 do mês de competência — identifica a fatura. */
  referenceMonth: Date;
  /** Primeira e última data de compra que caem nesta fatura. */
  start: Date;
  end: Date;
  /** Quando fecha e quando vence. */
  closesOn: Date;
  dueOn: Date;
};

/**
 * A fatura de competência M fecha no dia de fechamento de M e reúne as compras
 * feitas desde o dia seguinte ao fechamento de M-1.
 *
 * O vencimento cai no mês seguinte quando o dia de vencimento é anterior ao de
 * fechamento — o caso comum (fecha dia 20, vence dia 10 do mês seguinte).
 */
export function statementPeriod(
  referenceMonth: Date,
  closingDay: number,
  dueDay: number,
): StatementPeriod {
  const reference = startOfMonth(referenceMonth);
  const closesOn = safeSetDate(reference, closingDay);
  const previousClose = safeSetDate(addMonths(reference, -1), closingDay);

  const dueOn =
    dueDay > closingDay
      ? safeSetDate(reference, dueDay)
      : safeSetDate(addMonths(reference, 1), dueDay);

  return {
    referenceMonth: reference,
    start: subDays(previousClose, -1),
    end: closesOn,
    closesOn,
    dueOn,
  };
}

/** Em qual fatura uma compra feita nesta data cai. */
export function statementMonthFor(occurredOn: string, closingDay: number): Date {
  const date = parseISO(occurredOn);
  const month = startOfMonth(date);
  // Passou do fechamento: já é a fatura do mês que vem.
  return isAfter(date, safeSetDate(month, closingDay)) ? addMonths(month, 1) : month;
}

export type CardStatement = {
  period: StatementPeriod;
  transactions: TransactionWithRelations[];
  /** Compras menos estornos. */
  total: number;
  isPaid: boolean;
};

export function buildStatement(
  referenceMonth: Date,
  card: Pick<AccountBalance, "closing_day" | "due_day">,
  transactions: TransactionWithRelations[],
  paidMonths: Set<string>,
): CardStatement {
  const closingDay = card.closing_day ?? DEFAULT_CLOSING_DAY;
  const dueDay = card.due_day ?? DEFAULT_DUE_DAY;
  const period = statementPeriod(referenceMonth, closingDay, dueDay);
  const key = monthKey(period.referenceMonth);

  const inStatement = transactions.filter(
    (transaction) =>
      // Pagamento da fatura é transferência: abate a dívida, mas não é compra.
      transaction.type !== "transfer" &&
      monthKey(statementMonthFor(transaction.occurred_on, closingDay)) === key,
  );

  const total = inStatement.reduce((sum, transaction) => {
    const amount = Number(transaction.amount);
    return transaction.type === "expense" ? sum + amount : sum - amount;
  }, 0);

  return { period, transactions: inStatement, total, isPaid: paidMonths.has(key) };
}

/**
 * Como a fatura é chamada: pelo mês em que ela VENCE, não em que fecha.
 *
 * Uma compra em 24/08 num cartão que fecha dia 30 entra na fatura que vence
 * em 10/09 — e todo mundo chama essa de "fatura de setembro". Internamente ela
 * continua identificada pela competência de fechamento (ver `monthKey`); isso
 * aqui é só o nome exibido.
 */
export function statementTitle(period: StatementPeriod, pattern = "MMMM 'de' yyyy"): string {
  return format(period.dueOn, pattern, { locale: ptBR });
}

/** Chave estável de competência: "2026-08". Baseada no fechamento. */
export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

/** Formato que a coluna `date` do Postgres espera para o mês de referência. */
export function referenceMonthISO(date: Date): string {
  return format(startOfMonth(date), "yyyy-MM-dd");
}

/**
 * Divide um valor em parcelas sem perder centavo: as parcelas são arredondadas
 * para baixo e a diferença acumulada vai para a primeira — que é como as
 * operadoras fazem (a primeira parcela costuma ser a "quebrada").
 */
export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;

  return Array.from({ length: count }, (_, index) =>
    index === 0 ? (base + remainder) / 100 : base / 100,
  );
}

export function isCreditCard(account: Pick<AccountBalance, "type">): boolean {
  return account.type === "credit_card";
}

/**
 * Limite disponível. O saldo do cartão é negativo quando há dívida, então
 * somar já desconta o que foi usado.
 */
export function availableLimit(card: AccountBalance): number | null {
  if (card.credit_limit === null) return null;
  return Number(card.credit_limit) + Number(card.balance);
}
