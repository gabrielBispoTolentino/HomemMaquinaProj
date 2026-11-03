import { Fragment } from "react";
import {
  FIELD_LABELS,
  formatReference,
  REFERENCE_FIELDS,
  SOURCE_TYPES,
  type Reference,
  type ReferenceKey,
  type SourceType,
} from "../lib/references";

type ReferenceFormProps = {
  reference: Reference;
  onChange: (reference: Reference) => void;
  // The note stops being a source (the volume offers to undo it).
  onRemove: () => void;
};

// Fields that are short enough to share a row on a wide screen.
const SHORT: ReferenceKey[] = ["year", "edition", "volume", "issue", "pages", "accessed"];

// A formatted reference, its title (or journal) in bold as ABNT prints it.
export function ReferenceLine({ reference }: { reference: Reference }) {
  return (
    <>
      {formatReference(reference).map((part, index) =>
        part.emphasis ? (
          <Fragment key={index}>
            {part.text.match(/^\s*/)![0]}
            <strong>{part.text.trim()}</strong>
          </Fragment>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

// A source's reference, like the card in a library catalogue: its type, the fields that type needs, and how it reads
// in the reference list (ABNT). Cited in the text by the note's title, as [@Título].
export default function ReferenceForm({ reference, onChange, onRemove }: ReferenceFormProps) {
  const set = (key: ReferenceKey, value: string) => onChange({ ...reference, [key]: value });

  return (
    <section className="reference-card" aria-label="Referência da fonte">
      <div className="reference-card__head">
        <span className="reference-card__label">Fonte</span>
        <select
          className="reference-card__type"
          value={reference.type}
          onChange={event => onChange({ ...reference, type: event.target.value as SourceType })}
          aria-label="Tipo de fonte"
        >
          {SOURCE_TYPES.map(type => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
        <button type="button" className="reference-card__remove" onClick={onRemove}>
          Deixar de ser fonte
        </button>
      </div>

      <div className="reference-card__fields">
        {REFERENCE_FIELDS[reference.type].map(key => (
          <label key={key} className={`reference-card__field${SHORT.includes(key) ? " reference-card__field--short" : ""}`}>
            <span>{FIELD_LABELS[key].label}</span>
            <input
              value={reference[key]}
              onChange={event => set(key, event.target.value)}
              placeholder={FIELD_LABELS[key].placeholder}
              inputMode={key === "year" || key === "edition" ? "numeric" : key === "url" ? "url" : undefined}
            />
          </label>
        ))}
      </div>

      <p className="reference-card__preview">
        <span className="reference-card__preview-label">Na lista de referências</span>
        <ReferenceLine reference={reference} />
      </p>
    </section>
  );
}
