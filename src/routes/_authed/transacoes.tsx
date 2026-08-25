import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BankLogo } from "../../components/app/bank-logo";
import { MonthNav } from "../../components/app/month-nav";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/app/states";
import { TransactionDialog } from "../../components/app/transaction-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { formatCurrency, formatDate } from "../../lib/format";
import { accountsQueryOptions } from "../../lib/queries/accounts";
import { categoriesQueryOptions } from "../../lib/queries/categories";
import {
  monthRange,
  TRANSACTION_TYPE_LABELS,
  transactionsQueryOptions,
  useDeleteTransaction,
} from "../../lib/queries/transactions";
import type { TransactionType, TransactionWithRelations } from "../../lib/supabase/types";

export const Route = createFileRoute("/_authed/transacoes")({
  head: () => ({ meta: [{ title: "Transações — Finova" }] }),
  // Devolve a chave só quando ela existe: assim `q` fica opcional no tipo e os
  // links para esta rota não precisam informar search.
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const term = search["q"];
    return typeof term === "string" && term ? { q: term } : {};
  },
  component: TransactionsPage,
});

const ALL = "__all__";

function TransactionsPage() {
  const { user } = Route.useRouteContext();
  const { q } = Route.useSearch();

  const [month, setMonth] = useState(() => new Date());
  const [search, setSearch] = useState(q ?? "");
  const [typeFilter, setTypeFilter] = useState<TransactionType | typeof ALL>(ALL);
  const [accountFilter, setAccountFilter] = useState<string>(ALL);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TransactionWithRelations | null>(null);

  // A busca do topbar navega para cá com ?q=, inclusive quando a página já
  // está montada — por isso o estado local acompanha o parâmetro.
  useEffect(() => {
    if (q !== undefined) setSearch(q);
  }, [q]);

  const range = useMemo(() => monthRange(month), [month]);
  const transactions = useQuery(transactionsQueryOptions(range));
  const accounts = useQuery(accountsQueryOptions());
  const categories = useQuery(categoriesQueryOptions());

  const deleteTransaction = useDeleteTransaction();

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (transactions.data ?? []).filter((transaction) => {
      if (typeFilter !== ALL && transaction.type !== typeFilter) return false;

      if (
        accountFilter !== ALL &&
        transaction.account_id !== accountFilter &&
        transaction.to_account_id !== accountFilter
      ) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        transaction.description,
        transaction.category?.name,
        transaction.account?.name,
        transaction.to_account?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [transactions.data, search, typeFilter, accountFilter]);

  const totals = useMemo(() => {
    let income = 0;
    let credit = 0;
    let debit = 0;

    for (const transaction of visible) {
      const amount = Number(transaction.amount);

      // Transferência não é gasto: move dinheiro entre contas suas. Pagar a
      // fatura entra aqui — contá-la dobraria a despesa que já foi registrada
      // na compra.
      if (transaction.type === "transfer") continue;

      if (transaction.type === "income") {
        income += amount;
        continue;
      }

      if (transaction.account?.type === "credit_card") {
        credit += amount;
      } else {
        debit += amount;
      }
    }

    return { income, credit, debit, spent: credit + debit };
  }, [visible]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (transaction: TransactionWithRelations) => {
    setEditing(transaction);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteTransaction.mutateAsync(pendingDelete.id);
      toast.success("Lançamento excluído.");
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  };

  const hasAccounts = (accounts.data ?? []).length > 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo o dinheiro que entrou e saiu no período.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav month={month} onChange={setMonth} />
          <Button className="rounded-full" onClick={openNew} disabled={!hasAccounts}>
            <Plus className="size-4" />
            Novo
          </Button>
        </div>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryPill label="Entradas" value={totals.income} tone="positive" />
        <SummaryPill
          label="Débito/Dinheiro"
          value={totals.debit}
          tone="negative"
          hint="Conta corrente, poupança e dinheiro"
        />
        <SummaryPill
          label="Cartão de crédito"
          value={totals.credit}
          tone="negative"
          hint="Compras na fatura"
        />
        <SummaryPill
          label="Total gasto"
          value={totals.spent}
          tone="negative"
          hint="Débito + crédito"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-full bg-card pl-9"
            placeholder="Buscar por descrição, categoria ou conta"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as TransactionType | typeof ALL)}
        >
          <SelectTrigger className="w-44 rounded-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            <SelectItem value="income">{TRANSACTION_TYPE_LABELS.income}</SelectItem>
            <SelectItem value="expense">{TRANSACTION_TYPE_LABELS.expense}</SelectItem>
            <SelectItem value="transfer">{TRANSACTION_TYPE_LABELS.transfer}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-44 rounded-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as contas</SelectItem>
            {(accounts.data ?? []).map((account) => (
              <SelectItem key={account.account_id} value={account.account_id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {transactions.isPending ? (
        <ListSkeleton rows={6} />
      ) : transactions.isError ? (
        <ErrorState error={transactions.error} />
      ) : !hasAccounts ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Crie uma conta primeiro"
          description="Todo lançamento precisa estar ligado a uma conta ou carteira."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nada por aqui"
          description={
            (transactions.data ?? []).length === 0
              ? "Nenhum lançamento neste mês. Registre o primeiro."
              : "Nenhum lançamento corresponde aos filtros aplicados."
          }
          action={
            <Button className="rounded-full" onClick={openNew}>
              <Plus className="size-4" />
              Novo lançamento
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-2 py-3 font-medium">Descrição</th>
                  <th className="px-2 py-3 font-medium">Categoria</th>
                  <th className="px-2 py-3 font-medium">Conta</th>
                  <th className="px-2 py-3 text-right font-medium">Valor</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onEdit={openEdit}
                    onDelete={setPendingDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            {visible.length} lançamento(s) no período
          </p>
        </div>
      )}

      {dialogOpen ? (
        <TransactionDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={user.id}
          editing={editing}
          accounts={accounts.data ?? []}
          categories={categories.data ?? []}
        />
      ) : null}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O saldo da conta será recalculado. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryPill({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "negative";
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : value < 0
          ? "text-negative"
          : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`tabular mt-1 text-xl font-semibold ${toneClass}`}>{formatCurrency(value)}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TransactionRow({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: TransactionWithRelations;
  onEdit: (transaction: TransactionWithRelations) => void;
  onDelete: (transaction: TransactionWithRelations) => void;
}) {
  const amount = Number(transaction.amount);
  const isTransfer = transaction.type === "transfer";
  const isIncome = transaction.type === "income";
  const color = isTransfer ? "#8A8A8A" : (transaction.category?.color ?? "#8A8A8A");

  const title =
    transaction.description ||
    (isTransfer ? "Transferência" : (transaction.category?.name ?? "Sem categoria"));

  return (
    <tr className="group transition-colors hover:bg-secondary/40">
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
          {transaction.installment_total ? (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {transaction.installment_number}/{transaction.installment_total}
            </span>
          ) : null}
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
        className={`tabular px-2 py-3 text-right font-semibold whitespace-nowrap ${
          isTransfer ? "text-muted-foreground" : isIncome ? "text-positive" : "text-negative"
        }`}
      >
        {isTransfer ? "" : isIncome ? "+" : "-"}
        {formatCurrency(amount)}
      </td>

      <td className="px-5 py-3">
        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Editar lançamento"
            onClick={() => onEdit(transaction)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label="Excluir lançamento"
            onClick={() => onDelete(transaction)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
