import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: {
      // Rows are created by a trigger when Supabase Auth makes an account, and each user can only read their own
      // (see supabase/auth_sync.sql).
      user: {
        Row: { id: number; name: string; email: string; cellphone: string | null; auth_id: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // The cloud copy of synced users' local databases (sync.ts).
      sync_rows: {
        Row: {
          user_id: number;
          tbl: string;
          row_id: string;
          data: Record<string, unknown> | null;
          changed_at: string;
          rev: number;
        };
        Insert: {
          user_id: number;
          tbl: string;
          row_id: string;
          data: Record<string, unknown> | null;
          changed_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_rows"]["Insert"]>;
        Relationships: [];
      };
      // worlds, notes and categories now live in the local database (db.ts); these
      // tables are only read once per user, to copy old data over (supabaseImport.ts).
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
      notes: {
        Row: {
          id: string;
          world_id: string;
          title: string;
          content: string;
          category_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          world_id: string;
          title?: string;
          content?: string;
          category_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          world_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          world_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
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
      // The session lasts while the app is open; sync keeps using it, so it has to be refreshed.
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}
