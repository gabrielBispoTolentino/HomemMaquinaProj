import { useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import "./CSS/Login.css";

type LoginProps = {
  onGoToCadastro: () => void;
  onBack: () => void;
};

export default function Login({ onGoToCadastro, onBack }: LoginProps) {
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

      const supabase = getSupabaseClient();
      const { data, error: selectError } = await supabase
        .from("user")
        .select("id, name, email")
        .eq("email", email.trim())
        .eq("password", password)
        .maybeSingle();

      if (selectError) {
        throw selectError;
      }

      if (!data) {
        throw new Error("Credenciais inválidas.");
      }

      setSuccess(`Login realizado com sucesso, ${data.name}!`);
      setEmail("");
      setPassword("");
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
                Bem
                <br />
                vindo.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="auth-page__card">
              <h1 className="auth-page__heading">Login</h1>

              <div className="auth-page__fields">
                <div>
                  <label className="auth-page__label">Email</label>
                  <input
                    type="email"
                    className="auth-page__input"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                  />
                </div>

                <div>
                  <label className="auth-page__label">Senha</label>
                  <input
                    type="password"
                    className="auth-page__input"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                  />
                </div>
              </div>

              {error && <p className="auth-page__message auth-page__message--error">{error}</p>}
              {success && <p className="auth-page__message auth-page__message--success">{success}</p>}

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
