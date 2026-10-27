import { useEffect, useRef, useState } from "react";
import { createCategory, findCategoryByName, loadCategories, type CategoryItem } from "../lib/categories";
import { createNote, deleteNote, updateNote, type NoteDraft, type NoteItem } from "../lib/notes";
import type { WorldItem } from "../lib/worlds";
import "./CSS/Notes.css";

type NoteEditorProps = {
  world: WorldItem;
  // null starts a new note, which is only inserted once it has some text.
  note: NoteItem | null;
  onBack: () => void;
};

type SaveState = "saved" | "pending" | "error";

const AUTOSAVE_DELAY_MS = 800;

export default function NoteEditor({ world, note, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [categoryId, setCategoryId] = useState(note?.category_id ?? null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useRef(note?.id ?? null);
  const draft = useRef<NoteDraft>({ title, content, categoryId });
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

    if (!noteId.current) {
      if (!current.title.trim() && !current.content.trim()) return;
      noteId.current = await createNote(world.id, current);
      return;
    }

    await updateNote(noteId.current, current);
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
        setError(err instanceof Error ? err.message : "Erro ao salvar nota.");
      });

    return queue.current;
  };

  const edit = (changes: Partial<NoteDraft>) => {
    const next = { ...draft.current, ...changes };
    setTitle(next.title);
    setContent(next.content);
    setCategoryId(next.categoryId);
    draft.current = next;
    dirty.current = true;
    setSaveState("pending");

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  };

  useEffect(() => {
    loadCategories(world.id)
      .then(setCategories)
      .catch(err => setError(err instanceof Error ? err.message : "Erro ao carregar categorias."));
  }, [world.id]);

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
      setCategories(current => [...current, created]);
      edit({ categoryId: created.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    }
  };

  // Leaving the screen another way (e.g. the Android back button) still saves pending edits.
  useEffect(() => {
    return () => {
      if (dirty.current) save();
    };
  }, []);

  const handleBack = async () => {
    await save();
    if (!dirty.current) onBack();
  };

  const handleDelete = async () => {
    if (!noteId.current) {
      dirty.current = false;
      onBack();
      return;
    }

    if (!window.confirm("Excluir esta nota?")) return;

    try {
      setDeleting(true);
      if (timer.current) clearTimeout(timer.current);
      dirty.current = false;
      await queue.current;

      await deleteNote(noteId.current);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir nota.");
      setDeleting(false);
    }
  };

  const statusText = error || (saveState === "pending" ? "Salvando..." : "Salvo");

  return (
    <main
      className="notes notes--editor"
      style={{ "--world": world.accent_color ?? "#f5a7a1" } as React.CSSProperties}
    >
      <header className="notes__topbar">
        <button type="button" aria-label="Voltar para as notas" className="binder-icon-button" onClick={handleBack}>
          ←
        </button>
        <span className="notes__world-chip">{world.name}</span>
        <button
          type="button"
          className="notes__delete-button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Excluir nota"
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
          placeholder="Escreva sua nota..."
        />
      </section>
    </main>
  );
}
