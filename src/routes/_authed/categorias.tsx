import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ColorPicker } from "../../components/app/color-picker";
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
import {
  CATEGORY_KIND_LABELS,
  CATEGORY_PALETTE,
  categoriesQueryOptions,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../../lib/queries/categories";
import type { Category, CategoryKind } from "../../lib/supabase/types";

export const Route = createFileRoute("/_authed/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Finova" }] }),
  component: CategoriesPage,
});

type DraftCategory = {
  id?: string;
  name: string;
  kind: CategoryKind;
  color: string;
};

function emptyDraft(kind: CategoryKind): DraftCategory {
  return { name: "", kind, color: CATEGORY_PALETTE[0] };
}

function CategoriesPage() {
  const { user } = Route.useRouteContext();
  const categories = useQuery(categoriesQueryOptions());

  const [draft, setDraft] = useState<DraftCategory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const createCategory = useCreateCategory(user.id);
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const grouped = useMemo(() => {
    const list = categories.data ?? [];
    return {
      income: list.filter((category) => category.kind === "income"),
      expense: list.filter((category) => category.kind === "expense"),
    };
  }, [categories.data]);

  const handleSubmit = async () => {
    if (!draft) return;

    const name = draft.name.trim();

    if (!name) {
      toast.error("Dê um nome para a categoria.");
      return;
    }

    const payload = { name, kind: draft.kind, color: draft.color };

    try {
      if (draft.id) {
        await updateCategory.mutateAsync({ id: draft.id, ...payload });
        toast.success("Categoria atualizada.");
      } else {
        await createCategory.mutateAsync(payload);
        toast.success("Categoria criada.");
      }
      setDraft(null);
    } catch (error) {
      toast.error(resolveMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteCategory.mutateAsync(pendingDelete.id);
      toast.success("Categoria excluída.");
      setPendingDelete(null);
    } catch (error) {
      toast.error(resolveMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Como seus gastos e ganhos são organizados."
        actions={
          <Button className="rounded-full" onClick={() => setDraft(emptyDraft("expense"))}>
            <Plus className="size-4" />
            Nova categoria
          </Button>
        }
      />

      {categories.isPending ? (
        <ListSkeleton />
      ) : categories.isError ? (
        <ErrorState error={categories.error} />
      ) : categories.data.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria"
          description="Normalmente elas são criadas junto com a conta. Crie a primeira manualmente."
          action={
            <Button className="rounded-full" onClick={() => setDraft(emptyDraft("expense"))}>
              <Plus className="size-4" />
              Nova categoria
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryGroup
            title="Receitas"
            items={grouped.income}
            onEdit={setDraft}
            onDelete={setPendingDelete}
          />
          <CategoryGroup
            title="Despesas"
            items={grouped.expense}
            onEdit={setDraft}
            onDelete={setPendingDelete}
          />
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>
              Categorias de receita e de despesa são listadas separadamente no lançamento.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Nome</Label>
                <Input
                  id="category-name"
                  value={draft.name}
                  placeholder="Mercado, Academia, Bônus..."
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-kind">Tipo</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(value) => setDraft({ ...draft, kind: value as CategoryKind })}
                >
                  <SelectTrigger id="category-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{CATEGORY_KIND_LABELS.expense}</SelectItem>
                    <SelectItem value="income">{CATEGORY_KIND_LABELS.income}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
              disabled={createCategory.isPending || updateCategory.isPending}
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
              Os lançamentos continuam existindo, mas ficam sem categoria.
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

function CategoryGroup({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  items: Category[];
  onEdit: (draft: DraftCategory) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma categoria aqui ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((category) => (
            <li key={category.id} className="flex items-center gap-3 py-2.5">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>

              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Editar ${category.name}`}
                onClick={() =>
                  onEdit({
                    id: category.id,
                    name: category.name,
                    kind: category.kind,
                    color: category.color,
                  })
                }
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Excluir ${category.name}`}
                onClick={() => onDelete(category)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function resolveMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Algo deu errado.";

  // A unique (user_id, name, kind) barra categorias repetidas.
  if (error.message.includes("duplicate key")) {
    return "Já existe uma categoria com esse nome e tipo.";
  }

  return error.message;
}
