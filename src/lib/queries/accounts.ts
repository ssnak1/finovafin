import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "../supabase/client";
import type { AccountBalance, AccountType } from "../supabase/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
  investment: "Investimento",
};

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

/**
 * Tipos oferecidos na tela de Contas. Cartão de crédito fica de fora de
 * propósito: ele é forma de pagamento do banco, não uma conta onde há dinheiro.
 * Cartões são criados e editados na tela de Cartões.
 */
export const BANK_ACCOUNT_TYPES = ACCOUNT_TYPES.filter((type) => type !== "credit_card");

export function isCreditCardAccount(account: { type: AccountType }): boolean {
  return account.type === "credit_card";
}

export const accountsQueryOptions = () =>
  queryOptions({
    queryKey: ["accounts"],
    queryFn: async (): Promise<AccountBalance[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("account_balances").select("*").order("name");

      if (error) throw error;
      return data ?? [];
    },
  });

export type AccountInput = {
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  institution: string | null;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  /** No cartão, a conta que paga a fatura. */
  linkedAccountId: string | null;
};

/** Dados do cartão criado junto com a conta, no mesmo formulário. */
export type CompanionCard = {
  name: string;
  creditLimit: number | null;
  closingDay: number;
  dueDay: number;
};

/** Saldo e lista de contas mudam juntos — invalidar os dois evita saldo velho na tela. */
function useAccountInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };
}

export function useCreateAccount(userId: string) {
  const invalidate = useAccountInvalidation();

  return useMutation({
    mutationFn: async ({ card, ...input }: AccountInput & { card?: CompanionCard | null }) => {
      const supabase = getSupabaseBrowserClient();

      const { data: created, error } = await supabase
        .from("accounts")
        .insert({
          user_id: userId,
          name: input.name,
          type: input.type,
          initial_balance: input.initialBalance,
          color: input.color,
          institution: input.institution,
          credit_limit: input.creditLimit,
          closing_day: input.closingDay,
          due_day: input.dueDay,
          linked_account_id: input.linkedAccountId,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!card) return;

      // O cartão herda banco e cor da conta e já nasce vinculado a ela — é o
      // que evita redigitar tudo e deixa o pagamento da fatura pré-preenchido.
      const { error: cardError } = await supabase.from("accounts").insert({
        user_id: userId,
        name: card.name,
        type: "credit_card",
        initial_balance: 0,
        color: input.color,
        institution: input.institution,
        credit_limit: card.creditLimit,
        closing_day: card.closingDay,
        due_day: card.dueDay,
        linked_account_id: created.id,
      });

      if (cardError) {
        // A conta já existe neste ponto; dizer isso evita a pessoa achar que
        // nada foi salvo e criar tudo de novo.
        throw new Error(
          `A conta foi criada, mas o cartão não: ${cardError.message}. ` +
            `Adicione o cartão separadamente.`,
        );
      }
    },
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useAccountInvalidation();

  return useMutation({
    mutationFn: async ({ id, ...input }: AccountInput & { id: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("accounts")
        .update({
          name: input.name,
          type: input.type,
          initial_balance: input.initialBalance,
          color: input.color,
          institution: input.institution,
          credit_limit: input.creditLimit,
          closing_day: input.closingDay,
          due_day: input.dueDay,
          linked_account_id: input.linkedAccountId,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useAccountInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
