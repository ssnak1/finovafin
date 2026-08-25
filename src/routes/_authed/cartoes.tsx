import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addMonths, format, isAfter, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pencil,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BankLogo } from "../../components/app/bank-logo";
import { CardDialog } from "../../components/app/card-dialog";
import { PageHeader } from "../../components/app/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/app/states";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  availableLimit,
  buildStatement,
  DEFAULT_CLOSING_DAY,
  DEFAULT_DUE_DAY,
  statementTitle,
} from "../../lib/credit-card";
import { CurrencyInput } from "../../components/app/currency-input";
import {
  formatCurrency,
  formatDate,
  parseCurrencyInput,
  toCurrencyInputValue,
  todayISO,
} from "../../lib/format";
import { accountsQueryOptions } from "../../lib/queries/accounts";
import {
  cardTransactionsQueryOptions,
  paidStatementsQueryOptions,
  usePayStatement,
  useUnpayStatement,
} from "../../lib/queries/cards";
import type { AccountBalance } from "../../lib/supabase/types";

export const Route = createFileRoute("/_authed/cartoes")({
  head: () => ({ meta: [{ title: "Cartões — Finova" }] }),
  component: CardsPage,
});

function CardsPage() {
  const { user } = Route.useRouteContext();
  const accounts = useQuery(accountsQueryOptions());

  const cards = (accounts.data ?? []).filter((account) => account.type === "credit_card");
  const payableAccounts = (accounts.data ?? []).filter((account) => account.type !== "credit_card");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountBalance | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = cards.find((card) => card.account_id === selectedId) ?? cards[0];

  return (
    <>
      <PageHeader
        title="Cartões"
        description="Cartão de crédito é forma de pagamento do banco — não uma conta."
        actions={
          <Button className="rounded-full" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo cartão
          </Button>
        }
      />

      {accounts.isPending ? (
        <ListSkeleton rows={3} />
      ) : accounts.isError ? (
        <ErrorState error={accounts.error} />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão cadastrado"
          description="Cadastre o cartão do seu banco com limite, dia de fechamento e de vencimento."
          action={
            <Button className="rounded-full" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Novo cartão
            </Button>
          }
        />
      ) : (
        <>
          {cards.length > 1 ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {cards.map((card) => (
                <button
                  key={card.account_id}
                  onClick={() => setSelectedId(card.account_id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                    selected?.account_id === card.account_id
                      ? "border-primary/40 bg-primary/12 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BankLogo
                    institution={card.institution}
                    name={card.name}
                    color={card.color}
                    size="sm"
                  />
                  {card.name}
                </button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <CardDetail
              key={selected.account_id}
              card={selected}
              payableAccounts={payableAccounts}
              onEdit={() => setEditing(selected)}
            />
          ) : null}
        </>
      )}

      {creating || editing ? (
        <CardDialog
          key={editing?.account_id ?? "new"}
          card={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          userId={user.id}
          payableAccounts={payableAccounts}
        />
      ) : null}
    </>
  );
}

function CardDetail({
  card,
  payableAccounts,
  onEdit,
}: {
  card: AccountBalance;
  payableAccounts: AccountBalance[];
  onEdit: () => void;
}) {
  const { user } = Route.useRouteContext();
  const [month, setMonth] = useState(() => new Date());
  const [payOpen, setPayOpen] = useState(false);

  const closingDay = card.closing_day ?? DEFAULT_CLOSING_DAY;
  const dueDay = card.due_day ?? DEFAULT_DUE_DAY;

  const linkedAccount = payableAccounts.find(
    (account) => account.account_id === card.linked_account_id,
  );

  const transactions = useQuery(
    cardTransactionsQueryOptions(card.account_id, month, closingDay, dueDay),
  );
  const paidMonths = useQuery(paidStatementsQueryOptions(card.account_id));
  const unpayStatement = useUnpayStatement();

  const statement = useMemo(
    () => buildStatement(month, card, transactions.data ?? [], paidMonths.data ?? new Set()),
    [month, card, transactions.data, paidMonths.data],
  );

  // Limite usa o saldo total: a operadora reserva o valor cheio da compra
  // parcelada na hora, e vai liberando conforme as faturas são pagas.
  const debt = Math.abs(Math.min(0, Number(card.balance)));
  const postedDebt = Math.abs(Math.min(0, Number(card.posted_balance)));
  const futureCommitted = Math.max(0, debt - postedDebt);
  const limit = card.credit_limit === null ? null : Number(card.credit_limit);
  const available = availableLimit(card);
  const usedPercent = limit && limit > 0 ? Math.min(100, (debt / limit) * 100) : 0;

  const isFuture = isAfter(statement.period.referenceMonth, new Date());

  const handleUnpay = async () => {
    try {
      await unpayStatement.mutateAsync({
        cardId: card.account_id,
        referenceMonth: statement.period.referenceMonth,
      });
      toast.success("Fatura reaberta.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reabrir.");
    }
  };

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5 lg:col-span-1">
          <div className="flex items-start gap-3">
            <BankLogo
              institution={card.institution}
              name={card.name}
              color={card.color}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-medium">{card.name}</h2>
              <p className="text-xs text-muted-foreground">
                Fecha dia {closingDay} · vence dia {dueDay}
              </p>
              {linkedAccount ? (
                <p className="truncate text-xs text-muted-foreground">
                  Paga por {linkedAccount.name}
                </p>
              ) : (
                <button onClick={onEdit} className="text-xs text-primary hover:underline">
                  Vincular conta de pagamento
                </button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Editar ${card.name}`}
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>

          <div className="mt-5">
            <span className="text-xs text-muted-foreground">Limite disponível</span>
            {limit === null ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Limite não informado.{" "}
                <Link to="/contas" className="text-primary hover:underline">
                  Definir
                </Link>
              </p>
            ) : (
              <>
                <p className="tabular text-2xl font-semibold">{formatCurrency(available ?? 0)}</p>
                <Progress value={usedPercent} className="mt-3 h-2" />
                {futureCommitted > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatCurrency(futureCommitted)} disso são parcelas que ainda vão cair
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatCurrency(debt)} de {formatCurrency(limit)} usados (
                  {Math.round(usedPercent)}%)
                </p>
                {usedPercent >= 80 ? (
                  <p className="mt-2 text-xs text-negative">Você já usou mais de 80% do limite.</p>
                ) : null}
              </>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs text-muted-foreground">
                Fatura de {statementTitle(statement.period)}
              </span>
              <p className="tabular mt-1 text-3xl font-semibold">
                {formatCurrency(statement.total)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Fecha {formatDate(format(statement.period.closesOn, "yyyy-MM-dd"))} · vence{" "}
                {formatDate(format(statement.period.dueOn, "yyyy-MM-dd"))}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-border p-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                aria-label="Fatura anterior"
                onClick={() => setMonth(subMonths(month, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-20 text-center text-xs font-medium">
                {statementTitle(statement.period, "MMM/yy")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                aria-label="Próxima fatura"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {statement.isPaid ? (
              <>
                <span className="flex items-center gap-1.5 rounded-full bg-positive/15 px-3 py-1.5 text-xs font-medium text-positive">
                  <Check className="size-3.5" />
                  Fatura paga
                </span>
                <Button variant="ghost" size="sm" onClick={handleUnpay}>
                  Reabrir
                </Button>
              </>
            ) : statement.total <= 0 ? (
              <span className="text-sm text-muted-foreground">Nada lançado nesta fatura.</span>
            ) : (
              <Button
                className="rounded-full"
                onClick={() => setPayOpen(true)}
                disabled={payableAccounts.length === 0}
              >
                Pagar fatura
              </Button>
            )}

            {isFuture && !statement.isPaid ? (
              <span className="text-xs text-muted-foreground">
                Fatura futura — ainda vai receber lançamentos.
              </span>
            ) : null}
          </div>
        </article>
      </section>

      <section className="mt-5">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <h3 className="border-b border-border px-5 py-4 text-sm font-semibold">
            Lançamentos da fatura
          </h3>

          {transactions.isPending ? (
            <div className="p-5">
              <ListSkeleton rows={4} />
            </div>
          ) : statement.transactions.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              Nenhuma compra nesta fatura.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {statement.transactions.map((transaction) => {
                const color = transaction.category?.color ?? "#8A8A8A";
                const title =
                  transaction.description || (transaction.category?.name ?? "Sem categoria");

                return (
                  <li key={transaction.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      {title.charAt(0).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {title}
                        {transaction.installment_total ? (
                          <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            {transaction.installment_number}/{transaction.installment_total}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(transaction.occurred_on)}
                        {transaction.category ? ` · ${transaction.category.name}` : ""}
                      </p>
                    </div>

                    <span
                      className={`tabular shrink-0 text-sm font-semibold ${
                        transaction.type === "income" ? "text-positive" : "text-negative"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(transaction.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {payOpen ? (
        <PayStatementDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          userId={user.id}
          cardId={card.account_id}
          referenceMonth={statement.period.referenceMonth}
          dueOn={statement.period.dueOn}
          suggestedAmount={statement.total}
          accounts={payableAccounts}
          defaultAccountId={card.linked_account_id}
        />
      ) : null}
    </>
  );
}

function PayStatementDialog({
  open,
  onOpenChange,
  userId,
  cardId,
  referenceMonth,
  dueOn,
  suggestedAmount,
  accounts,
  defaultAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  cardId: string;
  /** Competência interna (mês de fechamento). */
  referenceMonth: Date;
  /** Mês pelo qual a fatura é chamada. */
  dueOn: Date;
  suggestedAmount: number;
  accounts: AccountBalance[];
  defaultAccountId: string | null;
}) {
  // Se o cartão tem conta vinculada, ela já vem escolhida — é o caso normal.
  const [fromAccountId, setFromAccountId] = useState(() => {
    const linkedExists = accounts.some((account) => account.account_id === defaultAccountId);
    return linkedExists && defaultAccountId ? defaultAccountId : (accounts[0]?.account_id ?? "");
  });
  const [amount, setAmount] = useState(() => toCurrencyInputValue(suggestedAmount));
  const [paidOn, setPaidOn] = useState(todayISO());

  const payStatement = usePayStatement(userId);

  const handleSubmit = async () => {
    const value = parseCurrencyInput(amount);

    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (!fromAccountId) {
      toast.error("Escolha a conta de onde sai o pagamento.");
      return;
    }

    try {
      await payStatement.mutateAsync({
        cardId,
        fromAccountId,
        referenceMonth,
        dueOn,
        amount: value,
        paidOn,
      });
      toast.success("Fatura paga.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível pagar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar fatura de {format(dueOn, "MMMM", { locale: ptBR })}</DialogTitle>
          <DialogDescription>
            Registra uma transferência da conta escolhida para o cartão, abatendo a dívida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-account">Pagar com</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger id="pay-account">
                <SelectValue placeholder="Escolha a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id}>
                    {account.name} · {formatCurrency(Number(account.posted_balance))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Valor</Label>
              <CurrencyInput id="pay-amount" value={amount} onChange={setAmount} />
              <p className="text-xs text-muted-foreground">
                Pagamento parcial também vale — o resto continua no saldo do cartão.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-date">Data</Label>
              <Input
                id="pay-date"
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={payStatement.isPending}>
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
