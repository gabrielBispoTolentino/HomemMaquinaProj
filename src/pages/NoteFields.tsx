import type { NoteField } from "../lib/notes";

type NoteFieldsProps = {
  fields: NoteField[];
  onChange: (fields: NoteField[]) => void;
};

// A note's custom fields, as name and value rows on the page (the "fields" feature).
export default function NoteFields({ fields, onChange }: NoteFieldsProps) {
  const update = (index: number, change: Partial<NoteField>) =>
    onChange(fields.map((field, i) => (i === index ? { ...field, ...change } : field)));

  return (
    <div className="note-fields" role="group" aria-label="Campos">
      {fields.map((field, index) => (
        <div key={index} className="note-fields__row">
          <input
            className="note-fields__key"
            value={field.key}
            onChange={event => update(index, { key: event.target.value })}
            placeholder="Campo"
            aria-label={`Nome do campo ${index + 1}`}
            maxLength={40}
          />
          <input
            className="note-fields__value"
            value={field.value}
            onChange={event => update(index, { value: event.target.value })}
            placeholder="—"
            aria-label={field.key ? `Valor de ${field.key}` : `Valor do campo ${index + 1}`}
          />
          <button
            type="button"
            className="note-fields__remove"
            onClick={() => onChange(fields.filter((_, i) => i !== index))}
            aria-label={field.key ? `Remover o campo ${field.key}` : "Remover o campo"}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="note-fields__add" onClick={() => onChange([...fields, { key: "", value: "" }])}>
        <span aria-hidden="true">+</span> Campo
      </button>
    </div>
  );
}
