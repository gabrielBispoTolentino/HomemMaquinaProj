import { useState } from "react";
import { signUp } from "../lib/auth";
import "./CSS/Cadastrar.css";
import PasswordInput from "./PasswordInput.tsx";

type CadastrarProps = {
  onBack: () => void;
  onGoToLogin: () => void;
};

// The same minimum Supabase Auth asks for (see auth.ts).
const MIN_PASSWORD = 6;

const emptyForm = {
  name: "",
  email: "",
  password: "",
  cellphone: "",
};

export default function Cadastrar({ onBack, onGoToLogin }: CadastrarProps) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Whether the new account can log in right away (no email confirmation pending), to offer the way there.
  const [canLogIn, setCanLogIn] = useState(false);

  const handleChange = (field: keyof typeof emptyForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Preencha nome, email e senha.");
      setSuccess("");
      return;
    }
    // Checked here too, so the rule shown under the field is enforced before anything is sent.
    if (form.password.length < MIN_PASSWORD) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const { confirmEmail } = await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        cellphone: form.cellphone.trim(),
      });

      setSuccess(
        confirmEmail
          ? "Cadastro realizado! Confirme pelo link que enviamos para o seu email e depois entre."
          : "Cadastro realizado com sucesso! Agora é só entrar.",
      );
      setCanLogIn(!confirmEmail);
      setForm(emptyForm);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar usuário.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page--cadastro">
      <div className="auth-page__wrapper">
        <section className="auth-page__section">
          <div className="auth-page__back">
            <button type="button" onClick={onBack} aria-label="Voltar" className="auth-page__arrow">
              ←
            </button>
          </div>

          <div className="auth-page__card-wrap">
            <div className="auth-page__title-wrap">
              <div className="auth-page__title">
                Bem-
                <br />
                vindo.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="auth-page__card">
              <h1 className="auth-page__heading">Cadastro</h1>

              <div className="auth-page__fields">
                <div>
                  <label className="auth-page__label" htmlFor="signup-name">
                    Nome
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    className="auth-page__input"
                    value={form.name}
                    onChange={event => handleChange("name", event.target.value)}
                    autoComplete="name"
                    enterKeyHint="next"
                  />
                </div>

                <div>
                  <label className="auth-page__label" htmlFor="signup-email">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    className="auth-page__input"
                    value={form.email}
                    onChange={event => handleChange("email", event.target.value)}
                    autoComplete="email"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="next"
                  />
                </div>

                <div>
                  <label className="auth-page__label" htmlFor="signup-password">
                    Senha
                  </label>
                  <PasswordInput
                    id="signup-password"
                    value={form.password}
                    onChange={value => handleChange("password", value)}
                    autoComplete="new-password"
                    describedBy="signup-password-hint"
                  />
                  <p
                    id="signup-password-hint"
                    className={`auth-page__hint${form.password.length >= MIN_PASSWORD ? " auth-page__hint--ok" : ""}`}
                  >
                    {form.password.length >= MIN_PASSWORD
                      ? "✓ Tamanho de senha válido."
                      : `Pelo menos ${MIN_PASSWORD} caracteres.`}
                  </p>
                </div>

                <div>
                  <label className="auth-page__label" htmlFor="signup-cellphone">
                    Celular <span className="auth-page__optional">(opcional)</span>
                  </label>
                  <input
                    id="signup-cellphone"
                    type="tel"
                    className="auth-page__input"
                    value={form.cellphone}
                    onChange={event => handleChange("cellphone", event.target.value)}
                    autoComplete="tel"
                    enterKeyHint="done"
                  />
                </div>
              </div>

              {error && (
                <p className="auth-page__message auth-page__message--error" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="auth-page__message auth-page__message--success" role="status">
                  {success}
                  {canLogIn && (
                    <>
                      {" "}
                      <button type="button" className="auth-page__switcher-link" onClick={onGoToLogin}>
                        Entrar agora
                      </button>
                    </>
                  )}
                </p>
              )}

              <button type="submit" className="auth-page__submit" disabled={loading}>
                {loading ? "Cadastrando..." : "Cadastrar"}
              </button>
            </form>

            <div className="auth-page__switcher">
              Já tem conta?{' '}
              <button type="button" onClick={onGoToLogin} className="auth-page__switcher-link">
                Login
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
