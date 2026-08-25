import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Tags,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { Logo, Wordmark } from "../components/app/logo";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { signOut } from "../lib/auth";
import { currentUserQueryOptions } from "../lib/queries/user";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions());

    if (!user) {
      throw redirect({ to: "/login" });
    }

    // Vira contexto para todas as rotas filhas — elas recebem o usuário já
    // resolvido, sem precisar consultar de novo.
    return { user };
  },
  component: AuthedLayout,
});

const NAV_ITEMS = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { to: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/categorias", label: "Categorias", icon: Tags },
] as const;

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    await router.invalidate();
    await router.navigate({ to: "/login" });
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = search.trim();
    if (!term) return;
    void router.navigate({ to: "/transacoes", search: { q: term } });
  };

  const initials = getInitials(user.fullName ?? user.email);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen">
        <SidebarContent user={user} onSignOut={handleSignOut} onNavigate={() => undefined} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <SidebarContent
                user={user}
                onSignOut={handleSignOut}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="lg:hidden">
            <Logo className="size-7" />
          </Link>

          <form onSubmit={submitSearch} className="relative ml-auto w-full max-w-xs lg:ml-0">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar lançamento..."
              className="h-9 rounded-full border-border bg-secondary pl-9 text-sm"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-secondary">
                  <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-sm font-medium">{user.fullName ?? "Você"}</span>
                    <span className="block text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  user,
  onSignOut,
  onNavigate,
}: {
  user: { fullName: string | null; email: string };
  onSignOut: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/dashboard" onClick={onNavigate} className="px-2 py-2">
        <Wordmark />
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-primary/12 data-[status=active]:text-primary"
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border pt-3">
        <p className="truncate px-3 text-xs text-muted-foreground">{user.fullName ?? user.email}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className="mt-1 w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/[\s@.]+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}
