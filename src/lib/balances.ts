import type { AccountBalance } from "./supabase/types";

export type BalanceSummary = {
  /** Dinheiro que existe hoje: soma das contas que não são cartão. */
  cash: number;
  /** Quanto se deve nos cartões agora, sempre em valor positivo. */
  cardDebt: number;
  /** Parcelas que ainda vão cair em faturas futuras. */
  futureCardDebt: number;
  /** O que sobra depois de pagar o que já está em aberto. */
  net: number;
  /** Quantidade de contas de verdade (cartão não conta). */
  accountCount: number;
  cardCount: number;
};

/**
 * Fonte única do saldo em todo o app.
 *
 * Usa `posted_balance` (só o que já ocorreu) e não `balance` (que inclui
 * lançamentos futuros). A diferença importa: com uma compra em 12x, `balance`
 * já carrega as 12 parcelas, então "quanto devo hoje" apareceria inflado e o
 * dinheiro disponível, menor do que é.
 *
 * Para limite de cartão vale o contrário — ver `availableLimit`.
 */
export function summarizeBalances(accounts: AccountBalance[]): BalanceSummary {
  let cash = 0;
  let cardDebt = 0;
  let futureCardDebt = 0;
  let accountCount = 0;
  let cardCount = 0;

  for (const account of accounts) {
    const posted = Number(account.posted_balance);

    if (account.type === "credit_card") {
      cardCount += 1;
      // Saldo positivo em cartão é crédito a favor (estorno), não dívida.
      cardDebt += Math.max(0, -posted);
      // O que já foi comprado mas ainda não chegou na fatura.
      futureCardDebt += Math.max(0, posted - Number(account.balance));
    } else {
      accountCount += 1;
      cash += posted;
    }
  }

  return {
    cash,
    cardDebt,
    futureCardDebt,
    net: cash - cardDebt,
    accountCount,
    cardCount,
  };
}
