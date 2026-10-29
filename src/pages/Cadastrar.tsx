import { useState } from "react";
import { signUp } from "../lib/auth";
import "./CSS/Cadastrar.css";

type CadastrarProps = {
  onBack: () => void;
  onGoToLogin: () => void;
};

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

  const handleChange = (field: keyof typeof emptyForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password || !form.cellphone.trim()) {
      setError("Preencha nome, email, senha e celular.");
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
                Bem
                <br />
                vindo.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="auth-page__card">
              <h1 className="auth-page__heading">Cadastro</h1>

              <div className="auth-page__fields">
                <div>
                  <label className="auth-page__label">Nome</label>
                  <input
                    type="text"
                    className="auth-page__input"
                    value={form.name}
                    onChange={event => handleChange("name", event.target.value)}
                  />
                </div>

                <div>
                  <label className="auth-page__label">Email</label>
                  <input
                    type="email"
                    className="auth-page__input"
                    value={form.email}
                    onChange={event => handleChange("email", event.target.value)}
                  />
                </div>

                <div>
                  <label className="auth-page__label">Senha</label>
                  <input
                    type="password"
                    className="auth-page__input"
                    value={form.password}
                    onChange={event => handleChange("password", event.target.value)}
                  />
                </div>

                <div>
                  <label className="auth-page__label">Celular</label>
                  <input
                    type="tel"
                    className="auth-page__input"
                    value={form.cellphone}
                    onChange={event => handleChange("cellphone", event.target.value)}
                  />
                </div>
              </div>

              {error && <p className="auth-page__message auth-page__message--error">{error}</p>}
              {success && <p className="auth-page__message auth-page__message--success">{success}</p>}

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
