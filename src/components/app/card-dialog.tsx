import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { BANKS } from "../../lib/banks";
import { DEFAULT_CLOSING_DAY, DEFAULT_DUE_DAY } from "../../lib/credit-card";
import { parseCurrencyInput, toCurrencyInputValue } from "../../lib/format";
import { useCreateAccount, useDeleteAccount, useUpdateAccount } from "../../lib/queries/accounts";
import { CATEGORY_PALETTE } from "../../lib/queries/categories";
import type { AccountBalance } from "../../lib/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ColorPicker } from "./color-picker";
import { CurrencyInput } from "./currency-input";

const NO_BANK = "__none__";
const NO_LINK = "__none__";

type CardDraft = {
  name: string;
  institution: string;
  color: string;
  creditLimit: string;
  closingDay: string;
  dueDay: string;
  linkedAccountId: string;
  openingDebt: string;
};

function draftFrom(card: AccountBalance | null): CardDraft {
  if (!card) {
    return {
      name: "",
      institution: NO_BANK,
      color: CATEGORY_PALETTE[0],
      creditLimit: "",
      closingDay: String(DEFAULT_CLOSING_DAY),
      dueDay: String(DEFAULT_DUE_DAY),
      linkedAccountId: NO_LINK,
      openingDebt: "0,00",
    };
  }

  return {
    name: card.name,
    institution: card.institution ?? NO_BANK,
    color: card.color,
    creditLimit: toCurrencyInputValue(card.credit_limit),
    closingDay: String(card.closing_day ?? DEFAULT_CLOSING_DAY),
    dueDay: String(card.due_day ?? DEFAULT_DUE_DAY),
    linkedAccountId: card.linked_account_id ?? NO_LINK,
    // A dívida é guardada como saldo negativo; na tela ela aparece positiva.
    openingDebt: toCurrencyInputValue(Math.abs(Number(card.initial_balance))),
  };
}

type CardDialogProps = {
  /** null cria um cartão novo. */
  card: AccountBalance | null;
  onClose: () => void;
  userId: string;
  payableAccounts: AccountBalance[];
};

export function CardDialog({ card, onClose, userId, payableAccounts }: CardDialogProps) {
  const [draft, setDraft] = useState(() => draftFrom(card));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createAccount = useCreateAccount(userId);
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const handleSubmit = async () => {
    const name = draft.name.trim();

    if (!name) {
      toast.error("Dê um nome para o cartão.");
      return;
    }

    const debt = parseCurrencyInput(draft.openingDebt || "0");

    if (!Number.isFinite(debt)) {
      toast.error("Fatura em aberto inválida.");
      return;
    }

    const payload = {
      name,
      type: "credit_card" as const,
      // A dívida vive como saldo negativo: assim o cartão usa exatamente o
      // mesmo mecanismo de lançamentos e saldo que o resto do app.
      initialBalance: -Math.abs(debt),
      color: draft.color,
      institution: draft.institution === NO_BANK ? null : draft.institution,
      creditLimit: draft.creditLimit ? parseCurrencyInput(draft.creditLimit) : null,
      closingDay: Number(draft.closingDay) || DEFAULT_CLOSING_DAY,
      dueDay: Number(draft.dueDay) || DEFAULT_DUE_DAY,
      linkedAccountId: draft.linkedAccountId === NO_LINK ? null : draft.linkedAccountId,
    };

    try {
      if (card) {
        await updateAccount.mutateAsync({ id: card.account_id, ...payload });
        toast.success("Cartão atualizado.");
      } else {
        await createAccount.mutateAsync(payload);
        toast.success("Cartão criado.");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  const handleDelete = async () => {
    if (!card) return;

    try {
      await deleteAccount.mutateAsync(card.account_id);
      toast.success("Cartão excluído.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{card ? "Editar cartão" : "Novo cartão"}</DialogTitle>
            <DialogDescription>
              O cartão pertence a um banco e é pago por uma conta. Ele não guarda saldo — o que
              aparece é a fatura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-institution">Banco</Label>
              <Select
                value={draft.institution}
                onValueChange={(value) => {
                  const bank = BANKS.find((item) => item.slug === value);
                  setDraft({
                    ...draft,
                    institution: value,
                    color: bank?.color ?? draft.color,
                    // Sugere "Cartão Nubank" — sem sobrescrever nome já digitado.
                    name: draft.name.trim()
                      ? draft.name
                      : bank
                        ? `Cartão ${bank.name}`
                        : draft.name,
                  });
                }}
              >
                <SelectTrigger id="card-institution">
                  <SelectValue placeholder="Escolha o banco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BANK}>Nenhum / outro</SelectItem>
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
              <Label htmlFor="card-name">Nome do cartão</Label>
              <Input
                id="card-name"
                value={draft.name}
                placeholder="Cartão Nubank"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-linked">Conta que paga a fatura</Label>
              <Select
                value={draft.linkedAccountId}
                onValueChange={(value) => setDraft({ ...draft, linkedAccountId: value })}
              >
                <SelectTrigger id="card-linked">
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LINK}>Nenhuma</SelectItem>
                  {payableAccounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vem pré-selecionada na hora de pagar a fatura.
              </p>
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
                  onChange={(event) => setDraft({ ...draft, closingDay: event.target.value })}
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

            <div className="space-y-2">
              <Label htmlFor="card-debt">Fatura já em aberto</Label>
              <CurrencyInput
                id="card-debt"
                value={draft.openingDebt}
                onChange={(value) => setDraft({ ...draft, openingDebt: value })}
              />
              <p className="text-xs text-muted-foreground">
                Quanto você já devia neste cartão antes de começar a usar o app.
              </p>
            </div>

            <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          </div>

          <DialogFooter className="sm:justify-between">
            {card ? (
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Excluir
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createAccount.isPending || updateAccount.isPending}
              >
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {draft.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos e parcelas deste cartão também serão apagados. Não dá para
              desfazer.
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
