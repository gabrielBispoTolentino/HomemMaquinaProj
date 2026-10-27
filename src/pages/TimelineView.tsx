import type { ReactNode } from "react";
import { categoryColor, type CategoryItem } from "../lib/categories";
import { timelineOrder } from "../lib/mentions";
import type { NoteItem } from "../lib/notes";
import "./CSS/Worldbuilding.css";

type TimelineViewProps = {
  notes: NoteItem[];
  categories: CategoryItem[];
  headStart?: ReactNode;
  onOpenNote: (note: NoteItem) => void;
};

// Notes with a "Quando", in order of the number in it ("Ano 312" comes after "Ano 40"); ones without a number
// close the line, in the order they were filed.
export default function TimelineView({ notes, categories, headStart, onOpenNote }: TimelineViewProps) {
  const dated = notes
    .filter(note => note.timeline.trim())
    .map(note => ({ note, order: timelineOrder(note.timeline) }))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.note.position - b.note.position);

  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Linha do tempo
        </h2>
      </header>

      <div className="world-view__body">
        {dated.length === 0 ? (
          <p className="world-view__empty">
            Nenhum verbete tem “Quando” ainda. Preencha esse campo no verbete, como “Ano 312” ou “Dia 4”, para ele
            aparecer aqui.
          </p>
        ) : (
          <ol className="timeline">
            {dated.map(({ note }) => {
              const category = categories.find(item => item.id === note.category_id);
              return (
                <li
                  key={note.id}
                  className="timeline__event"
                  style={category ? ({ "--category": categoryColor(categories, category.id) } as React.CSSProperties) : undefined}
                >
                  <span className="timeline__when">{note.timeline}</span>
                  <button type="button" className="timeline__card" onClick={() => onOpenNote(note)}>
                    <span className="timeline__title">{note.title.trim() || "Sem título"}</span>
                    {category && <span className="timeline__category">{category.name}</span>}
                    {(note.synopsis.trim() || note.content.trim()) && (
                      <span className="timeline__text">{note.synopsis.trim() || note.content.trim().slice(0, 200)}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </article>
  );
}
