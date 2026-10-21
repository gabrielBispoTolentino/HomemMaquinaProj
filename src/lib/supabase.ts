import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: {
      user: {
        Row: { id: number; name: string; email: string; password: string };
        Insert: { id?: number; name: string; email: string; password: string };
        Update: Partial<{ name: string; email: string; password: string }>;
        Relationships: [];
      };
      worlds: {
        Row: {
          id: string;
          user_id: number;
          name: string;
          description: string | null;
          accent_color: string | null;
          icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: number;
          name: string;
          description?: string | null;
          accent_color?: string | null;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["worlds"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// `bun run build:mobile` inlines these as literals, since the mobile WebView has no preload to set window.__ENV__.
// In other browser builds `process` is undefined and this throws.
function readInlinedEnv(): Record<string, string | undefined> {
  try {
    return {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    };
  } catch {
    return {};
  }
}

const inlinedEnv = readInlinedEnv();
const runtimeEnv = typeof Bun !== "undefined" ? Bun.env : {};
const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const processEnv = typeof process !== "undefined" ? process.env ?? {} : {};
const windowEnv = typeof window !== "undefined" && (window as any).__ENV__ ? (window as any).__ENV__ : {};

const env = {
  ...inlinedEnv,
  ...processEnv,
  ...viteEnv,
  ...runtimeEnv,
  ...windowEnv,
};

export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL ?? "",
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
};

let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.",
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}
