import { useState } from "react";
import { signIn, type LoggedUser } from "../lib/auth";
import "./CSS/Login.css";
import PasswordInput from "./PasswordInput.tsx";

type LoginProps = {
  onGoToCadastro: () => void;
  onBack: () => void;
  onLoginSuccess: (user: LoggedUser) => Promise<void>;
};

export default function Login({ onGoToCadastro, onBack, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Preencha email e senha.");
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const user = await signIn(email.trim(), password);

      setSuccess(`Login realizado com sucesso, ${user.name}!`);
      setEmail("");
      setPassword("");
      await onLoginSuccess(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao realizar login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
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
              <h1 className="auth-page__heading">Login</h1>

              <div className="auth-page__fields">
                <div>
                  <label className="auth-page__label" htmlFor="login-email">
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    className="auth-page__input"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    autoComplete="email"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="next"
                  />
                </div>

                <div>
                  <label className="auth-page__label" htmlFor="login-password">
                    Senha
                  </label>
                  <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
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
                </p>
              )}

              <button type="submit" className="auth-page__submit" disabled={loading}>
                {loading ? "Entrando..." : "Login"}
              </button>
            </form>

            <div className="auth-page__switcher">
              Primeira vez?{' '}
              <button type="button" onClick={onGoToCadastro} className="auth-page__switcher-link">
                Cadastre-se
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
