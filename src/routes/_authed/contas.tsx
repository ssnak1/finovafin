import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BankLogo } from "../../components/app/bank-logo";
import { ColorPicker } from "../../components/app/color-picker";
import { CurrencyInput } from "../../components/app/currency-input";
import { PageHeader } from "../../components/app/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "../../components/app/states";
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
import { Checkbox } from "../../components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { BANKS } from "../../lib/banks";
import { summarizeBalances } from "../../lib/balances";
import { availableLimit, DEFAULT_CLOSING_DAY, DEFAULT_DUE_DAY } from "../../lib/credit-card";
import { formatCurrency, parseCurrencyInput, toCurrencyInputValue } from "../../lib/format";
import {
  ACCOUNT_TYPE_LABELS,
  accountsQueryOptions,
  BANK_ACCOUNT_TYPES,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from "../../lib/queries/accounts";
import { CATEGORY_PALETTE } from "../../lib/queries/categories";
import type { AccountBalance, AccountType } from "../../lib/supabase/types";

export const Route = createFileRoute("/_authed/contas")({
  head: () => ({ meta: [{ title: "Contas — Finova" }] }),
  component: AccountsPage,
});

type DraftAccount = {
  id?: string;
  name: string;
  type: AccountType;
  initialBalance: string;
  color: string;
  institution: string;
  /** Servem ao próprio registro quando ele é cartão, ou ao cartão companheiro. */
  creditLimit: string;
  closingDay: string;
  dueDay: string;
  /** Conta que paga a fatura (apenas quando o registro é um cartão). */
  linkedAccountId: string;
  /** Criar também um cartão junto com esta conta. */
  withCard: boolean;
  cardName: string;
};

// Radix Select não aceita string vazia como valor, então "nenhum" precisa de
// um valor próprio que nunca chega ao banco.
const NO_BANK = "__none__";
const NO_LINK = "__none__";

const EMPTY_DRAFT: DraftAccount = {
  name: "",
  type: "checking",
  initialBalance: "0,00",
  color: CATEGORY_PALETTE[0],
  institution: NO_BANK,
  creditLimit: "",
  closingDay: String(DEFAULT_CLOSING_DAY),
  dueDay: String(DEFAULT_DUE_DAY),
  linkedAccountId: NO_LINK,
  withCard: false,
  cardName: "",
};

function AccountsPage() {
  const { user } = Route.useRouteContext();
  const accounts = useQuery(accountsQueryOptions());

  const [draft, setDraft] = useState<DraftAccount | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountBalance | null>(null);

  const createAccount = useCreateAccount(user.id);
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const summary = summarizeBalances(accounts.data ?? []);

  // Cartões aparecem dentro da conta que paga a fatura. Cartão sem vínculo (ou
  // apontando para conta apagada) vira card próprio, para não sumir da tela.
  const { payableAccounts, cardsByParent, unlinkedCards } = useMemo(() => {
    const all = accounts.data ?? [];
    const payable = all.filter((account) => account.type !== "credit_card");
    const payableIds = new Set(payable.map((account) => account.account_id));

    const byParent = new Map<string, AccountBalance[]>();
    const unlinked: AccountBalance[] = [];

    for (const card of all.filter((account) => account.type === "credit_card")) {
      const parent = card.linked_account_id;

      if (parent && payableIds.has(parent)) {
        byParent.set(parent, [...(byParent.get(parent) ?? []), card]);
      } else {
        unlinked.push(card);
      }
    }

    return { payableAccounts: payable, cardsByParent: byParent, unlinkedCards: unlinked };
  }, [accounts.data]);

  const openEdit = (account: AccountBalance) =>
    setDraft({
      id: account.account_id,
      name: account.name,
      type: account.type,
      initialBalance: toCurrencyInputValue(account.initial_balance),
      color: account.color,
      institution: account.institution ?? NO_BANK,
      creditLimit: toCurrencyInputValue(account.credit_limit),
      closingDay: String(account.closing_day ?? DEFAULT_CLOSING_DAY),
      dueDay: String(account.due_day ?? DEFAULT_DUE_DAY),
      linkedAccountId: account.linked_account_id ?? NO_LINK,
      withCard: false,
      cardName: "",
    });

  const handleSubmit = async () => {
    if (!draft) return;

    const name = draft.name.trim();
    const initialBalance = parseCurrencyInput(draft.initialBalance || "0");

    if (!name) {
      toast.error("Dê um nome para a conta.");
      return;
    }

    if (Number.isNaN(initialBalance)) {
      toast.error("Saldo inicial inválido.");
      return;
    }

    const isCard = draft.type === "credit_card";
    const creditLimit = parseCurrencyInput(draft.creditLimit || "0");

    if (isCard && draft.creditLimit && Number.isNaN(creditLimit)) {
      toast.error("Limite inválido.");
      return;
    }

    const payload = {
      name,
      type: draft.type,
      initialBalance,
      color: draft.color,
      institution: draft.institution === NO_BANK ? null : draft.institution,
      // Fechamento e vencimento só existem para cartão; nas demais contas os
      // campos ficam nulos para não sujar o registro.
      creditLimit: isCard && draft.creditLimit ? creditLimit : null,
      closingDay: isCard ? Number(draft.closingDay) || DEFAULT_CLOSING_DAY : null,
      dueDay: isCard ? Number(draft.dueDay) || DEFAULT_DUE_DAY : null,
      linkedAccountId: isCard && draft.linkedAccountId !== NO_LINK ? draft.linkedAccountId : null,
    };

    // Cartão companheiro: só ao criar uma conta que não é cartão.
    const companionCard =
      !draft.id && !isCard && draft.withCard
        ? {
            name: draft.cardName.trim() || `${name} · Cartão`,
            creditLimit: draft.creditLimit ? creditLimit : null,
            closingDay: Number(draft.closingDay) || DEFAULT_CLOSING_DAY,
            dueDay: Number(draft.dueDay) || DEFAULT_DUE_DAY,
          }
        : null;

    try {
      if (draft.id) {
        await updateAccount.mutateAsync({ id: draft.id, ...payload });
        toast.success("Conta atualizada.");
      } else {
        await createAccount.mutateAsync({ ...payload, card: companionCard });
        toast.success(companionCard ? "Conta e cartão criados." : "Conta criada.");
      }
      setDraft(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteAccount.mutateAsync(pendingDelete.account_id);
      toast.success("Conta excluída.");
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  };

  return (
    <>
      <PageHeader
        title="Contas"
        description={
          accounts.data
            ? `${summary.accountCount} conta${summary.accountCount === 1 ? "" : "s"} · ${formatCurrency(summary.cash)} em saldo`
            : "Bancos, cartões e carteiras."
        }
        actions={
          <Button className="rounded-full" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="size-4" />
            Nova conta
          </Button>
        }
      />

      {accounts.isPending ? (
        <ListSkeleton />
      ) : accounts.isError ? (
        <ErrorState error={accounts.error} />
      ) : accounts.data.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma conta cadastrada"
          description="Crie uma conta para começar a registrar entradas e saídas."
          action={
            <Button className="rounded-full" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus className="size-4" />
              Nova conta
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {payableAccounts.map((account) => (
            <AccountCard
              key={account.account_id}
              account={account}
              cards={cardsByParent.get(account.account_id) ?? []}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      {unlinkedCards.length > 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {unlinkedCards.length} cartão(ões) sem conta vinculada.{" "}
          <Link to="/cartoes" className="text-primary hover:underline">
            Vincular em Cartões
          </Link>
        </p>
      ) : null}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar conta" : "Nova conta"}</DialogTitle>
            <DialogDescription>
              O saldo inicial é o quanto havia na conta antes do primeiro lançamento.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nome</Label>
                <Input
                  id="account-name"
                  value={draft.name}
                  placeholder="Nubank, Itaú, Carteira..."
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-institution">Instituição</Label>
                <Select
                  value={draft.institution}
                  onValueChange={(value) => {
                    const bank = BANKS.find((item) => item.slug === value);
                    setDraft({
                      ...draft,
                      institution: value,
                      // Ao escolher o banco, adota a cor da marca e sugere o
                      // nome — mas nunca sobrescreve um nome já digitado.
                      color: bank?.color ?? draft.color,
                      name: draft.name.trim() ? draft.name : (bank?.name ?? draft.name),
                    });
                  }}
                >
                  <SelectTrigger id="account-institution">
                    <SelectValue placeholder="Escolha o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BANK}>Nenhuma / outro</SelectItem>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank.slug} value={bank.slug}>
                        <span className="flex items-center gap-2">
                          <img src={bank.logo} alt="" className="size-4 shrink-0 object-contain" />
                          {bank.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type">Tipo</Label>
                <Select
                  value={draft.type}
                  onValueChange={(value) => setDraft({ ...draft, type: value as AccountType })}
                >
                  <SelectTrigger id="account-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ACCOUNT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-balance">Saldo inicial</Label>
                <CurrencyInput
                  id="account-balance"
                  value={draft.initialBalance}
                  allowNegative
                  onChange={(value) => setDraft({ ...draft, initialBalance: value })}
                />
                <p className="text-xs text-muted-foreground">
                  Quanto havia na conta antes do primeiro lançamento.
                </p>
              </div>

              {/* O cartão é do mesmo banco: criar junto evita redigitar tudo.
                  Ele não vira outra conta — vive na tela de Cartões. */}
              {!draft.id ? (
                <div className="rounded-xl border border-border p-4">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={draft.withCard}
                      onCheckedChange={(checked) =>
                        setDraft({ ...draft, withCard: checked === true })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        Este banco também tem cartão de crédito
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Cria o cartão junto, já vinculado a esta conta.
                      </span>
                    </span>
                  </label>

                  {draft.withCard ? (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="card-name">Nome do cartão</Label>
                        <Input
                          id="card-name"
                          value={draft.cardName}
                          placeholder={`${draft.name.trim() || "Conta"} · Cartão`}
                          onChange={(event) => setDraft({ ...draft, cardName: event.target.value })}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="card-limit">Limite</Label>
                          <CurrencyInput
                            id="card-limit"
                            placeholder="5.000,00"
                            value={draft.creditLimit}
                            onChange={(value) => setDraft({ ...draft, creditLimit: value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="card-closing">Fecha dia</Label>
                          <Input
                            id="card-closing"
                            type="number"
                            min={1}
                            max={31}
                            value={draft.closingDay}
                            onChange={(event) =>
                              setDraft({ ...draft, closingDay: event.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="card-due">Vence dia</Label>
                          <Input
                            id="card-due"
                            type="number"
                            min={1}
                            max={31}
                            value={draft.dueDay}
                            onChange={(event) => setDraft({ ...draft, dueDay: event.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <ColorPicker
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createAccount.isPending || updateAccount.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos ligados a esta conta também serão apagados. Não dá para desfazer.
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

/**
 * Card de uma conta. Quando existem cartões vinculados, eles aparecem na mesma
 * caixa — é o que deixa claro que conta e cartão são do mesmo banco, sem fundir
 * saldo (ativo) com fatura (passivo) num número só.
 */
function AccountCard({
  account,
  cards,
  onEdit,
  onDelete,
}: {
  account: AccountBalance;
  cards: AccountBalance[];
  onEdit: (account: AccountBalance) => void;
  onDelete: (account: AccountBalance) => void;
}) {
  // `posted_balance` para bater com o dashboard: o saldo mostrado é o de hoje,
  // sem lançamentos que ainda não aconteceram.
  const balance = Number(account.posted_balance);

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BankLogo
            institution={account.institution}
            name={account.name}
            color={account.color}
            size="lg"
          />
          <div className="min-w-0">
            <h2 className="truncate font-medium">{account.name}</h2>
            <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Editar ${account.name}`}
            onClick={() => onEdit(account)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Excluir ${account.name}`}
            onClick={() => onDelete(account)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">Saldo atual</span>
        <p className={`tabular text-3xl font-semibold ${balance < 0 ? "text-negative" : ""}`}>
          {formatCurrency(balance)}
        </p>
      </div>

      {cards.length > 0 ? (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <span className="text-xs tracking-widest text-muted-foreground uppercase">
            Cartão neste banco
          </span>

          {cards.map((card) => {
            // Fatura que vence agora (posted). O limite disponível abaixo usa o
            // total comprometido — são perguntas diferentes.
            const cardDebt = Math.abs(Math.min(0, Number(card.posted_balance)));
            const available = availableLimit(card);

            return (
              <Link
                key={card.account_id}
                to="/cartoes"
                className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2.5 transition-colors hover:bg-secondary"
              >
                <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{card.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {available === null
                      ? "Limite não definido"
                      : `${formatCurrency(available)} disponível`}
                  </span>
                </span>
                <span
                  className={`tabular shrink-0 text-sm font-semibold ${
                    cardDebt > 0 ? "text-negative" : "text-muted-foreground"
                  }`}
                >
                  {formatCurrency(cardDebt)}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
