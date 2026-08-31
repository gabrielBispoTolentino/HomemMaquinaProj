import "./CSS/Cadastrar.css";

type CadastrarProps = {
  onBack: () => void;
  onGoToLogin: () => void;
};

export default function Cadastrar({ onBack, onGoToLogin }: CadastrarProps) {
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

            <div className="auth-page__card">
              <h1 className="auth-page__heading">Cadastro</h1>

              <div className="auth-page__fields">
                <div>
                  <label className="auth-page__label">Nome</label>
                  <input type="text" className="auth-page__input" />
                </div>

                <div>
                  <label className="auth-page__label">Email</label>
                  <input type="email" className="auth-page__input" />
                </div>

                <div>
                  <label className="auth-page__label">Senha</label>
                  <input type="password" className="auth-page__input" />
                </div>
              </div>

              <button type="submit" className="auth-page__submit">
                Cadastrar
              </button>
            </div>

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
