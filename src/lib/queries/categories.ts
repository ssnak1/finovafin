import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { getSupabaseBrowserClient } from "../supabase/client";
import type { Category, CategoryKind } from "../supabase/types";

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: "Receita",
  expense: "Despesa",
};

// `as const` para que CATEGORY_PALETTE[0] tenha tipo definido sob
// noUncheckedIndexedAccess — é usado como cor padrão dos formulários.
export const CATEGORY_PALETTE = [
  "#8B7355",
  "#4C9A6A",
  "#C4703D",
  "#5B7C99",
  "#B8556B",
  "#7A6BA8",
  "#D19A3C",
  "#A8746B",
  "#3E7F58",
  "#8A8A8A",
] as const;

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("kind")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });

export type CategoryInput = {
  name: string;
  kind: CategoryKind;
  color: string;
};

function useCategoryInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };
}

export function useCreateCategory(userId: string) {
  const invalidate = useCategoryInvalidation();

  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("categories").insert({
        user_id: userId,
        name: input.name,
        kind: input.kind,
        color: input.color,
      });

      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useCategoryInvalidation();

  return useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("categories")
        .update({ name: input.name, kind: input.kind, color: input.color })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useCategoryInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
