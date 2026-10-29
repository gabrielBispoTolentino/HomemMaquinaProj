import { useState } from "react";
import "./CSS/Login.css";
import "./CSS/SyncChoice.css";

type SyncChoiceProps = {
  userName: string;
  onChoose: (enabled: boolean) => Promise<void>;
  onBack: () => void;
};

// Asked once per user on each device, right after their first login there: keep the volumes only here, or also in
// the cloud (see sync.ts). Can be changed later from the volume list.
export default function SyncChoice({ userName, onChoose, onBack }: SyncChoiceProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choose = async (enabled: boolean) => {
    try {
      setSaving(true);
      setError("");
      await onChoose(enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a escolha.");
      setSaving(false);
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
                Olá,
                <br />
                {userName}.
              </div>
            </div>

            <div className="auth-page__card">
              <h1 className="auth-page__heading sync-choice__heading">Onde guardar o seu arquivo?</h1>

              <div className="sync-choice__options">
                <button type="button" className="sync-choice__option" disabled={saving} onClick={() => choose(true)}>
                  <span className="sync-choice__label">Neste aparelho e na nuvem</span>
                  <span className="sync-choice__description">
                    Uma cópia de segurança fica na sua conta, e os seus volumes aparecem em qualquer aparelho em que
                    você entrar. A escrita continua salva aqui primeiro, mesmo sem internet.
                  </span>
                </button>

                <button type="button" className="sync-choice__option" disabled={saving} onClick={() => choose(false)}>
                  <span className="sync-choice__label">Só neste aparelho</span>
                  <span className="sync-choice__description">
                    Os volumes ficam apenas aqui e nada sai do aparelho. Se ele for perdido ou apagado, os volumes vão
                    junto.
                  </span>
                </button>
              </div>

              {error && <p className="auth-page__message auth-page__message--error">{error}</p>}
            </div>

            <p className="auth-page__switcher sync-choice__note">Dá para mudar depois, na lista de volumes.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
