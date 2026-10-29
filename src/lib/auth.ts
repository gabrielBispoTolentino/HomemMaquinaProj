import { getSupabaseClient } from "./supabase";

// Login and sign-up go through Supabase Auth. public.user keeps the app's numeric user id, which the local database
// files volumes under, linked to the Supabase Auth account by auth_id (see supabase/auth_sync.sql).

export type LoggedUser = {
  id: number;
  name: string;
  email: string;
};

const CONFIRM_EMAIL = "Enviamos um link de confirmação para o seu email. Confirme e entre de novo.";

async function loadProfile(authId: string): Promise<LoggedUser> {
  const { data, error } = await getSupabaseClient()
    .from("user")
    .select("id, name, email")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Conta não encontrada.");
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
  try {
    await getSupabaseClient().auth.signOut({ scope: "local" });
  } catch (err) {
    console.warn("Não foi possível encerrar a sessão do Supabase.", err);
  }
}
