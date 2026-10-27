import { useEffect, useState } from "react";
import { categoryColor, loadCategories, type CategoryItem } from "../lib/categories";
import { loadNotes, type NoteItem } from "../lib/notes";
import type { WorldItem } from "../lib/worlds";
import CategoryManager from "./CategoryManager.tsx";
import "./CSS/Notes.css";

type WorldNotesProps = {
  world: WorldItem;
  onBack: () => void;
  onOpenNote: (note: NoteItem | null) => void;
};

// The card's stamp: "21 out", with the year only when it isn't the current one.
function stampDate(value: string) {
  const date = new Date(value);
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const year = date.getFullYear() === new Date().getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${date.getDate()} ${month}${year}`;
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
  const countText = notes.length === 1 ? "1 verbete" : `${notes.length} verbetes`;

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
    ? `Nenhum verbete encontrado para “${query.trim()}”${categoryId ? ` em ${categoryName(categoryId)}` : ""}.`
    : `Nenhum verbete em ${categoryName(categoryId)} ainda.`;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [worldNotes, worldCategories] = await Promise.all([loadNotes(world.id), loadCategories(world.id)]);
        setNotes(worldNotes);
        setCategories(worldCategories);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar verbetes.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [world.id]);

  return (
    <main className="notes" style={{ "--world": accent } as React.CSSProperties}>
      <header className="notes__topbar">
        <button type="button" aria-label="Voltar para os volumes" className="binder-icon-button" onClick={onBack}>
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
            placeholder="Buscar no volume"
            aria-label="Buscar verbetes deste volume"
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
            <p className="notes__status">Carregando verbetes...</p>
          ) : error ? (
            <p className="notes__status notes__status--error">{error}</p>
          ) : notes.length === 0 ? (
            <p className="notes__status">
              Esta gaveta ainda está vazia. Registre aqui os lugares, personagens e sessões deste volume.
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
                      style={{ "--category": categoryColor(categories, category.id) } as React.CSSProperties}
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
                <ul className="notes__list" aria-label="Verbetes">
                  {visibleNotes.map(note => (
                    <li key={note.id}>
                      {/* An index card; its category is the tab on top. */}
                      <button
                        type="button"
                        className="note-card"
                        style={
                          note.category_id
                            ? ({ "--category": categoryColor(categories, note.category_id) } as React.CSSProperties)
                            : undefined
                        }
                        onClick={() => onOpenNote(note)}
                      >
                        {categoryName(note.category_id) && (
                          <span className="note-card__tab">{categoryName(note.category_id)}</span>
                        )}
                        <span className="note-card__head">
                          <span className={`note-card__title${note.title.trim() ? "" : " note-card__title--untitled"}`}>
                            {note.title.trim() || "Sem título"}
                          </span>
                          <time className="note-card__stamp" dateTime={note.updated_at}>
                            Arquivado · {stampDate(note.updated_at)}
                          </time>
                        </span>
                        {note.content.trim() && <span className="note-card__preview">{note.content.trim()}</span>}
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
          Novo verbete
        </button>
      </div>
    </main>
  );
}
