import { createClient } from "@supabase/supabase-js";

const runtimeEnv = typeof Bun !== "undefined" ? Bun.env : {};
const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const processEnv = typeof process !== "undefined" ? process.env ?? {} : {};
const windowEnv = typeof window !== "undefined" && (window as any).__ENV__ ? (window as any).__ENV__ : {};

const env = {
  ...processEnv,
  ...viteEnv,
  ...runtimeEnv,
  ...windowEnv,
};

export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL ?? "",
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
};

export function getSupabaseClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.",
    );
  }

  return createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
