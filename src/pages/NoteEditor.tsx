import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { categoryColor, createCategory, findCategoryByName, type CategoryItem } from "../lib/categories";
import { featureOn, type FeatureId } from "../lib/features";
import { backlinks, mentionedNotes, notesByTitle, titleKey } from "../lib/mentions";
import { createNote, trashNote, updateNote, type NoteDraft, type NoteItem } from "../lib/notes";
import { endPosition } from "../lib/order";
import { subgroupPaths, type SubgroupItem } from "../lib/subgroups";
import { countWords, formatWords, NOTE_STATUSES } from "../lib/writing";
import type { WorldItem } from "../lib/worlds";
import MentionText from "./MentionText.tsx";
import NoteFields from "./NoteFields.tsx";
import NoteVersions from "./NoteVersions.tsx";
import "./CSS/Notes.css";

type NoteEditorProps = {
  // Shown before the note's path, e.g. the button that brings back a hidden sidebar.
  headStart?: ReactNode;
  world: WorldItem;
  // null starts a new note, which is only inserted once it has some text.
  note: NoteItem | null;
  // Where a new note goes, e.g. when it was started from a subgroup's "+".
  initialSubgroupId: string | null;
  // A new note's starting text, category and fields, from a note template.
  preset?: Partial<NoteDraft>;
  features: Set<FeatureId>;
  // Every note in the volume, for [[mentions]] and the notes that mention this one.
  allNotes: NoteItem[];
  onOpenNote: (note: NoteItem) => void;
  categories: CategoryItem[];
  subgroups: SubgroupItem[];
  onCategoryCreated: (category: CategoryItem) => void;
  // Called after every save, so the listing shows the new title, subgroup and category.
  onSaved: (note: NoteItem) => void;
  // Moved to the Lixeira; the volume offers to undo it.
  onDeleted: (id: string, title: string) => void;
  onClose: () => void;
};

type SaveState = "saved" | "pending" | "error";

const AUTOSAVE_DELAY_MS = 800;

// "21 de out. de 2026".
function registerDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

// The note's history, like the entry line in a register. A revision on the day it was registered isn't worth a mention.
function registerText(createdAt: string, updatedAt: string) {
  const registered = `Registrado em ${registerDate(createdAt)}`;
  const sameDay = new Date(createdAt).toDateString() === new Date(updatedAt).toDateString();
  return sameDay ? registered : `${registered} · Revisado em ${registerDate(updatedAt)}`;
}

// The [[mention]] being typed just before the caret: where its name starts and what's typed of it so far.
function mentionAtCaret(text: string, caret: number) {
  const match = text.slice(0, caret).match(/\[\[([^[\]\n]*)$/);
  return match ? { start: caret - match[1]!.length, query: match[1]! } : null;
}

export default function NoteEditor(props: NoteEditorProps) {
  const { world, note, categories, subgroups, features, allNotes } = props;
  const preset = note ? undefined : props.preset;
  const on = (id: FeatureId) => featureOn(features, id);
  const [title, setTitle] = useState(note?.title ?? preset?.title ?? "");
  const [content, setContent] = useState(note?.content ?? preset?.content ?? "");
  const [categoryId, setCategoryId] = useState(note?.category_id ?? preset?.categoryId ?? null);
  const [subgroupId, setSubgroupId] = useState(note ? note.subgroup_id : props.initialSubgroupId);
  const [status, setStatus] = useState(note?.status ?? null);
  const [synopsis, setSynopsis] = useState(note?.synopsis ?? "");
  const [fields, setFields] = useState(note?.fields ?? preset?.fields ?? []);
  const [timeline, setTimeline] = useState(note?.timeline ?? preset?.timeline ?? "");
  const [mention, setMention] = useState<{ start: number; query: string; index: number } | null>(null);
  // Whether the text is in its textarea; otherwise it shows with [[mentions]] as links (MentionText).
  const [editingContent, setEditingContent] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Both null until a new note is first saved.
  const [createdAt, setCreatedAt] = useState(note?.created_at ?? null);
  const [updatedAt, setUpdatedAt] = useState(note?.updated_at ?? null);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useRef(note?.id ?? null);
  const createdAtRef = useRef(createdAt);
  const draft = useRef<NoteDraft>({ title, content, categoryId, subgroupId, status, synopsis, fields, timeline });
  // The content's word count as last saved, so each save adds only the difference to today's writing.
  const savedWords = useRef(countWords(content));
  // Set by Escape so the blur that follows discards the new category instead of creating it.
  const cancelCategory = useRef(false);
  const dirty = useRef(false);
  // Whether anything was typed since opening, so "Arquivado" is only stamped after a real save, not on opening.
  const edited = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves run one after another so a new note is never inserted twice.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const persist = async () => {
    if (!dirty.current) return;
    dirty.current = false;

    const current = draft.current;
    const words = countWords(current.content);
    const fields = {
      title: current.title,
      content: current.content,
      category_id: current.categoryId,
      subgroup_id: current.subgroupId,
      status: current.status,
      synopsis: current.synopsis,
      fields: current.fields,
      timeline: current.timeline,
    };

    if (!noteId.current) {
      if (!current.title.trim() && !current.content.trim()) return;
      // New notes go at the end of their subgroup.
      const position = endPosition();
      const created = await createNote(world.id, current, position);
      noteId.current = created.id;
      savedWords.current = words;
      createdAtRef.current = created.created_at;
      setCreatedAt(created.created_at);
      setUpdatedAt(created.created_at);
      props.onSaved({
        id: created.id,
        ...fields,
        position,
        created_at: created.created_at,
        updated_at: created.created_at,
      });
      return;
    }

    const updated = await updateNote(noteId.current, world.id, current, words - savedWords.current);
    savedWords.current = words;
    setUpdatedAt(updated);
    // The listing keeps its own position for the note, which drag and drop may have changed meanwhile.
    props.onSaved({
      id: noteId.current,
      ...fields,
      position: note?.position ?? 0,
      created_at: createdAtRef.current ?? updated,
      updated_at: updated,
    });
  };

  const save = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    queue.current = queue.current
      .then(persist)
      .then(() => {
        setError("");
        setSaveState(dirty.current ? "pending" : "saved");
      })
      .catch(err => {
        dirty.current = true;
        setSaveState("error");
        setError(err instanceof Error ? err.message : "Erro ao salvar verbete.");
      });

    return queue.current;
  };

  const edit = (changes: Partial<NoteDraft>) => {
    const next = { ...draft.current, ...changes };
    setTitle(next.title);
    setContent(next.content);
    setCategoryId(next.categoryId);
    setSubgroupId(next.subgroupId);
    setStatus(next.status);
    setSynopsis(next.synopsis);
    setFields(next.fields);
    setTimeline(next.timeline);
    draft.current = next;
    dirty.current = true;
    edited.current = true;
    setSaveState("pending");

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  };

  // A category or subgroup deleted from the sidebar while this note is open: the database already moved the note
  // (no category; up into the deleted subgroup's parent, which the listing passes back in `note`), so follow it
  // in the draft too, or the next save would point at a row that no longer exists.
  useEffect(() => {
    const { categoryId: draftCategory, subgroupId: draftSubgroup } = draft.current;
    const categoryGone = draftCategory !== null && !categories.some(category => category.id === draftCategory);
    const subgroupGone = draftSubgroup !== null && !subgroups.some(subgroup => subgroup.id === draftSubgroup);
    if (!categoryGone && !subgroupGone) return;

    const movedTo = note && subgroups.some(subgroup => subgroup.id === note.subgroup_id) ? note.subgroup_id : null;
    draft.current = {
      ...draft.current,
      categoryId: categoryGone ? null : draftCategory,
      subgroupId: subgroupGone ? movedTo : draftSubgroup,
    };
    setCategoryId(draft.current.categoryId);
    setSubgroupId(draft.current.subgroupId);
  }, [categories, subgroups, note]);

  // Dragged to another subgroup in the listing while open: the database already has the new place.
  useEffect(() => {
    if (!note || note.subgroup_id === draft.current.subgroupId) return;
    draft.current = { ...draft.current, subgroupId: note.subgroup_id };
    setSubgroupId(note.subgroup_id);
  }, [note?.subgroup_id]);

  const ensureSaved = async () => {
    await save();
    return noteId.current;
  };

  // Picks an existing category with the same name instead of creating a duplicate.
  const addCategory = async (name: string) => {
    setAddingCategory(false);
    setNewCategoryName("");
    if (!name.trim()) return;

    const existing = findCategoryByName(categories, name);
    if (existing) {
      edit({ categoryId: existing.id });
      return;
    }

    try {
      const created = await createCategory(world.id, name);
      props.onCategoryCreated(created);
      edit({ categoryId: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  };

  // Opening another note, or leaving another way (e.g. the Android back button), still saves pending edits.
  useEffect(() => {
    return () => {
      if (dirty.current) save();
    };
  }, []);

  // No confirmation: the note goes to the Lixeira, and the volume offers to undo it right away.
  const handleDelete = async () => {
    if (!noteId.current) {
      dirty.current = false;
      props.onClose();
      return;
    }

    try {
      setDeleting(true);
      // Pending edits are saved first, so restoring brings back the latest text.
      await save();
      await trashNote(noteId.current);
      props.onDeleted(noteId.current, draft.current.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir verbete.");
      setDeleting(false);
    }
  };

  // [[ suggestions: the volume's notes whose title contains what's typed so far.
  const suggestions = mention
    ? allNotes
        .filter(item => item.id !== noteId.current && item.title.trim() && titleKey(item.title).includes(titleKey(mention.query)))
        .slice(0, 6)
    : [];

  const trackMention = (textarea: HTMLTextAreaElement) => {
    if (!on("mentions")) return;
    const found = mentionAtCaret(textarea.value, textarea.selectionStart);
    setMention(found ? { ...found, index: 0 } : null);
  };

  // Completes the [[mention]] with the note's title and puts the caret after it.
  const completeMention = (target: NoteItem) => {
    if (!mention) return;
    const textarea = contentRef.current!;
    const after = content.slice(textarea.selectionStart);
    const closing = after.startsWith("]]") ? "" : "]]";
    const next = content.slice(0, mention.start) + target.title.trim() + closing + after;
    const caret = mention.start + target.title.trim().length + 2;
    edit({ content: next });
    setMention(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  };

  const byTitle = notesByTitle(allNotes);
  const mentions = on("mentions") ? mentionedNotes(content, byTitle).filter(item => item.id !== noteId.current) : [];
  const reading = on("mentions") && !editingContent && content.trim() !== "";

  // Switches to the textarea within the click or key press, so phones still open the keyboard for it.
  const editContent = (caret = content.length, scrollTop?: number) => {
    flushSync(() => setEditingContent(true));
    const textarea = contentRef.current;
    if (!textarea) return;
    if (scrollTop !== undefined) textarea.scrollTop = scrollTop;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(caret, caret);
  };
  const mentionedIn = on("mentions") && title.trim() ? backlinks({ id: noteId.current ?? "", title }, allNotes) : [];

  const statusText = error || (saveState === "pending" ? "Arquivando..." : "Arquivado");
  const wordsText = formatWords(countWords(content));

  return (
    <article
      className="note-pane"
      onKeyDown={event => {
        // Saving is automatic; Ctrl+S (⌘S) just does it now, for those who press it out of habit.
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          save();
        }
      }}
    >
      <header className="note-pane__head">
        {props.headStart}
        {/* Where the note is filed: Subgrupo / Título. The subgroup is picked here. */}
        <div className="note-pane__path">
          <select
            className="note-pane__subgroup"
            value={subgroupId ?? ""}
            onChange={event => edit({ subgroupId: event.target.value || null })}
            aria-label="Subgrupo"
          >
            <option value="">Sem subgrupo</option>
            {subgroupPaths(subgroups).map(path => (
              <option key={path.id} value={path.id}>
                {path.label}
              </option>
            ))}
          </select>
          <span className="note-pane__separator" aria-hidden="true">
            /
          </span>
          <span className="note-pane__name">{title.trim() || "Sem título"}</span>
        </div>
        {on("versions") && (
          <button
            type="button"
            className="note-pane__tool"
            aria-pressed={showVersions}
            onClick={() => setShowVersions(!showVersions)}
          >
            Versões
          </button>
        )}
      </header>

      {showVersions && on("versions") && (
        <NoteVersions
          title={title}
          content={content}
          ensureSaved={ensureSaved}
          onRestore={snapshot => edit({ title: snapshot.title, content: snapshot.content })}
          onClose={() => setShowVersions(false)}
        />
      )}

      <section className="note-editor">
        {/* A textarea so long titles wrap; Enter moves on to the note instead of adding a line. */}
        <textarea
          className="note-editor__title"
          rows={1}
          value={title}
          onChange={event => edit({ title: event.target.value.replace(/\n/g, " ") })}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              editContent();
            }
          }}
          placeholder="Título"
          maxLength={200}
          autoFocus={!note}
        />
        <p className={`note-editor__status${saveState === "error" ? " note-editor__status--error" : ""}`} role="status">
          {/* Remounted on each change of state, so every finished save is stamped anew. */}
          <span key={saveState} className={saveState === "saved" && edited.current ? "note-editor__stamp" : undefined}>
            {statusText}
          </span>
        </p>
        {on("status") && (
          <div className="note-editor__statuses" role="group" aria-label="Status">
            {NOTE_STATUSES.map(item => (
              <button
                key={item.id}
                type="button"
                className="note-editor__status-option"
                aria-pressed={status === item.id}
                onClick={() => edit({ status: status === item.id ? null : item.id })}
              >
                <span aria-hidden="true">{item.mark}</span> {item.label}
              </button>
            ))}
          </div>
        )}
        <div className="note-editor__categories" role="group" aria-label="Categoria">
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              className="category-chip"
              style={{ "--category": categoryColor(categories, category.id) } as React.CSSProperties}
              aria-pressed={categoryId === category.id}
              onClick={() => edit({ categoryId: categoryId === category.id ? null : category.id })}
            >
              {category.name}
            </button>
          ))}
          {addingCategory ? (
            <input
              className="category-chip category-chip--input"
              value={newCategoryName}
              onChange={event => setNewCategoryName(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  cancelCategory.current = true;
                  event.currentTarget.blur();
                }
              }}
              onBlur={() => {
                const name = cancelCategory.current ? "" : newCategoryName;
                cancelCategory.current = false;
                addCategory(name);
              }}
              placeholder="Nome da categoria"
              aria-label="Nome da nova categoria"
              maxLength={40}
              enterKeyHint="done"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="category-chip category-chip--add"
              onClick={() => setAddingCategory(true)}
            >
              <span aria-hidden="true">+</span> {categories.length ? "Categoria" : "Criar categoria"}
            </button>
          )}
        </div>
        {on("timeline") && (
          <label className="note-editor__when">
            <span>Quando</span>
            <input
              value={timeline}
              onChange={event => edit({ timeline: event.target.value })}
              placeholder="Ano 312, inverno"
              maxLength={80}
            />
          </label>
        )}
        {on("fields") && (
          <NoteFields fields={fields} onChange={next => edit({ fields: next })} />
        )}
        {on("corkboard") && (
          <input
            className="note-editor__synopsis"
            value={synopsis}
            onChange={event => edit({ synopsis: event.target.value })}
            placeholder="Resumo para o quadro (opcional)"
            aria-label="Resumo"
            maxLength={300}
          />
        )}
        <div className="note-editor__body">
          {reading ? (
            <MentionText
              content={content}
              byTitle={byTitle}
              noteId={noteId.current}
              onOpenNote={props.onOpenNote}
              onEdit={editContent}
            />
          ) : (
            <textarea
              ref={contentRef}
              className="note-editor__content"
              value={content}
              onChange={event => {
                edit({ content: event.target.value });
                trackMention(event.target);
              }}
              onSelect={event => trackMention(event.currentTarget)}
              onFocus={() => setEditingContent(true)}
              onBlur={() => {
                setEditingContent(false);
                setTimeout(() => setMention(null), 150);
              }}
              onKeyDown={event => {
                if (!mention || suggestions.length === 0) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setMention({ ...mention, index: (mention.index + step + suggestions.length) % suggestions.length });
                } else if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  completeMention(suggestions[mention.index] ?? suggestions[0]!);
                } else if (event.key === "Escape") {
                  setMention(null);
                }
              }}
              placeholder={on("mentions") ? "Escreva o verbete... Use [[ para citar outro verbete." : "Escreva o verbete..."}
            />
          )}
          {suggestions.length > 0 && (
            <ul className="mention-suggest" role="listbox" aria-label="Verbetes para citar">
              {suggestions.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === mention?.index}>
                  <button
                    type="button"
                    onMouseDown={event => {
                      event.preventDefault();
                      completeMention(item);
                    }}
                  >
                    {item.title.trim()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {on("secrets") && /\[segredo\]/i.test(content) && (
          <p className="note-editor__hint">Os trechos entre [segredo] e [/segredo] ficam de fora da versão dos jogadores.</p>
        )}
        {(mentions.length > 0 || mentionedIn.length > 0) && (
          <div className="note-links">
            {mentions.length > 0 && (
              <p>
                <span className="note-links__label">Menciona</span>
                {mentions.map(item => (
                  <button key={item.id} type="button" className="note-links__link" onClick={() => props.onOpenNote(item)}>
                    {item.title.trim()}
                  </button>
                ))}
              </p>
            )}
            {mentionedIn.length > 0 && (
              <p>
                <span className="note-links__label">Mencionado em</span>
                {mentionedIn.map(item => (
                  <button key={item.id} type="button" className="note-links__link" onClick={() => props.onOpenNote(item)}>
                    {item.title.trim() || "Sem título"}
                  </button>
                ))}
              </p>
            )}
          </div>
        )}
        {/* Kept away from the everyday buttons at the top, so it isn't pressed by mistake. */}
        <footer className="note-editor__foot">
          <p className="note-editor__register">
            {createdAt && updatedAt ? `${registerText(createdAt, updatedAt)} · ${wordsText}` : wordsText}
          </p>
          <button type="button" className="note-editor__trash" onClick={handleDelete} disabled={deleting}>
            {noteId.current ? "Mover para a Lixeira" : "Descartar"}
          </button>
        </footer>
      </section>
    </article>
  );
}
