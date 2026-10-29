import { useState, type ReactNode } from "react";
import { FEATURE_GROUPS, FEATURES, type FeatureId } from "../lib/features";
import { getTextSize, setTextSize, TEXT_SIZES } from "../lib/prefs";
import { VOLUME_KINDS } from "../lib/volumeKinds";
import type { WorldDetails, WorldItem } from "../lib/worlds";
import "./CSS/Worldbuilding.css";

type VolumeSettingsProps = {
  world: WorldItem;
  features: Set<FeatureId>;
  kind: string | null;
  headStart?: ReactNode;
  onToggle: (id: FeatureId, on: boolean) => void;
  onKindChange: (kind: string | null) => void;
  // Resolves to an error message, or null once saved.
  onSaveDetails: (details: WorldDetails) => Promise<string | null>;
  onDelete: () => void;
};

// Light pastels only, since the volume's name is written in ink on its color: the models' colors and a few more.
const COLORS = [...new Set([...VOLUME_KINDS.map(kind => kind.accent), "#f2b8d2", "#b8e0e8", "#d6dcb0", "#e3c3a8"])];
const ICONS = [...new Set([...VOLUME_KINDS.map(kind => kind.icon), "📚", "📜", "🔬", "🏛", "⚔", "🌙", "🗝", "✦"])];

// The volume itself: its name, description, color and icon. Each change is saved as soon as it's made.
function VolumeDetails({ world, onSave }: { world: WorldItem; onSave: VolumeSettingsProps["onSaveDetails"] }) {
  const current: WorldDetails = {
    name: world.name,
    description: world.description ?? null,
    accent_color: world.accent_color ?? COLORS[0]!,
    icon: world.icon ?? "✎",
  };
  const [name, setName] = useState(current.name);
  const [description, setDescription] = useState(current.description ?? "");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const save = async (changes: Partial<WorldDetails>) => {
    const next = { ...current, ...changes };
    if (!next.name.trim()) {
      setName(current.name);
      setMessage({ text: "O volume precisa de um nome.", error: true });
      return;
    }
    const same =
      next.name === current.name &&
      next.description === current.description &&
      next.accent_color === current.accent_color &&
      next.icon === current.icon;
    if (same) return;
    const error = await onSave({ ...next, name: next.name.trim() });
    setMessage(error ? { text: error, error: true } : { text: "Arquivado", error: false });
  };

  return (
    <section className="settings__group">
      <h3 className="settings__group-title">Este volume</h3>
      <label className="settings__field">
        <span className="settings__label">Nome</span>
        <input
          className="settings__input"
          value={name}
          onChange={event => setName(event.target.value)}
          onBlur={() => save({ name })}
          onKeyDown={event => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setName(current.name);
          }}
          maxLength={80}
          enterKeyHint="done"
        />
      </label>
      <label className="settings__field">
        <span className="settings__label">
          Descrição <span className="settings__optional">(opcional)</span>
        </span>
        <textarea
          className="settings__input settings__input--area"
          value={description}
          onChange={event => setDescription(event.target.value)}
          onBlur={() => save({ description: description.trim() || null })}
          placeholder="Do que trata este volume?"
          maxLength={500}
          rows={2}
        />
      </label>
      <fieldset className="settings__field settings__choices">
        <legend className="settings__label">Cor da divisória</legend>
        {COLORS.map((color, index) => (
          <label key={color} className="settings__swatch" style={{ "--swatch": color } as React.CSSProperties}>
            <input
              type="radio"
              name="volume-color"
              checked={current.accent_color === color}
              onChange={() => save({ accent_color: color })}
              aria-label={`Cor ${index + 1}`}
            />
          </label>
        ))}
      </fieldset>
      <fieldset className="settings__field settings__choices">
        <legend className="settings__label">Ícone</legend>
        {ICONS.map(icon => (
          <label key={icon} className="settings__icon-choice">
            <input
              type="radio"
              name="volume-icon"
              checked={current.icon === icon}
              onChange={() => save({ icon })}
              aria-label={`Ícone ${icon}`}
            />
            <span aria-hidden="true">{icon}</span>
          </label>
        ))}
      </fieldset>
      {message && (
        <p className={`settings__message${message.error ? " settings__message--error" : ""}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}

// How big the text of notes and the manuscript is. A preference of this device, not of the volume.
function ReadingSize() {
  const [size, setSize] = useState(getTextSize);
  return (
    <section className="settings__group">
      <h3 className="settings__group-title">Leitura neste aparelho</h3>
      <fieldset className="settings__field settings__choices">
        <legend className="settings__label">Tamanho do texto dos verbetes</legend>
        {TEXT_SIZES.map(item => (
          <label key={item.id} className="settings__size-choice">
            <input
              type="radio"
              name="text-size"
              checked={size === item.id}
              onChange={() => {
                setSize(item.id);
                setTextSize(item.id);
              }}
              aria-label={item.name}
            />
            <span aria-hidden="true">{item.label}</span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}

// The volume's "Recursos": the volume itself, which features it uses (so a volume only shows what its kind of
// work needs), reading comfort on this device, and deleting the volume.
export default function VolumeSettings(props: VolumeSettingsProps) {
  const { features, kind, headStart, onToggle, onKindChange } = props;
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

        <VolumeDetails key={props.world.id} world={props.world} onSave={props.onSaveDetails} />

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

        <ReadingSize />

        <section className="settings__group settings__group--danger">
          <h3 className="settings__group-title">Excluir o volume</h3>
          <p className="settings__description">
            Apaga o volume com todos os verbetes, subgrupos, categorias e versões, inclusive os da Lixeira. Não dá para
            desfazer.
          </p>
          <button type="button" className="writing-button settings__delete" onClick={props.onDelete}>
            Excluir este volume…
          </button>
        </section>
      </div>
    </article>
  );
}
