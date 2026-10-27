import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { categoryColor, loadCategories, type CategoryItem } from "../lib/categories";
import { loadNotes, type NoteItem } from "../lib/notes";
import {
  createSubgroup,
  deleteSubgroup,
  findSubgroupByName,
  loadSubgroups,
  renameSubgroup,
  setSubgroupCollapsed,
  type SubgroupItem,
} from "../lib/subgroups";
import type { WorldItem } from "../lib/worlds";
import CategoryManager from "./CategoryManager.tsx";
import NoteEditor from "./NoteEditor.tsx";
import NoteTree from "./NoteTree.tsx";
import "./CSS/Notes.css";

// Which note the middle pane shows. id is null for a new note until its first save; key stays the same through
// that save, so the editor isn't remounted while someone is typing.
type OpenNote = { id: string | null; subgroupId: string | null; key: number };

type WorldNotesProps = {
  world: WorldItem;
  onBack: () => void;
  // Set while this screen is shown: App calls it on the Android back button, and it returns true when it
  // handled the press (closed the sidebar or the open note) instead of leaving the volume.
  backHandler: RefObject<(() => boolean) | null>;
};

let openCount = 0;

const SIDEBAR_HIDDEN_KEY = "archivist.sidebarHidden";

// Matches the phone layout in Notes.css, where the sidebar is a drawer over the note.
const NARROW_QUERY = "(max-width: 799px)";

function isNarrow() {
  return window.matchMedia(NARROW_QUERY).matches;
}

// Phones always start with the drawer closed; wider screens remember whether the sidebar was hidden.
function initialSidebarHidden() {
  if (isNarrow()) return true;
  try {
    return localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Case- and accent-insensitive, so "missao" finds "Missão".
function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// Alphabetical, like an index, so rows don't move while a note is being edited. Untitled notes go last.
function byTitle(a: NoteItem, b: NoteItem) {
  const untitled = Number(!a.title.trim()) - Number(!b.title.trim());
  return untitled || a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
}

function byName(a: SubgroupItem, b: SubgroupItem) {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
}

// The open volume: the listing in a sidebar on the left and the open note in the middle. On narrow screens they
// take turns: the listing, or the note with a way back to it.
export default function WorldNotes({ world, onBack, backHandler }: WorldNotesProps) {
  const [openNote, setOpenNote] = useState<OpenNote | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [subgroups, setSubgroups] = useState<SubgroupItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [treeError, setTreeError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [addingSubgroup, setAddingSubgroup] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(initialSidebarHidden);
  const accent = world.accent_color ?? "#f5a7a1";

  const categoryName = (id: string | null) => categories.find(category => category.id === id)?.name ?? "";
  const subgroupName = (id: string | null) => subgroups.find(subgroup => subgroup.id === id)?.name ?? "";
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const filtering = terms.length > 0 || categoryId !== null;
  const visibleNotes = notes
    .filter(note => {
      if (categoryId && note.category_id !== categoryId) return false;
      const text = normalize(
        `${note.title} ${note.content} ${categoryName(note.category_id)} ${subgroupName(note.subgroup_id)}`,
      );
      return terms.every(term => text.includes(term));
    })
    .sort(byTitle);
  const countText = notes.length === 1 ? "1 verbete" : `${notes.length} verbetes`;

  const categoryNoteCounts: Record<string, number> = {};
  for (const note of notes) {
    if (note.category_id) categoryNoteCounts[note.category_id] = (categoryNoteCounts[note.category_id] ?? 0) + 1;
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [worldNotes, worldSubgroups, worldCategories] = await Promise.all([
          loadNotes(world.id),
          loadSubgroups(world.id),
          loadCategories(world.id),
        ]);
        setNotes(worldNotes);
        setSubgroups(worldSubgroups.sort(byName));
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

  // Crossing into the phone layout closes the drawer; going back to a wide window restores the saved choice.
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const handleChange = () => setSidebarHidden(initialSidebarHidden());
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const toggleSidebar = (hidden: boolean) => {
    setSidebarHidden(hidden);
    if (isNarrow()) return;
    try {
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, hidden ? "1" : "0");
    } catch {
      // Only a convenience; the sidebar just shows again next time.
    }
  };

  useEffect(() => {
    backHandler.current = () => {
      if (isNarrow() && !sidebarHidden) {
        setSidebarHidden(true);
        return true;
      }
      if (openNote) {
        setOpenNote(null);
        return true;
      }
      return false;
    };
  });

  useEffect(() => {
    return () => {
      backHandler.current = null;
    };
  }, []);

  // On phones the drawer closes once a note is picked, so the note is what's left in view.
  const open = (next: OpenNote) => {
    setOpenNote(next);
    if (isNarrow()) setSidebarHidden(true);
  };

  const openExisting = (note: NoteItem) => {
    if (openNote?.id === note.id) {
      if (isNarrow()) setSidebarHidden(true);
      return;
    }
    open({ id: note.id, subgroupId: note.subgroup_id, key: ++openCount });
  };

  const openNew = (subgroupId: string | null) => {
    open({ id: null, subgroupId, key: ++openCount });
  };

  // The editor reports every save. A new note's first save also gives the open note its id, unless the user
  // has already moved on to another one.
  const handleSaved = (saved: NoteItem, key: number) => {
    setNotes(current =>
      current.some(note => note.id === saved.id)
        ? current.map(note => (note.id === saved.id ? saved : note))
        : [...current, saved],
    );
    setOpenNote(open => (open && open.key === key && open.id === null ? { ...open, id: saved.id } : open));
  };

  const handleDeleted = (id: string) => {
    setNotes(current => current.filter(note => note.id !== id));
    setOpenNote(open => (open?.id === id ? null : open));
  };

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

  const addSubgroup = async (name: string) => {
    setAddingSubgroup(false);
    if (!name.trim()) return;

    const existing = findSubgroupByName(subgroups, name);
    if (existing) {
      if (existing.collapsed) toggleSubgroup(existing);
      return;
    }

    try {
      const created = await createSubgroup(world.id, name);
      setSubgroups(current => [...current, created].sort(byName));
      setTreeError("");
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao criar subgrupo.");
    }
  };

  const renameSubgroupTo = async (subgroup: SubgroupItem, name: string) => {
    const trimmed = name.trim();
    if (trimmed === subgroup.name) return true;

    if (!trimmed) {
      setTreeError("O nome do subgrupo não pode ficar vazio.");
      return false;
    }

    // A change of case only matches the subgroup itself, which is allowed.
    const existing = findSubgroupByName(subgroups, trimmed);
    if (existing && existing.id !== subgroup.id) {
      setTreeError(`Já existe um subgrupo “${existing.name}”.`);
      return false;
    }

    try {
      await renameSubgroup(subgroup.id, trimmed);
      setSubgroups(current =>
        current.map(item => (item.id === subgroup.id ? { ...item, name: trimmed } : item)).sort(byName),
      );
      setTreeError("");
      return true;
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao renomear subgrupo.");
      return false;
    }
  };

  // Its notes stay in the volume, outside any subgroup (the database's on delete set null).
  const removeSubgroup = async (subgroup: SubgroupItem) => {
    const count = notes.filter(note => note.subgroup_id === subgroup.id).length;
    const warning = count ? ` ${count === 1 ? "1 verbete sairá" : `${count} verbetes sairão`} do subgrupo.` : "";
    if (!window.confirm(`Excluir o subgrupo “${subgroup.name}”?${warning}`)) return;

    try {
      await deleteSubgroup(subgroup.id);
      setSubgroups(current => current.filter(item => item.id !== subgroup.id));
      setNotes(current =>
        current.map(note => (note.subgroup_id === subgroup.id ? { ...note, subgroup_id: null } : note)),
      );
      setTreeError("");
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao excluir subgrupo.");
    }
  };

  const toggleSubgroup = (subgroup: SubgroupItem) => {
    const collapsed = !subgroup.collapsed;
    setSubgroups(current => current.map(item => (item.id === subgroup.id ? { ...item, collapsed } : item)));
    setSubgroupCollapsed(subgroup.id, collapsed).catch(err =>
      setTreeError(err instanceof Error ? err.message : "Erro ao salvar o subgrupo."),
    );
  };

  const emptyFilterText = terms.length
    ? `Nenhum verbete encontrado para “${query.trim()}”${categoryId ? ` em ${categoryName(categoryId)}` : ""}.`
    : `Nenhum verbete em ${categoryName(categoryId)} ainda.`;

  const openNoteItem = openNote?.id ? notes.find(note => note.id === openNote.id) ?? null : null;

  const showSidebarButton: ReactNode = sidebarHidden && (
    <button
      type="button"
      aria-label="Mostrar a lista"
      title="Mostrar a lista"
      className="binder-icon-button volume__show"
      onClick={() => toggleSidebar(false)}
    >
      »
    </button>
  );

  const rootClass = [
    "volume",
    openNote ? "volume--note-open" : "",
    sidebarHidden ? "volume--sidebar-hidden" : "",
  ].join(" ");

  return (
    <main className={rootClass} style={{ "--world": accent } as React.CSSProperties}>
      {!sidebarHidden && <div className="volume__backdrop" onClick={() => toggleSidebar(true)} />}

      <aside className="volume__sidebar">
        <header className="volume__band">
          <button type="button" aria-label="Voltar para os volumes" className="volume__band-button" onClick={onBack}>
            ←
          </button>
          <div className="volume__band-text">
            <h1 className="volume__title">
              <span className="volume__icon" aria-hidden="true">
                {world.icon ?? "✎"}
              </span>
              {world.name}
            </h1>
            {!loading && !error && (
              <p className="volume__count" aria-live="polite">
                {filtering ? `${visibleNotes.length} de ${countText}` : countText}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Esconder a lista"
            title="Esconder a lista"
            className="volume__band-button volume__hide"
            onClick={() => toggleSidebar(true)}
          >
            «
          </button>
        </header>

        {notes.length > 0 && (
          <input
            type="search"
            className="volume__search"
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

        {managingCategories ? (
          <CategoryManager
            categories={categories}
            noteCounts={categoryNoteCounts}
            onRenamed={handleCategoryRenamed}
            onDeleted={handleCategoryDeleted}
            onClose={() => setManagingCategories(false)}
          />
        ) : (
          categories.length > 0 && (
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
          )
        )}

        <div className="volume__tree">
          {loading ? (
            <p className="volume__status">Carregando verbetes...</p>
          ) : error ? (
            <p className="volume__status volume__status--error">{error}</p>
          ) : (
            <>
              {notes.length === 0 && subgroups.length === 0 && !addingSubgroup && (
                <p className="volume__status">
                  Esta gaveta ainda está vazia. Comece um verbete ou crie subgrupos para organizar o volume.
                </p>
              )}
              {filtering && visibleNotes.length === 0 && <p className="volume__status">{emptyFilterText}</p>}
              <NoteTree
                notes={visibleNotes}
                subgroups={subgroups}
                categories={categories}
                openNoteId={openNote?.id ?? null}
                filtering={filtering}
                addingSubgroup={addingSubgroup}
                onOpen={openExisting}
                onNewNote={openNew}
                onToggle={toggleSubgroup}
                onAddSubgroup={addSubgroup}
                onRename={renameSubgroupTo}
                onDelete={removeSubgroup}
              />
              {treeError && (
                <p className="volume__status volume__status--error" role="alert">
                  {treeError}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="volume__actions">
          <button type="button" className="binder-button volume__new-note" onClick={() => openNew(null)}>
            <span aria-hidden="true">+</span> Verbete
          </button>
          <button type="button" className="binder-button volume__new-subgroup" onClick={() => setAddingSubgroup(true)}>
            <span aria-hidden="true">+</span> Subgrupo
          </button>
        </footer>
      </aside>

      {/* Blank until a note is opened. */}
      <section className="volume__main">
        {openNote && !loading ? (
          <NoteEditor
            key={openNote.key}
            headStart={showSidebarButton}
            world={world}
            note={openNoteItem}
            initialSubgroupId={openNote.subgroupId}
            categories={categories}
            subgroups={subgroups}
            onCategoryCreated={created => setCategories(current => [...current, created])}
            onSaved={saved => handleSaved(saved, openNote.key)}
            onDeleted={handleDeleted}
            onClose={() => setOpenNote(null)}
          />
        ) : (
          showSidebarButton && <div className="volume__blank">{showSidebarButton}</div>
        )}
      </section>
    </main>
  );
}
