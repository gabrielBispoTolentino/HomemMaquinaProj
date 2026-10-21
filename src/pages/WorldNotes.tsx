import { useEffect, useState } from "react";
import { loadCategories, type CategoryItem } from "../lib/categories";
import { getSupabaseClient } from "../lib/supabase";
import CategoryManager from "./CategoryManager.tsx";
import type { WorldItem } from "./WorldList.tsx";
import "./CSS/Notes.css";

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  updated_at: string;
};

type WorldNotesProps = {
  world: WorldItem;
  onBack: () => void;
  onOpenNote: (note: NoteItem | null) => void;
};

// "21 de out.", with the year only when it isn't the current one.
function formatDate(value: string) {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
}

// Case- and accent-insensitive, so "missao" finds "Missão".
function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function WorldNotes({ world, onBack, onOpenNote }: WorldNotesProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const accent = world.accent_color ?? "#f5a7a1";

  const categoryName = (id: string | null) => categories.find(category => category.id === id)?.name ?? "";
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const filtering = terms.length > 0 || categoryId !== null;
  const visibleNotes = notes.filter(note => {
    if (categoryId && note.category_id !== categoryId) return false;
    const text = normalize(`${note.title} ${note.content} ${categoryName(note.category_id)}`);
    return terms.every(term => text.includes(term));
  });
  const countText = notes.length === 1 ? "1 nota" : `${notes.length} notas`;

  const categoryNoteCounts: Record<string, number> = {};
  for (const note of notes) {
    if (note.category_id) categoryNoteCounts[note.category_id] = (categoryNoteCounts[note.category_id] ?? 0) + 1;
  }

  const handleCategoryRenamed = (renamed: CategoryItem) => {
    setCategories(current => current.map(category => (category.id === renamed.id ? renamed : category)));
  };

  // Mirrors the database's on delete set null, so the list doesn't need a reload.
  const handleCategoryDeleted = (id: string) => {
    const remaining = categories.filter(category => category.id !== id);
    setCategories(remaining);
    setNotes(current => current.map(note => (note.category_id === id ? { ...note, category_id: null } : note)));
    if (categoryId === id) setCategoryId(null);
    if (remaining.length === 0) setManagingCategories(false);
  };

  const emptyFilterText = terms.length
    ? `Nenhuma nota encontrada para “${query.trim()}”${categoryId ? ` em ${categoryName(categoryId)}` : ""}.`
    : `Nenhuma nota em ${categoryName(categoryId)} ainda.`;

  useEffect(() => {
    const loadNotes = async () => {
      try {
        setLoading(true);
        setError("");

        const supabase = getSupabaseClient();
        const [{ data, error: selectError }, worldCategories] = await Promise.all([
          supabase
            .from("notes")
            .select("id, title, content, category_id, updated_at")
            .eq("world_id", world.id)
            .order("updated_at", { ascending: false }),
          loadCategories(world.id),
        ]);

        if (selectError) {
          throw selectError;
        }

        setNotes(data ?? []);
        setCategories(worldCategories);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar notas.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [world.id]);

  return (
    <main className="notes" style={{ "--world": accent } as React.CSSProperties}>
      <header className="notes__topbar">
        <button type="button" aria-label="Voltar para mundos" className="binder-icon-button" onClick={onBack}>
          ←
        </button>
        {notes.length > 0 && (
          <input
            type="search"
            className="notes__search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Buscar notas"
            aria-label="Buscar notas deste mundo"
            enterKeyHint="search"
          />
        )}
      </header>

      <section className="notes__binder">
        <div className="notes__band">
          <span className="notes__band-tab" aria-hidden="true">
            {world.icon ?? "✎"}
          </span>
          <h1 className="notes__band-title">{world.name}</h1>
          {!loading && !error && (
            <p className="notes__band-count" aria-live="polite">
              {filtering ? `${visibleNotes.length} de ${countText}` : countText}
            </p>
          )}
        </div>

        <div className="notes__sheet">
          {loading ? (
            <p className="notes__status">Carregando notas...</p>
          ) : error ? (
            <p className="notes__status notes__status--error">{error}</p>
          ) : notes.length === 0 ? (
            <p className="notes__status">
              Nenhuma nota ainda. Registre aqui os lugares, personagens e sessões deste mundo.
            </p>
          ) : (
            <>
              {managingCategories ? (
                <CategoryManager
                  categories={categories}
                  noteCounts={categoryNoteCounts}
                  onRenamed={handleCategoryRenamed}
                  onDeleted={handleCategoryDeleted}
                  onClose={() => setManagingCategories(false)}
                />
              ) : categories.length > 0 && (
                <div className="notes__filters" role="group" aria-label="Filtrar por categoria">
                  <button
                    type="button"
                    className="category-chip"
                    aria-pressed={categoryId === null}
                    onClick={() => setCategoryId(null)}
                  >
                    Todas
                  </button>
                  {categories.map(category => (
                    <button
                      key={category.id}
                      type="button"
                      className="category-chip"
                      aria-pressed={categoryId === category.id}
                      onClick={() => setCategoryId(categoryId === category.id ? null : category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="category-chip category-chip--add"
                    onClick={() => setManagingCategories(true)}
                  >
                    Editar
                  </button>
                </div>
              )}
              {visibleNotes.length === 0 ? (
                <p className="notes__status">{emptyFilterText}</p>
              ) : (
                <ul className="notes__list" aria-label="Notas">
                  {visibleNotes.map(note => (
                    <li key={note.id}>
                      <button type="button" className="note-entry" onClick={() => onOpenNote(note)}>
                        <span className="note-entry__head">
                          <span className={`note-entry__title${note.title.trim() ? "" : " note-entry__title--untitled"}`}>
                            {note.title.trim() || "Sem título"}
                          </span>
                          <time className="note-entry__date" dateTime={note.updated_at}>
                            {formatDate(note.updated_at)}
                          </time>
                        </span>
                        {note.content.trim() && <span className="note-entry__preview">{note.content.trim()}</span>}
                        {categoryName(note.category_id) && (
                          <span className="note-entry__category">{categoryName(note.category_id)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      <div className="notes__new">
        <button type="button" className="binder-button notes__new-button" onClick={() => onOpenNote(null)}>
          <span aria-hidden="true">+</span>
          Nova nota
        </button>
      </div>
    </main>
  );
}
