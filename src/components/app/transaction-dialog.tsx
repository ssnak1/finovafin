import { useState } from "react";
import { toast } from "sonner";

import { CurrencyInput } from "./currency-input";
import { splitInstallments } from "../../lib/credit-card";
import {
  formatCurrency,
  parseCurrencyInput,
  toCurrencyInputValue,
  todayISO,
} from "../../lib/format";
import {
  TRANSACTION_TYPE_LABELS,
  useCreateTransaction,
  useUpdateTransaction,
} from "../../lib/queries/transactions";
import type {
  AccountBalance,
  Category,
  TransactionType,
  TransactionWithRelations,
} from "../../lib/supabase/types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

// Radix Select não aceita string vazia como valor, então "sem categoria"
// precisa de um valor próprio que nunca é enviado ao banco.
const NO_CATEGORY = "__none__";

const TYPES: TransactionType[] = ["expense", "income", "transfer"];

type Draft = {
  type: TransactionType;
  amount: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  description: string;
  occurredOn: string;
  installments: string;
};

function draftFrom(
  transaction: TransactionWithRelations | null,
  accounts: AccountBalance[],
): Draft {
  if (transaction) {
    return {
      type: transaction.type,
      amount: toCurrencyInputValue(transaction.amount),
      accountId: transaction.account_id,
      toAccountId: transaction.to_account_id ?? "",
      categoryId: transaction.category_id ?? NO_CATEGORY,
      description: transaction.description ?? "",
      occurredOn: transaction.occurred_on,
      // Editar uma parcela mexe só nela: repetir o parcelamento aqui criaria
      // uma nova série inteira.
      installments: "1",
    };
  }

  return {
    type: "expense",
    amount: "",
    accountId: accounts[0]?.account_id ?? "",
    toAccountId: "",
    categoryId: NO_CATEGORY,
    description: "",
    occurredOn: todayISO(),
    installments: "1",
  };
}

type TransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  editing: TransactionWithRelations | null;
  accounts: AccountBalance[];
  categories: Category[];
};

export function TransactionDialog({
  open,
  onOpenChange,
  userId,
  editing,
  accounts,
  categories,
}: TransactionDialogProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing, accounts));

  const createTransaction = useCreateTransaction(userId);
  const updateTransaction = useUpdateTransaction();

  const isTransfer = draft.type === "transfer";
  const relevantCategories = categories.filter((category) =>
    draft.type === "income" ? category.kind === "income" : category.kind === "expense",
  );

  // Conta e cartão aparecem em grupos separados: um é de onde o dinheiro sai,
  // o outro é forma de pagamento que gera fatura.
  const bankAccounts = accounts.filter((account) => account.type !== "credit_card");
  const creditCards = accounts.filter((account) => account.type === "credit_card");

  const selectedAccount = accounts.find((account) => account.account_id === draft.accountId);
  // Parcelar só faz sentido para compra no cartão, e apenas ao criar: editar
  // uma parcela existente não deve gerar uma série nova.
  const canInstall =
    !editing && draft.type === "expense" && selectedAccount?.type === "credit_card";

  const installmentCount = Number(draft.installments) || 1;
  const parsedAmount = parseCurrencyInput(draft.amount);
  const installmentPreview =
    canInstall && installmentCount > 1 && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? splitInstallments(parsedAmount, installmentCount)
      : null;

  const handleSubmit = async () => {
    const amount = parseCurrencyInput(draft.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (!draft.accountId) {
      toast.error("Escolha a conta.");
      return;
    }

    if (isTransfer) {
      if (!draft.toAccountId) {
        toast.error("Escolha a conta de destino.");
        return;
      }
      if (draft.toAccountId === draft.accountId) {
        toast.error("A conta de destino precisa ser diferente da origem.");
        return;
      }
    }

    const payload = {
      type: draft.type,
      amount,
      accountId: draft.accountId,
      toAccountId: isTransfer ? draft.toAccountId : null,
      categoryId: !isTransfer && draft.categoryId !== NO_CATEGORY ? draft.categoryId : null,
      description: draft.description,
      occurredOn: draft.occurredOn,
      installments: canInstall ? installmentCount : 1,
    };

    try {
      if (editing) {
        await updateTransaction.mutateAsync({ id: editing.id, ...payload });
        toast.success("Lançamento atualizado.");
      } else {
        await createTransaction.mutateAsync(payload);
        toast.success(
          `${TRANSACTION_TYPE_LABELS[draft.type]} de ${formatCurrency(amount)} registrada.`,
        );
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            Transferências movem dinheiro entre suas contas e não contam como receita nem despesa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDraft({ ...draft, type })}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  draft.type === type
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {TRANSACTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction-amount">Valor</Label>
              <CurrencyInput
                id="transaction-amount"
                value={draft.amount}
                onChange={(value) => setDraft({ ...draft, amount: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-date">Data</Label>
              <Input
                id="transaction-date"
                type="date"
                value={draft.occurredOn}
                onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-account">
              {isTransfer ? "Conta de origem" : "Pago com"}
            </Label>
            <Select
              value={draft.accountId}
              onValueChange={(value) => setDraft({ ...draft, accountId: value })}
            >
              <SelectTrigger id="transaction-account">
                <SelectValue placeholder="Escolha onde foi pago" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Contas</SelectLabel>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}

                {creditCards.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Cartões de crédito</SelectLabel>
                    {creditCards.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
          </div>

          {isTransfer ? (
            <div className="space-y-2">
              <Label htmlFor="transaction-to-account">Conta de destino</Label>
              <Select
                value={draft.toAccountId}
                onValueChange={(value) => setDraft({ ...draft, toAccountId: value })}
              >
                <SelectTrigger id="transaction-to-account">
                  <SelectValue placeholder="Para onde vai o dinheiro" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((account) => account.account_id !== draft.accountId)
                    .map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="transaction-category">Categoria</Label>
              <Select
                value={draft.categoryId}
                onValueChange={(value) => setDraft({ ...draft, categoryId: value })}
              >
                <SelectTrigger id="transaction-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                  {relevantCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {canInstall ? (
            <div className="space-y-2">
              <Label htmlFor="transaction-installments">Parcelas</Label>
              <Select
                value={draft.installments}
                onValueChange={(value) => setDraft({ ...draft, installments: value })}
              >
                <SelectTrigger id="transaction-installments">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">À vista</SelectItem>
                  {Array.from({ length: 23 }, (_, index) => index + 2).map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {installmentPreview ? (
                <p className="text-xs text-muted-foreground">
                  {installmentCount}x de {formatCurrency(installmentPreview[1] ?? 0)}
                  {installmentPreview[0] !== installmentPreview[1]
                    ? ` (primeira de ${formatCurrency(installmentPreview[0] ?? 0)})`
                    : ""}{" "}
                  · uma parcela por fatura
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="transaction-description">Descrição (opcional)</Label>
            <Textarea
              id="transaction-description"
              rows={2}
              placeholder="Almoço com a equipe, conta de luz..."
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createTransaction.isPending || updateTransaction.isPending}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
