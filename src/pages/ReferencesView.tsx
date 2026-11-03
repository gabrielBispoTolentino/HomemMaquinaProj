import { useMemo, useState, type ReactNode } from "react";
import { brokenCitations, citesTitle, isSource, sourcesByTitle } from "../lib/citations";
import { titleKey } from "../lib/mentions";
import type { NoteItem } from "../lib/notes";
import { looksLikeSource, referencePlain, referenceSortKey } from "../lib/references";
import { ReferenceLine } from "./ReferenceForm.tsx";
import "./CSS/Worldbuilding.css";

type ReferencesViewProps = {
  notes: NoteItem[];
  headStart?: ReactNode;
  onOpenNote: (note: NoteItem) => void;
  onNewSource: () => void;
  // Turns notes that keep a source in custom fields into sources (the volume offers to undo it).
  onMakeSources: (notes: NoteItem[]) => void;
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

// The volume's sources, like a bibliography card file: every source as ABNT lists it, where each one is cited,
// those not cited yet, and citations that point to no source.
export default function ReferencesView({ notes, headStart, onOpenNote, onNewSource, onMakeSources }: ReferencesViewProps) {
  const [copied, setCopied] = useState(false);

  const { sources, broken, candidates, shadowed } = useMemo(() => {
    const byTitle = sourcesByTitle(notes);
    const all = notes
      .filter(isSource)
      .sort((a, b) => referenceSortKey(a.reference).localeCompare(referenceSortKey(b.reference), "pt-BR"));
    const sources = all.map(source => {
      const key = titleKey(source.title);
      return { source, citedIn: key ? notes.filter(note => note.id !== source.id && citesTitle(note.content, key)) : [] };
    });
    // Two sources with the same title: citations find only the first one.
    const shadowed = all.filter(source => byTitle.get(titleKey(source.title)) !== source);

    const broken = new Map<string, NoteItem[]>();
    for (const note of notes) {
      for (const name of brokenCitations(note.content, byTitle)) {
        const found = broken.get(name) ?? [];
        if (!found.includes(note)) broken.set(name, [...found, note]);
      }
    }
    const candidates = notes.filter(note => !isSource(note) && looksLikeSource(note.fields));
    return { sources, broken: [...broken], candidates, shadowed };
  }, [notes]);

  const cited = sources.filter(item => item.citedIn.length > 0);
  const uncited = sources.filter(item => item.citedIn.length === 0);

  const copy = async () => {
    await navigator.clipboard.writeText(`${sources.map(item => referencePlain(item.source.reference)).join("\n\n")}\n`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sourceItem = ({ source, citedIn }: (typeof sources)[number]) => (
    <li key={source.id} className="references__item">
      <p className="references__line">
        <ReferenceLine reference={source.reference} />
      </p>
      <span className="names__where">
        <button type="button" className="names__note" onClick={() => onOpenNote(source)}>
          [@{source.title.trim() || "Sem título"}]
        </button>
        {citedIn.length > 0 && <> citada em</>}
      </span>
      {citedIn.length > 0 && <NoteLinks notes={citedIn} onOpenNote={onOpenNote} />}
      {shadowed.includes(source) && (
        <span className="references__warning">Outra fonte tem o mesmo título; as citações vão para a primeira.</span>
      )}
    </li>
  );

  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Referências
        </h2>
        <div className="references__actions">
          <button type="button" className="writing-button" onClick={onNewSource}>
            <span aria-hidden="true">+</span> Fonte
          </button>
          {sources.length > 0 && (
            <button type="button" className="writing-button" onClick={copy}>
              {copied ? "Copiado!" : "Copiar lista"}
            </button>
          )}
        </div>
      </header>

      <div className="world-view__body">
        <p className="settings__intro">
          Uma fonte é um verbete com referência (o botão “Fonte”, no alto do verbete). Cite-a no texto com{" "}
          <code>[@Título]</code> ou <code>[@Título, p. 42]</code>; no manuscrito, a citação sai no padrão ABNT e a fonte
          entra nas referências do fim.
        </p>

        {candidates.length > 0 && (
          <section className="references__convert">
            <p>
              {candidates.length === 1 ? "1 verbete guarda" : `${candidates.length} verbetes guardam`} uma fonte em campos
              (Autor, Ano…). Transforme em fonte para poder citar:
            </p>
            <NoteLinks notes={candidates} onOpenNote={onOpenNote} />
            <button type="button" className="writing-button" onClick={() => onMakeSources(candidates)}>
              {candidates.length === 1 ? "Transformar em fonte" : "Transformar todos em fontes"}
            </button>
          </section>
        )}

        {broken.length > 0 && (
          <>
            <h3 className="settings__group-title">Citações sem fonte</h3>
            <ul className="names">
              {broken.map(([name, where]) => (
                <li key={name} className="names__item">
                  <span className="names__found">[@{name}]</span>
                  <span className="names__where">em</span>
                  <NoteLinks notes={where} onOpenNote={onOpenNote} />
                </li>
              ))}
            </ul>
          </>
        )}

        {sources.length === 0 ? (
          <p className="world-view__empty">Nenhuma fonte ainda. Use “+ Fonte” para criar a primeira.</p>
        ) : (
          <>
            {cited.length > 0 && (
              <>
                <h3 className="settings__group-title">Citadas</h3>
                <ul className="references">{cited.map(sourceItem)}</ul>
              </>
            )}
            {uncited.length > 0 && (
              <>
                <h3 className="settings__group-title">Ainda não citadas</h3>
                <ul className="references">{uncited.map(sourceItem)}</ul>
              </>
            )}
          </>
        )}
      </div>
    </article>
  );
}
