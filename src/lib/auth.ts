import { getSupabaseClient } from "./supabase";

// Login and sign-up go through Supabase Auth. public.user keeps the app's numeric user id, which the local database
// files volumes under, linked to the Supabase Auth account by auth_id (see supabase/auth_sync.sql).

export type LoggedUser = {
  id: number;
  name: string;
  email: string;
};

const CONFIRM_EMAIL = "Enviamos um link de confirmação para o seu email. Confirme e entre de novo.";

// The last user who logged in on this device, so the app opens already logged in. Their Supabase session is kept by
// the Supabase client itself (persistSession in supabase.ts); this only spares a network round trip, so the app also
// opens offline. Logging out forgets both.
const LAST_USER_KEY = "archivist.lastUser";

type RememberedUser = { user: LoggedUser; authId: string };

function rememberUser(user: LoggedUser, authId: string) {
  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify({ user, authId } satisfies RememberedUser));
  } catch {
    // Only a convenience: the next start asks for the login again.
  }
}

function forgetUser() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // Nothing to forget.
  }
}

function rememberedUser(): RememberedUser | null {
  try {
    const stored = localStorage.getItem(LAST_USER_KEY);
    const parsed = stored ? (JSON.parse(stored) as RememberedUser) : null;
    return parsed && typeof parsed.user?.id === "number" && typeof parsed.authId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

// At start: the user still logged in on this device, or null. A session that can't be refreshed for lack of network
// still counts, since the app works offline; one that's gone (logged out, or revoked) asks for the login again.
export async function restoreUser(): Promise<LoggedUser | null> {
  const remembered = rememberedUser();
  if (!remembered) return null;
  try {
    const { data, error } = await getSupabaseClient().auth.getSession();
    const session = data.session;
    if (session) {
      if (session.user.id !== remembered.authId) {
        forgetUser();
        return null;
      }
      return remembered.user;
    }
    if (error && isNetworkError(error)) return remembered.user;
  } catch (err) {
    if (isNetworkError(err)) return remembered.user;
  }
  forgetUser();
  return null;
}

function isNetworkError(err: unknown) {
  const name = err instanceof Error ? err.name : "";
  return name === "AuthRetryableFetchError" || (typeof navigator !== "undefined" && navigator.onLine === false);
}

async function loadProfile(authId: string): Promise<LoggedUser> {
  const { data, error } = await getSupabaseClient()
    .from("user")
    .select("id, name, email")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Conta não encontrada.");
  rememberUser(data, authId);
  return data;
}

export async function signIn(email: string, password: string): Promise<LoggedUser> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (data.session) return loadProfile(data.session.user.id);
  if (error?.code === "email_not_confirmed") throw new Error(CONFIRM_EMAIL);
  if (error?.code !== "invalid_credentials") throw error ?? new Error("Erro ao realizar login.");

  // Accounts made before Supabase Auth don't have an Auth account yet. Signing up with the same email and password
  // makes one and links it to the old account, but only if the password matches the old one (auth_sync.sql).
  const migrated = await supabase.auth.signUp({ email, password, options: { data: { migrate: true } } });
  if (migrated.data.session) return loadProfile(migrated.data.session.user.id);
  if (migrated.error?.code === "weak_password") {
    throw new Error("Não foi possível passar sua conta para o novo login: a senha tem menos de 6 caracteres.");
  }
  // Made, but the project asks for the email to be confirmed first. An empty identities list means the email
  // already had an Auth account, so the password was simply wrong.
  if (migrated.data.user?.identities?.length) throw new Error(CONFIRM_EMAIL);
  throw new Error("Credenciais inválidas.");
}

export type SignUpForm = { name: string; email: string; password: string; cellphone: string };

// Resolves to whether the account still needs its email confirmed before the first login.
export async function signUp({ name, email, password, cellphone }: SignUpForm): Promise<{ confirmEmail: boolean }> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: { data: { name, cellphone } },
  });
  if (error?.code === "weak_password") throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  // user_already_exists, or the trigger refusing an old account's email with a different password.
  if (error?.code === "user_already_exists" || error?.code === "unexpected_failure") {
    throw new Error("Este email já está cadastrado.");
  }
  if (error) throw error;
  if (data.user && !data.user.identities?.length) throw new Error("Este email já está cadastrado.");
  return { confirmEmail: !data.session };
}

export async function signOut() {
  forgetUser();
  try {
    await getSupabaseClient().auth.signOut({ scope: "local" });
  } catch (err) {
    console.warn("Não foi possível encerrar a sessão do Supabase.", err);
  }
}
