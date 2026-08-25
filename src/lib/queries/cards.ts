import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";

import { monthKey, referenceMonthISO, statementPeriod } from "../credit-card";
import { getSupabaseBrowserClient } from "../supabase/client";
import type { TransactionWithRelations } from "../supabase/types";

const SELECT_WITH_RELATIONS = `
  *,
  account:accounts!transactions_account_id_fkey (id, name, color, institution, type),
  to_account:accounts!transactions_to_account_id_fkey (id, name, color, institution, type),
  category:categories (id, name, color, kind)
`;

/**
 * Lançamentos de um cartão numa janela larga o bastante para montar a fatura
 * pedida e as vizinhas — a fatura de um mês contém compras do mês anterior,
 * então buscar só o mês corrente deixaria metade dos lançamentos de fora.
 */
export const cardTransactionsQueryOptions = (
  accountId: string,
  referenceMonth: Date,
  closingDay: number,
  dueDay: number,
) => {
  const previous = statementPeriod(addMonths(referenceMonth, -1), closingDay, dueDay);
  const next = statementPeriod(addMonths(referenceMonth, 1), closingDay, dueDay);
  const from = format(previous.start, "yyyy-MM-dd");
  const to = format(next.end, "yyyy-MM-dd");

  return queryOptions({
    queryKey: ["transactions", "card", accountId, from, to],
    queryFn: async (): Promise<TransactionWithRelations[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("transactions")
        .select(SELECT_WITH_RELATIONS)
        .eq("account_id", accountId)
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("occurred_on", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as TransactionWithRelations[];
    },
  });
};

/** Meses de competência já quitados, como Set de "yyyy-MM". */
export const paidStatementsQueryOptions = (accountId: string) =>
  queryOptions({
    queryKey: ["card-statements", accountId],
    queryFn: async (): Promise<Set<string>> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("card_statements")
        .select("reference_month")
        .eq("account_id", accountId);

      if (error) throw error;

      return new Set(
        (data ?? []).map((row) => monthKey(new Date(`${row.reference_month}T00:00:00`))),
      );
    },
  });

function useCardInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["card-statements"] });
  };
}

export type PayStatementInput = {
  cardId: string;
  fromAccountId: string;
  /** Competência interna (mês de fechamento) — é a chave em card_statements. */
  referenceMonth: Date;
  /** Mês de vencimento, usado só no texto do lançamento. */
  dueOn: Date;
  amount: number;
  paidOn: string;
};

/**
 * Pagar a fatura é uma transferência da conta para o cartão: abate a dívida
 * pelo mesmo caminho de qualquer transferência. O registro em card_statements
 * é o que marca aquela competência como quitada.
 */
export function usePayStatement(userId: string) {
  const invalidate = useCardInvalidation();

  return useMutation({
    mutationFn: async (input: PayStatementInput) => {
      const supabase = getSupabaseBrowserClient();

      const { data: payment, error: paymentError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          type: "transfer",
          amount: input.amount,
          account_id: input.fromAccountId,
          to_account_id: input.cardId,
          category_id: null,
          description: `Pagamento da fatura ${format(input.dueOn, "MM/yyyy")}`,
          occurred_on: input.paidOn,
        })
        .select("id")
        .single();

      if (paymentError) throw paymentError;

      const { error: statementError } = await supabase.from("card_statements").upsert(
        {
          user_id: userId,
          account_id: input.cardId,
          reference_month: referenceMonthISO(input.referenceMonth),
          payment_id: payment.id,
        },
        { onConflict: "account_id,reference_month" },
      );

      if (statementError) throw statementError;
    },
    onSuccess: invalidate,
  });
}

/** Desfaz a marcação de paga (não remove a transferência). */
export function useUnpayStatement() {
  const invalidate = useCardInvalidation();

  return useMutation({
    mutationFn: async ({ cardId, referenceMonth }: { cardId: string; referenceMonth: Date }) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("card_statements")
        .delete()
        .eq("account_id", cardId)
        .eq("reference_month", referenceMonthISO(referenceMonth));

      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
