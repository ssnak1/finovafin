import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "../ui/skeleton";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-secondary">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Erro desconhecido";

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
      <h3 className="font-medium text-destructive">Não foi possível carregar</h3>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
