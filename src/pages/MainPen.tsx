import "./CSS/MainPen.css";

type MainPenProps = {
  onEntrar: () => void;
  onGoToCadastro: () => void;
};

export default function MainPen({ onEntrar, onGoToCadastro }: MainPenProps) {
  return (
    <main className="main-pen">
      <section className="main-pen__section">
        <div
          className="main-pen__background"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80')",
          }}
        />
        <div className="main-pen__overlay" />

        <div className="main-pen__content">
          <div className="main-pen__brand">
            <h1 className="main-pen__title">Archivist</h1>
            <p className="main-pen__tagline">O compêndio pessoal dos seus mundos</p>
          </div>

          <button type="button" onClick={onEntrar} className="main-pen__button">
            Entrar
          </button>

          <p className="main-pen__text">
            Primeira vez?{' '}
            <button type="button" onClick={onGoToCadastro} className="main-pen__link">
              Cadastre-se
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
