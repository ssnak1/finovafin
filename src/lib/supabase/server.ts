import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Cliente de servidor, ligado aos cookies da requisição atual. É por aqui que a
 * sessão é lida e gravada — o navegador nunca escreve o token de auth sozinho.
 */
export function getSupabaseServerClient() {
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options);
        }
      },
    },
  });
}
