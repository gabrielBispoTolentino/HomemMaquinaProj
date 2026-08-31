import "./CSS/Login.css";

type LoginProps = {
  onGoToCadastro: () => void;
  onBack: () => void;
};

export default function Login({ onGoToCadastro, onBack }: LoginProps) {
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

            <div className="auth-page__card">
              <h1 className="auth-page__heading">Login</h1>

              <div className="auth-page__fields">
                <div>
                  <label className="auth-page__label">Usuario</label>
                  <input type="text" className="auth-page__input" />
                </div>

                <div>
                  <label className="auth-page__label">Senha</label>
                  <input type="password" className="auth-page__input" />
                </div>
              </div>

              <button type="submit" className="auth-page__submit">
                Login
              </button>
            </div>

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
