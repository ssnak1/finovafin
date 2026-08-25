import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Cliente do navegador. É criado sob demanda (e uma vez só) porque este módulo
 * também é carregado durante o SSR, onde `document` não existe.
 */
export function getSupabaseBrowserClient() {
  browserClient ??= createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  return browserClient;
}
