import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { splitInstallments } from "../credit-card";

import { getSupabaseBrowserClient } from "../supabase/client";
import type { TransactionType, TransactionWithRelations } from "../supabase/types";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

export type DateRange = { from: string; to: string };

export function monthRange(date: Date): DateRange {
  return {
    from: format(startOfMonth(date), "yyyy-MM-dd"),
    to: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

// `accounts` é referenciada duas vezes (origem e destino), então o PostgREST
// exige o nome da constraint para saber qual join é qual.
const SELECT_WITH_RELATIONS = `
  *,
  account:accounts!transactions_account_id_fkey (id, name, color, institution, type),
  to_account:accounts!transactions_to_account_id_fkey (id, name, color, institution, type),
  category:categories (id, name, color, kind)
`;

export const transactionsQueryOptions = (range: DateRange) =>
  queryOptions({
    queryKey: ["transactions", range.from, range.to],
    queryFn: async (): Promise<TransactionWithRelations[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(SELECT_WITH_RELATIONS)
        .gte("occurred_on", range.from)
        .lte("occurred_on", range.to)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // O select embutido é montado como string, então o supabase-js não
      // consegue inferir o formato do join sozinho.
      return (data ?? []) as unknown as TransactionWithRelations[];
    },
  });

export type MonthlyTotal = { month: string; label: string; total: number };

/**
 * Despesas somadas por mês, para o gráfico de barras. Meses sem lançamento
 * entram zerados — senão o gráfico "pula" períodos e engana a leitura.
 */
export const monthlyExpensesQueryOptions = (reference: Date, months = 6) => {
  const start = startOfMonth(subMonths(reference, months - 1));
  const end = endOfMonth(reference);
  const from = format(start, "yyyy-MM-dd");
  const to = format(end, "yyyy-MM-dd");

  return queryOptions({
    queryKey: ["transactions", "monthly-expenses", from, to],
    queryFn: async (): Promise<MonthlyTotal[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, occurred_on")
        .eq("type", "expense")
        .gte("occurred_on", from)
        .lte("occurred_on", to);

      if (error) throw error;

      const totals = new Map<string, number>();

      for (const row of data ?? []) {
        const key = row.occurred_on.slice(0, 7);
        totals.set(key, (totals.get(key) ?? 0) + Number(row.amount));
      }

      return eachMonthOfInterval({ start, end }).map((date) => {
        const key = format(date, "yyyy-MM");
        return {
          month: key,
          label: format(date, "MMM", { locale: ptBR }),
          total: totals.get(key) ?? 0,
        };
      });
    },
  });
};

export type TransactionInput = {
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string | null;
  occurredOn: string;
  /** Número de parcelas; 1 (ou ausente) é compra à vista. */
  installments?: number;
};

function toRow(input: TransactionInput) {
  const isTransfer = input.type === "transfer";

  return {
    type: input.type,
    amount: input.amount,
    account_id: input.accountId,
    // O banco recusa transferência sem destino e receita/despesa com destino;
    // normalizar aqui evita bater na constraint por um campo esquecido no form.
    to_account_id: isTransfer ? input.toAccountId : null,
    category_id: isTransfer ? null : input.categoryId,
    description: input.description?.trim() || null,
    occurred_on: input.occurredOn,
  };
}

function useTransactionInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };
}

/**
 * Uma compra parcelada vira uma linha por parcela, cada uma com a data do mês
 * em que cai. É isso que faz cada parcela aparecer na fatura certa — sem
 * nenhuma lógica de projeção depois.
 */
function toInsertRows(input: TransactionInput, userId: string) {
  const base = toRow(input);
  const count = input.installments ?? 1;

  if (count <= 1) {
    return [{ user_id: userId, ...base }];
  }

  const group = crypto.randomUUID();
  const firstDate = parseISO(input.occurredOn);

  return splitInstallments(input.amount, count).map((amount, index) => ({
    user_id: userId,
    ...base,
    amount,
    occurred_on: format(addMonths(firstDate, index), "yyyy-MM-dd"),
    installment_group: group,
    installment_number: index + 1,
    installment_total: count,
  }));
}

export function useCreateTransaction(userId: string) {
  const invalidate = useTransactionInvalidation();

  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("transactions").insert(toInsertRows(input, userId));

      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Remove todas as parcelas de uma compra parcelada de uma vez. */
export function useDeleteInstallmentGroup() {
  const invalidate = useTransactionInvalidation();

  return useMutation({
    mutationFn: async (group: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("transactions").delete().eq("installment_group", group);

      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useTransactionInvalidation();

  return useMutation({
    mutationFn: async ({ id, ...input }: TransactionInput & { id: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("transactions").update(toRow(input)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useTransactionInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
