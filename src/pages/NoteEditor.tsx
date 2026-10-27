import { useEffect, useRef, useState, type ReactNode } from "react";
import { categoryColor, createCategory, findCategoryByName, type CategoryItem } from "../lib/categories";
import { createNote, deleteNote, updateNote, type NoteDraft, type NoteItem } from "../lib/notes";
import type { SubgroupItem } from "../lib/subgroups";
import type { WorldItem } from "../lib/worlds";
import "./CSS/Notes.css";

type NoteEditorProps = {
  // Shown before the note's path, e.g. the button that brings back a hidden sidebar.
  headStart?: ReactNode;
  world: WorldItem;
  // null starts a new note, which is only inserted once it has some text.
  note: NoteItem | null;
  // Where a new note goes, e.g. when it was started from a subgroup's "+".
  initialSubgroupId: string | null;
  categories: CategoryItem[];
  subgroups: SubgroupItem[];
  onCategoryCreated: (category: CategoryItem) => void;
  // Called after every save, so the listing shows the new title, subgroup and category.
  onSaved: (note: NoteItem) => void;
  onDeleted: (id: string) => void;
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

export default function NoteEditor(props: NoteEditorProps) {
  const { world, note, categories, subgroups } = props;
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [categoryId, setCategoryId] = useState(note?.category_id ?? null);
  const [subgroupId, setSubgroupId] = useState(note ? note.subgroup_id : props.initialSubgroupId);
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
  const draft = useRef<NoteDraft>({ title, content, categoryId, subgroupId });
  // Set by Escape so the blur that follows discards the new category instead of creating it.
  const cancelCategory = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves run one after another so a new note is never inserted twice.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const persist = async () => {
    if (!dirty.current) return;
    dirty.current = false;

    const current = draft.current;
    const fields = {
      title: current.title,
      content: current.content,
      category_id: current.categoryId,
      subgroup_id: current.subgroupId,
    };

    if (!noteId.current) {
      if (!current.title.trim() && !current.content.trim()) return;
      const created = await createNote(world.id, current);
      noteId.current = created.id;
      createdAtRef.current = created.created_at;
      setCreatedAt(created.created_at);
      setUpdatedAt(created.created_at);
      props.onSaved({ id: created.id, ...fields, created_at: created.created_at, updated_at: created.created_at });
      return;
    }

    const updated = await updateNote(noteId.current, current);
    setUpdatedAt(updated);
    props.onSaved({ id: noteId.current, ...fields, created_at: createdAtRef.current ?? updated, updated_at: updated });
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
    draft.current = next;
    dirty.current = true;
    setSaveState("pending");

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  };

  // A category or subgroup deleted from the sidebar while this note is open: the database already cleared it
  // from the note, so drop it from the draft too, or the next save would point at a row that no longer exists.
  useEffect(() => {
    const { categoryId: draftCategory, subgroupId: draftSubgroup } = draft.current;
    const categoryGone = draftCategory !== null && !categories.some(category => category.id === draftCategory);
    const subgroupGone = draftSubgroup !== null && !subgroups.some(subgroup => subgroup.id === draftSubgroup);
    if (!categoryGone && !subgroupGone) return;

    draft.current = {
      ...draft.current,
      categoryId: categoryGone ? null : draftCategory,
      subgroupId: subgroupGone ? null : draftSubgroup,
    };
    setCategoryId(draft.current.categoryId);
    setSubgroupId(draft.current.subgroupId);
  }, [categories, subgroups]);

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

  const handleDelete = async () => {
    if (!noteId.current) {
      dirty.current = false;
      props.onClose();
      return;
    }

    if (!window.confirm("Excluir este verbete?")) return;

    try {
      setDeleting(true);
      if (timer.current) clearTimeout(timer.current);
      dirty.current = false;
      await queue.current;

      await deleteNote(noteId.current);
      props.onDeleted(noteId.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir verbete.");
      setDeleting(false);
    }
  };

  const statusText = error || (saveState === "pending" ? "Arquivando..." : "Arquivado");

  return (
    <article className="note-pane">
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
            {subgroups.map(subgroup => (
              <option key={subgroup.id} value={subgroup.id}>
                {subgroup.name}
              </option>
            ))}
          </select>
          <span className="note-pane__separator" aria-hidden="true">
            /
          </span>
          <span className="note-pane__name">{title.trim() || "Sem título"}</span>
        </div>
        <button
          type="button"
          className="notes__delete-button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Excluir verbete"
        >
          Excluir
        </button>
      </header>

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
              contentRef.current?.focus();
            }
          }}
          placeholder="Título"
          maxLength={200}
          autoFocus={!note}
        />
        <p className={`note-editor__status${saveState === "error" ? " note-editor__status--error" : ""}`} role="status">
          {statusText}
        </p>
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
        <textarea
          ref={contentRef}
          className="note-editor__content"
          value={content}
          onChange={event => edit({ content: event.target.value })}
          placeholder="Escreva o verbete..."
        />
        {createdAt && updatedAt && <p className="note-editor__register">{registerText(createdAt, updatedAt)}</p>}
      </section>
    </article>
  );
}
