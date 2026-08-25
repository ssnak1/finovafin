/**
 * Lê as credenciais do Supabase com erro explícito quando faltam ou quando
 * ainda são os valores de exemplo — a URL placeholder é sintaticamente válida,
 * então sem esta checagem o app só falharia depois, como um erro de rede.
 */
const PLACEHOLDERS = ["SEU-PROJETO", "sua-anon-key-aqui"];

function readEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(
      `${name} não está definida. Copie .env.example para .env e preencha com as ` +
        `credenciais do projeto (Supabase Dashboard > Project Settings > API).`,
    );
  }

  if (PLACEHOLDERS.some((placeholder) => value.includes(placeholder))) {
    throw new Error(
      `${name} ainda está com o valor de exemplo. Abra o .env e cole a credencial ` +
        `real do seu projeto (Supabase Dashboard > Project Settings > API).`,
    );
  }

  return value;
}

export const supabaseUrl = () => readEnv("VITE_SUPABASE_URL");
export const supabaseAnonKey = () => readEnv("VITE_SUPABASE_ANON_KEY");
