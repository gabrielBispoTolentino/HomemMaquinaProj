import { useMemo, type ReactNode } from "react";
import { checkNames } from "../lib/names";
import type { NoteItem } from "../lib/notes";
import "./CSS/Worldbuilding.css";

type NameCheckProps = {
  notes: NoteItem[];
  headStart?: ReactNode;
  onOpenNote: (note: NoteItem) => void;
};

function NoteLinks({ notes, onOpenNote }: { notes: NoteItem[]; onOpenNote: (note: NoteItem) => void }) {
  return (
    <span className="names__notes">
      {notes.map(note => (
        <button key={note.id} type="button" className="names__note" onClick={() => onOpenNote(note)}>
          {note.title.trim() || "Sem título"}
        </button>
      ))}
    </span>
  );
}

// Possible misspellings of the volume's names, so "Auorra" doesn't slip in for "Aurora".
export default function NameCheck({ notes, headStart, onOpenNote }: NameCheckProps) {
  const { suspects, pairs } = useMemo(() => checkNames(notes), [notes]);

  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Verificação de nomes
        </h2>
      </header>

      <div className="world-view__body">
        <p className="settings__intro">
          Palavras com inicial maiúscula quase iguais ao título de um verbete. Pode ser um erro de digitação, ou um nome
          diferente de propósito.
        </p>

        {suspects.length === 0 && pairs.length === 0 && (
          <p className="world-view__empty">Nenhum nome parecido encontrado. Tudo certo por aqui.</p>
        )}

        {suspects.length > 0 && (
          <ul className="names">
            {suspects.map(suspect => (
              <li key={`${suspect.found}→${suspect.likely}`} className="names__item">
                <span className="names__pair">
                  <span className="names__found">{suspect.found}</span> parece <span className="names__likely">{suspect.likely}</span>
                </span>
                <span className="names__where">em</span>
                <NoteLinks notes={suspect.notes} onOpenNote={onOpenNote} />
              </li>
            ))}
          </ul>
        )}

        {pairs.length > 0 && (
          <>
            <h3 className="settings__group-title">Títulos parecidos</h3>
            <ul className="names">
              {pairs.map(({ a, b }) => (
                <li key={`${a.id}|${b.id}`} className="names__item">
                  <NoteLinks notes={[a, b]} onOpenNote={onOpenNote} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}
