import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { subMonths } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BankLogo } from "../../components/app/bank-logo";
import { MonthNav } from "../../components/app/month-nav";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/app/states";
import { Button } from "../../components/ui/button";
import { formatCurrency, formatDate } from "../../lib/format";
import { summarizeBalances } from "../../lib/balances";
import { accountsQueryOptions } from "../../lib/queries/accounts";
import {
  monthlyExpensesQueryOptions,
  monthRange,
  transactionsQueryOptions,
} from "../../lib/queries/transactions";
import type { MonthlyTotal } from "../../lib/queries/transactions";
import type { TransactionWithRelations } from "../../lib/supabase/types";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Visão geral — Finova" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const [month, setMonth] = useState(() => new Date());

  const range = useMemo(() => monthRange(month), [month]);
  const previousRange = useMemo(() => monthRange(subMonths(month, 1)), [month]);

  const accounts = useQuery(accountsQueryOptions());
  const transactions = useQuery(transactionsQueryOptions(range));
  const previous = useQuery(transactionsQueryOptions(previousRange));
  const monthlyExpenses = useQuery(monthlyExpensesQueryOptions(month));

  const summary = useMemo(() => summarize(transactions.data ?? []), [transactions.data]);
  const previousSummary = useMemo(() => summarize(previous.data ?? []), [previous.data]);

  const balances = useMemo(() => summarizeBalances(accounts.data ?? []), [accounts.data]);

  const savingsRate =
    summary.income > 0 ? ((summary.income - summary.expense) / summary.income) * 100 : null;

  const previousSavingsRate =
    previousSummary.income > 0
      ? ((previousSummary.income - previousSummary.expense) / previousSummary.income) * 100
      : null;

  const firstName = user.fullName?.split(" ")[0];
  const loadingMonth = transactions.isPending || previous.isPending;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {firstName ? `Olá, ${firstName}` : "Visão geral"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui está o que aconteceu com seu dinheiro no período.
          </p>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Saldo em contas"
          value={formatCurrency(balances.cash)}
          icon={Wallet}
          loading={accounts.isPending}
          hint="Dinheiro disponível hoje"
        />
        <StatCard
          label="Faturas em aberto"
          value={formatCurrency(balances.cardDebt)}
          icon={CreditCard}
          loading={accounts.isPending}
          hint={
            balances.futureCardDebt > 0
              ? `+ ${formatCurrency(balances.futureCardDebt)} em parcelas futuras`
              : balances.cardDebt > 0
                ? `Sobram ${formatCurrency(balances.net)}`
                : "Nenhuma dívida"
          }
        />
        <StatCard
          label="Receitas"
          value={formatCurrency(summary.income)}
          icon={ArrowDownRight}
          loading={loadingMonth}
          delta={percentChange(summary.income, previousSummary.income)}
          deltaGoodWhen="up"
        />
        <StatCard
          label="Despesas"
          value={formatCurrency(summary.expense)}
          icon={ArrowUpRight}
          loading={loadingMonth}
          delta={percentChange(summary.expense, previousSummary.expense)}
          deltaGoodWhen="down"
        />
        <StatCard
          label="Taxa de economia"
          value={savingsRate === null ? "—" : `${Math.round(savingsRate)}%`}
          icon={PiggyBank}
          loading={loadingMonth}
          delta={
            savingsRate !== null && previousSavingsRate !== null
              ? { value: savingsRate - previousSavingsRate, unit: "pp" }
              : null
          }
          deltaGoodWhen="up"
          hint={savingsRate === null ? "Sem receitas no período" : "Do que entrou, sobrou"}
        />
      </section>

      {transactions.isError ? (
        <div className="mt-6">
          <ErrorState error={transactions.error} />
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Gastos por categoria"
          subtitle="No período selecionado"
          footer={
            <Link to="/transacoes" className="text-sm text-primary hover:underline">
              Ver relatório completo
            </Link>
          }
        >
          {transactions.isPending ? (
            <ListSkeleton rows={4} />
          ) : summary.byCategory.length === 0 ? (
            <NoData />
          ) : (
            <CategoryDonut data={summary.byCategory} total={summary.expense} />
          )}
        </Panel>

        <Panel
          title="Despesas mensais"
          subtitle="Últimos 6 meses"
          footer={
            <Link to="/transacoes" className="text-sm text-primary hover:underline">
              Ver relatório completo
            </Link>
          }
        >
          {monthlyExpenses.isPending ? (
            <ListSkeleton rows={4} />
          ) : (
            <MonthlyBars data={monthlyExpenses.data ?? []} />
          )}
        </Panel>
      </section>

      <section className="mt-6">
        <Panel
          title="Transações recentes"
          action={
            <Button variant="secondary" size="sm" asChild className="rounded-full">
              <Link to="/transacoes">Ver todas</Link>
            </Button>
          }
        >
          {transactions.isPending ? (
            <ListSkeleton />
          ) : (transactions.data ?? []).length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhum lançamento neste mês"
              description="Registre sua primeira receita ou despesa para ver o resumo aqui."
              action={
                <Button asChild className="rounded-full">
                  <Link to="/transacoes">Lançar transação</Link>
                </Button>
              }
            />
          ) : (
            <RecentTable rows={(transactions.data ?? []).slice(0, 6)} />
          )}
        </Panel>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Agregações
// ---------------------------------------------------------------------------

type CategorySlice = { name: string; color: string; total: number };
type Delta = { value: number; unit: "%" | "pp" };

function summarize(transactions: TransactionWithRelations[]) {
  let income = 0;
  let expense = 0;
  const perCategory = new Map<string, CategorySlice>();

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);

    // Transferência move dinheiro entre contas do próprio usuário: não é
    // receita nem despesa, e o saldo total não muda por causa dela.
    if (transaction.type === "transfer") continue;

    if (transaction.type === "income") {
      income += amount;
      continue;
    }

    expense += amount;

    const key = transaction.category?.id ?? "sem-categoria";
    const existing = perCategory.get(key);

    if (existing) {
      existing.total += amount;
    } else {
      perCategory.set(key, {
        name: transaction.category?.name ?? "Sem categoria",
        color: transaction.category?.color ?? "#8A8A8A",
        total: amount,
      });
    }
  }

  return {
    income,
    expense,
    byCategory: [...perCategory.values()].sort((a, b) => b.total - a.total),
  };
}

/** Variação percentual; null quando não há base de comparação. */
function percentChange(current: number, previous: number): Delta | null {
  if (previous === 0) return null;
  return { value: ((current - previous) / previous) * 100, unit: "%" };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  delta,
  deltaGoodWhen = "up",
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  loading: boolean;
  delta?: Delta | null;
  deltaGoodWhen?: "up" | "down";
  hint?: string;
}) {
  const isUp = delta !== null && delta !== undefined && delta.value >= 0;
  const isGood = deltaGoodWhen === "up" ? isUp : !isUp;
  const DeltaIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary">
          <Icon className="size-[18px]" />
        </span>
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-secondary" />
      ) : (
        <p className="tabular mt-2 text-2xl font-semibold">{value}</p>
      )}

      {!loading && delta ? (
        <p
          className={`mt-1.5 flex items-center gap-1 text-xs ${
            isGood ? "text-positive" : "text-negative"
          }`}
        >
          <DeltaIcon className="size-3.5" />
          {Math.abs(delta.value).toFixed(1)}
          {delta.unit} vs. mês anterior
        </p>
      ) : !loading && hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </article>
  );
}

function Panel({
  title,
  subtitle,
  action,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>

      <div className="flex-1 px-5 pb-5">{children}</div>

      {footer ? <div className="border-t border-border px-5 py-3 text-center">{footer}</div> : null}
    </section>
  );
}

function NoData() {
  return (
    <p className="py-16 text-center text-sm text-muted-foreground">Sem dados para este período.</p>
  );
}

function CategoryDonut({ data, total }: { data: CategorySlice[]; total: number }) {
  const top = data.slice(0, 5);
  const rest = data.slice(5);

  const slices = rest.length
    ? [
        ...top,
        {
          name: "Outros",
          color: "#8A8A8A",
          total: rest.reduce((sum, slice) => sum + slice.total, 0),
        },
      ]
    : top;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative shrink-0">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={2}
              strokeWidth={0}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={TOOLTIP_STYLE}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-lg font-semibold">{formatCurrency(total)}</span>
          <span className="text-xs text-muted-foreground">Total gasto</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-3 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="tabular font-medium">{formatCurrency(slice.total)}</span>
            <span className="tabular w-9 text-right text-xs text-muted-foreground">
              {total > 0 ? Math.round((slice.total / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthlyBars({ data }: { data: MonthlyTotal[] }) {
  return (
    <ResponsiveContainer width="100%" height={228}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" />
            <stop offset="100%" stopColor="var(--color-chart-3)" />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickFormatter={(value: number) => value.toLocaleString("pt-BR", { notation: "compact" })}
        />
        <Tooltip
          cursor={{ fill: "var(--color-secondary)", opacity: 0.5 }}
          formatter={(value) => [formatCurrency(Number(value)), "Despesas"]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="total" fill="url(#barFill)" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RecentTable({ rows }: { rows: TransactionWithRelations[] }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-5 pb-3 font-medium">Data</th>
            <th className="px-2 pb-3 font-medium">Descrição</th>
            <th className="px-2 pb-3 font-medium">Categoria</th>
            <th className="px-2 pb-3 font-medium">Conta</th>
            <th className="px-5 pb-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((transaction) => (
            <TransactionTableRow key={transaction.id} transaction={transaction} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionTableRow({ transaction }: { transaction: TransactionWithRelations }) {
  const amount = Number(transaction.amount);
  const isTransfer = transaction.type === "transfer";
  const isIncome = transaction.type === "income";
  const color = isTransfer ? "#8A8A8A" : (transaction.category?.color ?? "#8A8A8A");

  const title =
    transaction.description ||
    (isTransfer ? "Transferência" : (transaction.category?.name ?? "Sem categoria"));

  return (
    <tr className="transition-colors hover:bg-secondary/40">
      <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
        {formatDate(transaction.occurred_on)}
      </td>

      <td className="px-2 py-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${color}26`, color }}
          >
            {title.charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-medium">{title}</span>
        </div>
      </td>

      <td className="px-2 py-3">
        <span
          className="inline-block rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {isTransfer ? "Transferência" : (transaction.category?.name ?? "Sem categoria")}
        </span>
      </td>

      <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">
        <span className="flex items-center gap-2">
          {transaction.account ? (
            <BankLogo
              institution={transaction.account.institution}
              name={transaction.account.name}
              color={transaction.account.color}
              size="sm"
            />
          ) : null}
          {isTransfer
            ? `${transaction.account?.name ?? "?"} → ${transaction.to_account?.name ?? "?"}`
            : (transaction.account?.name ?? "—")}
        </span>
      </td>

      <td
        className={`tabular px-5 py-3 text-right font-semibold whitespace-nowrap ${
          isTransfer ? "text-muted-foreground" : isIncome ? "text-positive" : "text-negative"
        }`}
      >
        {isTransfer ? "" : isIncome ? "+" : "-"}
        {formatCurrency(amount)}
      </td>
    </tr>
  );
}

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-popover)",
  color: "var(--color-popover-foreground)",
  fontSize: 12,
} as const;
