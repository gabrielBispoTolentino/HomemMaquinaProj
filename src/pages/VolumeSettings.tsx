import type { ReactNode } from "react";
import { FEATURE_GROUPS, FEATURES, type FeatureId } from "../lib/features";
import { VOLUME_KINDS } from "../lib/volumeKinds";
import "./CSS/Worldbuilding.css";

type VolumeSettingsProps = {
  features: Set<FeatureId>;
  kind: string | null;
  headStart?: ReactNode;
  onToggle: (id: FeatureId, on: boolean) => void;
  onKindChange: (kind: string | null) => void;
};

// The volume's "Recursos": which features it uses, so a volume only shows what its kind of work needs.
export default function VolumeSettings({ features, kind, headStart, onToggle, onKindChange }: VolumeSettingsProps) {
  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Recursos
        </h2>
      </header>

      <div className="world-view__body settings">
        <p className="settings__intro">
          Ligue só o que este volume usa. Desligar um recurso esconde os botões e campos dele, sem apagar nada: ao ligar
          de novo, tudo volta como estava.
        </p>

        {FEATURE_GROUPS.map(group => (
          <section key={group.id} className="settings__group">
            <h3 className="settings__group-title">{group.label}</h3>
            {FEATURES.filter(feature => feature.group === group.id).map(feature => {
              const on = features.has(feature.id);
              const blocked = feature.id === "graph" && !features.has("mentions");
              return (
                <label key={feature.id} className={`settings__feature${blocked ? " settings__feature--blocked" : ""}`}>
                  <input
                    type="checkbox"
                    className="settings__switch"
                    role="switch"
                    checked={on}
                    onChange={event => onToggle(feature.id, event.target.checked)}
                  />
                  <span className="settings__text">
                    <span className="settings__label">{feature.label}</span>
                    <span className="settings__description">
                      {feature.description}
                      {blocked && on && " Ligue as menções para ver o mapa."}
                    </span>
                  </span>
                </label>
              );
            })}
          </section>
        ))}

        <section className="settings__group">
          <h3 className="settings__group-title">Modelos de verbete</h3>
          <label className="settings__select-row">
            <span className="settings__description">Oferecer os modelos de</span>
            <select
              className="settings__select"
              value={kind ?? ""}
              onChange={event => onKindChange(event.target.value || null)}
            >
              <option value="">Todos os tipos de volume</option>
              {VOLUME_KINDS.filter(item => item.templates.length).map(item => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>
    </article>
  );
}
