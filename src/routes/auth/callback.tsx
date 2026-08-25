import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseServerClient } from "../../lib/supabase/server";

/**
 * Troca o `code` do link de email por uma sessão. Roda no servidor porque é lá
 * que os cookies de sessão são gravados.
 */
const exchangeCodeForSession = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ error: string | null }> => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(data.code);
    return { error: error?.message ?? null };
  });

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    error_description:
      typeof search["error_description"] === "string" ? search["error_description"] : undefined,
  }),
  beforeLoad: async ({ search }) => {
    // O Supabase devolve o erro na própria URL quando o link expirou ou já foi
    // usado — nesse caso não há code nenhum para trocar.
    if (search.error_description || !search.code) {
      throw redirect({ to: "/login" });
    }

    const { error } = await exchangeCodeForSession({ data: { code: search.code } });

    if (error) {
      throw redirect({ to: "/login" });
    }

    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
