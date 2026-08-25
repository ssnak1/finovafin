import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import { getSupabaseServerClient } from "./supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
};

const credentials = z.object({
  email: z.string().trim().email("Informe um email válido"),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

const signUpInput = credentials.extend({
  fullName: z.string().trim().min(2, "Informe seu nome").max(80),
});

/** Mensagens do Supabase vêm em inglês; as comuns viram português aqui. */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Email ou senha incorretos.",
    "Email not confirmed": "Confirme seu email antes de entrar.",
    "User already registered": "Já existe uma conta com esse email.",
    "Password should be at least 6 characters.": "A senha precisa ter pelo menos 6 caracteres.",
    "Signup requires a valid password": "Informe uma senha válida.",
  };

  return map[message] ?? message;
}

/**
 * Usuário da requisição atual, ou null. Usa `getUser()` (não `getSession()`)
 * porque só ele valida o token contra o servidor do Supabase — a sessão do
 * cookie sozinha é forjável.
 */
export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) return null;

    const fullName = data.user.user_metadata["full_name"];

    return {
      id: data.user.id,
      email: data.user.email ?? "",
      fullName: typeof fullName === "string" ? fullName : null,
    };
  },
);

export const signInWithPassword = createServerFn({ method: "POST" })
  .validator(credentials)
  .handler(async ({ data }): Promise<{ error: string | null }> => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    return { error: error ? translateAuthError(error.message) : null };
  });

export const signUpWithPassword = createServerFn({ method: "POST" })
  .validator(signUpInput)
  .handler(async ({ data }): Promise<{ error: string | null; needsEmailConfirmation: boolean }> => {
    const supabase = getSupabaseServerClient();

    // Deriva o destino do link de confirmação da própria requisição, para o
    // email apontar para o host/porta em uso — e não para a Site URL fixa.
    const emailRedirectTo = `${getRequestUrl().origin}/auth/callback`;

    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.fullName }, emailRedirectTo },
    });

    if (error) {
      return { error: translateAuthError(error.message), needsEmailConfirmation: false };
    }

    // Com "Confirm email" ligado no painel, o cadastro não abre sessão:
    // a pessoa precisa clicar no link do email antes de entrar.
    return { error: null, needsEmailConfirmation: result.session === null };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  return { ok: true };
});
