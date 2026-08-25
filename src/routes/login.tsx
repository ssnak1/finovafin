import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Wordmark } from "../components/app/logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { signInWithPassword, signUpWithPassword } from "../lib/auth";
import { currentUserQueryOptions } from "../lib/queries/user";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — Finova" }],
  }),
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions());
    if (user) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Informe um email válido"),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Informe seu nome"),
});

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

function LoginPage() {
  return (
    <div className="grid min-h-screen font-sans lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-border bg-card p-12 lg:flex">
        <Link to="/">
          <Wordmark />
        </Link>

        <div>
          <h1 className="text-5xl leading-[1.1] font-semibold tracking-tight">
            Sua riqueza, <br />
            <span className="text-primary">sob controle.</span>
          </h1>
          <p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">
            Registre receitas e despesas, acompanhe o saldo de cada conta e entenda para onde seu
            dinheiro está indo.
          </p>
        </div>

        <span className="text-xs text-muted-foreground">© 2026 Finova</span>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 block lg:hidden">
            <Wordmark />
          </Link>

          <Tabs defaultValue="entrar">
            <TabsList className="mb-8 grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <SignInForm />
            </TabsContent>

            <TabsContent value="criar">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

/** Após entrar, o cache precisa esquecer o estado deslogado antes de navegar. */
function useEnterApp() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries();
    await router.invalidate();
    await router.navigate({ to: "/dashboard" });
  };
}

function SignInForm() {
  const enterApp = useEnterApp();
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signInWithPassword({ data: values });

    if (error) {
      toast.error(error);
      return;
    }

    await enterApp();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre para continuar acompanhando suas finanças.
        </p>
      </div>

      <Field
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="voce@email.com"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />

      <Field
        label="Senha"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />

      <SubmitButton pending={form.formState.isSubmitting}>Entrar</SubmitButton>
    </form>
  );
}

function SignUpForm() {
  const enterApp = useEnterApp();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error, needsEmailConfirmation } = await signUpWithPassword({ data: values });

    if (error) {
      toast.error(error);
      return;
    }

    if (needsEmailConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }

    await enterApp();
  });

  if (awaitingConfirmation) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold tracking-tight">Confirme seu email</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enviamos um link para <strong>{form.getValues("email")}</strong>. Clique nele para ativar
          a conta e depois volte aqui para entrar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Criar sua conta</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Leva menos de um minuto. Já deixamos suas categorias prontas.
        </p>
      </div>

      <Field
        label="Nome"
        autoComplete="name"
        placeholder="Como podemos te chamar?"
        error={form.formState.errors.fullName?.message}
        {...form.register("fullName")}
      />

      <Field
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="voce@email.com"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />

      <Field
        label="Senha"
        type="password"
        autoComplete="new-password"
        placeholder="Pelo menos 8 caracteres"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />

      <SubmitButton pending={form.formState.isSubmitting}>Criar conta</SubmitButton>
    </form>
  );
}

type FieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  // `| undefined` explícito por causa de exactOptionalPropertyTypes: os erros
  // do react-hook-form chegam como string | undefined.
  error?: string | undefined;
};

function Field({ label, error, ...inputProps }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputProps.name}>{label}</Label>
      <Input id={inputProps.name} aria-invalid={Boolean(error)} {...inputProps} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="w-full rounded-full" size="lg">
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
