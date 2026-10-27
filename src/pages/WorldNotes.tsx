import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { categoryColor, createCategory, findCategoryByName, loadCategories, type CategoryItem } from "../lib/categories";
import { featureOn, type FeatureId } from "../lib/features";
import { loadNotes, moveNote, type NoteDraft, type NoteItem } from "../lib/notes";
import { childrenOf, endPosition, placeAmong, type Placement } from "../lib/order";
import {
  createSubgroup,
  deleteSubgroup,
  findSubgroupByName,
  loadSubgroups,
  moveSubgroup,
  planSubgroupDelete,
  renameSubgroup,
  setSubgroupCollapsed,
  subgroupPaths,
  subtreeIds,
  type SubgroupItem,
} from "../lib/subgroups";
import { loadWritingStats, NOTE_STATUSES, setDailyGoal, type WritingStats } from "../lib/writing";
import { templatesFor, type NoteTemplate } from "../lib/volumeKinds";
import { setWorldFeatures, setWorldKind, worldFeatures, type WorldItem } from "../lib/worlds";
import CategoryManager from "./CategoryManager.tsx";
import Corkboard from "./Corkboard.tsx";
import GameTable from "./GameTable.tsx";
import ManuscriptView from "./ManuscriptView.tsx";
import NameCheck from "./NameCheck.tsx";
import NoteEditor from "./NoteEditor.tsx";
import NoteTree from "./NoteTree.tsx";
import RelationshipMap from "./RelationshipMap.tsx";
import TimelineView from "./TimelineView.tsx";
import VolumeSettings from "./VolumeSettings.tsx";
import { useDragDrop, type DragSource } from "./useDragDrop.tsx";
import WritingGoal from "./WritingGoal.tsx";
import "./CSS/Notes.css";

// What the middle pane shows: a note (id is null for a new note until its first save, and preset holds a
// template's starting text), a subgroup (null for the whole volume) read as a manuscript or pinned up on the
// corkboard, or one of the volume-wide views. key stays the same through a new note's first save, so the editor
// isn't remounted while someone is typing.
type View =
  | { kind: "note"; id: string | null; subgroupId: string | null; preset?: Partial<NoteDraft>; key: number }
  | { kind: "manuscript" | "board"; subgroupId: string | null; key: number }
  | { kind: "settings" | "timeline" | "graph" | "names" | "table"; key: number };

// The volume-wide views, as buttons under the volume's name, each shown when its feature is on.
const VOLUME_VIEWS = [
  { kind: "manuscript", feature: "manuscript", label: "Manuscrito" },
  { kind: "board", feature: "corkboard", label: "Quadro" },
  { kind: "timeline", feature: "timeline", label: "Linha do tempo" },
  { kind: "graph", feature: "graph", label: "Mapa" },
  { kind: "names", feature: "names", label: "Nomes" },
  { kind: "table", feature: "gmtools", label: "Mesa" },
] as const;

// Where a dragged item would land: before or after a note or subgroup, inside a subgroup (at its end), or at the
// end of a list ("end", whose id is the list's subgroup, or null for the top of the volume).
export type DropIntent =
  | { kind: "note" | "subgroup"; id: string; where: "before" | "after" | "inside" }
  | { kind: "end"; id: string | null; where: "inside" };

type WorldNotesProps = {
  world: WorldItem;
  onBack: () => void;
  // Set while this screen is shown: App calls it on the Android back button, and it returns true when it
  // handled the press (closed the sidebar or what's open in the middle) instead of leaving the volume.
  backHandler: RefObject<(() => boolean) | null>;
};

let viewCount = 0;

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

// The open volume: the listing in a sidebar on the left and, in the middle, the open note, manuscript or
// corkboard. On phones the sidebar is a drawer over the middle.
export default function WorldNotes({ world: initialWorld, onBack, backHandler }: WorldNotesProps) {
  // A copy, since the volume's features and model change here.
  const [world, setWorld] = useState(initialWorld);
  const features = worldFeatures(world);
  const on = (id: FeatureId) => featureOn(features, id);
  const [view, setView] = useState<View | null>(null);
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [subgroups, setSubgroups] = useState<SubgroupItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stats, setStats] = useState<WritingStats>({ goal: null, today: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [treeError, setTreeError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [managingCategories, setManagingCategories] = useState(false);
  // Where the new-subgroup field shows: undefined for nowhere, null for the top of the volume.
  const [addingIn, setAddingIn] = useState<string | null | undefined>(undefined);
  const [sidebarHidden, setSidebarHidden] = useState(initialSidebarHidden);
  const accent = world.accent_color ?? "#f5a7a1";
  const openNote = view?.kind === "note" ? view : null;

  const categoryName = (id: string | null) => categories.find(category => category.id === id)?.name ?? "";
  // A note's whole path is searchable, so "capitulo" also finds the notes nested deeper inside it.
  const paths = new Map(subgroupPaths(subgroups).map(path => [path.id, path.label]));
  const subgroupPath = (id: string | null) => (id ? paths.get(id) ?? "" : "");
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const filtering = terms.length > 0 || categoryId !== null || (on("status") && statusFilter !== "");
  const visibleNotes = notes.filter(note => {
    if (categoryId && note.category_id !== categoryId) return false;
    if (on("status") && statusFilter && (note.status ?? "none") !== statusFilter) return false;
    const fieldText = note.fields.map(field => `${field.key} ${field.value}`).join(" ");
    const text = normalize(
      `${note.title} ${note.content} ${note.synopsis} ${fieldText} ${note.timeline} ${categoryName(note.category_id)} ${subgroupPath(note.subgroup_id)}`,
    );
    return terms.every(term => text.includes(term));
  });
  const countText = notes.length === 1 ? "1 verbete" : `${notes.length} verbetes`;

  const categoryNoteCounts: Record<string, number> = {};
  for (const note of notes) {
    if (note.category_id) categoryNoteCounts[note.category_id] = (categoryNoteCounts[note.category_id] ?? 0) + 1;
  }

  const refreshStats = () => {
    loadWritingStats(world.id)
      .then(setStats)
      .catch(() => {
        // The goal strip just keeps its last numbers.
      });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [worldNotes, worldSubgroups, worldCategories, worldStats] = await Promise.all([
          loadNotes(world.id),
          loadSubgroups(world.id),
          loadCategories(world.id),
          loadWritingStats(world.id),
        ]);
        setNotes(worldNotes);
        setSubgroups(worldSubgroups);
        setCategories(worldCategories);
        setStats(worldStats);
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
      if (view) {
        setView(null);
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

  // On phones the drawer closes once something is picked, so it's what's left in view.
  const show = (next: View) => {
    setView(next);
    if (isNarrow()) setSidebarHidden(true);
  };

  const openExisting = (note: NoteItem) => {
    if (openNote?.id === note.id) {
      if (isNarrow()) setSidebarHidden(true);
      return;
    }
    show({ kind: "note", id: note.id, subgroupId: note.subgroup_id, key: ++viewCount });
  };

  const showManuscript = (subgroupId: string | null) => show({ kind: "manuscript", subgroupId, key: ++viewCount });
  const showBoard = (subgroupId: string | null) => show({ kind: "board", subgroupId, key: ++viewCount });
  const showVolumeView = (kind: (typeof VOLUME_VIEWS)[number]["kind"] | "settings") =>
    kind === "manuscript" || kind === "board"
      ? show({ kind, subgroupId: null, key: ++viewCount })
      : show({ kind, key: ++viewCount });

  const toggleFeature = async (id: FeatureId, enabled: boolean) => {
    const next = new Set(features);
    if (enabled) next.add(id);
    else next.delete(id);
    try {
      const stored = await setWorldFeatures(world.id, next);
      setWorld(current => ({ ...current, features: stored }));
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao salvar os recursos.");
    }
  };

  const changeKind = async (kind: string | null) => {
    try {
      await setWorldKind(world.id, kind);
      setWorld(current => ({ ...current, kind }));
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao salvar o volume.");
    }
  };

  // The editor reports every save. A new note's first save also gives the open note its id, unless the user
  // has already moved on to something else. The listing keeps its own position for a note it already has.
  const handleSaved = (saved: NoteItem, key: number) => {
    setNotes(current =>
      current.some(note => note.id === saved.id)
        ? current.map(note => (note.id === saved.id ? { ...saved, position: note.position } : note))
        : [...current, saved],
    );
    setView(open => (open?.kind === "note" && open.key === key && open.id === null ? { ...open, id: saved.id } : open));
    refreshStats();
  };

  const handleDeleted = (id: string) => {
    setNotes(current => current.filter(note => note.id !== id));
    setView(open => (open?.kind === "note" && open.id === id ? null : open));
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

  const setCollapsed = (subgroup: SubgroupItem, collapsed: boolean) => {
    setSubgroups(current => current.map(item => (item.id === subgroup.id ? { ...item, collapsed } : item)));
    setSubgroupCollapsed(subgroup.id, collapsed).catch(err =>
      setTreeError(err instanceof Error ? err.message : "Erro ao salvar o subgrupo."),
    );
  };

  // Opens the subgroup and every subgroup around it, so something just put inside it is in view.
  const expandTo = (id: string | null) => {
    for (let current = subgroups.find(item => item.id === id); current; ) {
      if (current.collapsed) setCollapsed(current, false);
      const parentId: string | null = current.parentId;
      current = subgroups.find(item => item.id === parentId);
    }
  };

  const openNewIn = (subgroupId: string | null) => {
    expandTo(subgroupId);
    show({ kind: "note", id: null, subgroupId, key: ++viewCount });
  };

  // A note from a template: its category (created if the volume doesn't have it yet), fields and text, filed in
  // the template's subgroup when the volume has one by that name at the top.
  const openFromTemplate = async (template: NoteTemplate) => {
    setChoosingTemplate(false);
    try {
      let category = template.category ? findCategoryByName(categories, template.category) : undefined;
      if (template.category && !category) {
        category = await createCategory(world.id, template.category);
        const created = category;
        setCategories(current => [...current, created]);
      }
      const subgroup = template.subgroup ? findSubgroupByName(subgroups, template.subgroup, null) : undefined;
      expandTo(subgroup?.id ?? null);
      show({
        kind: "note",
        id: null,
        subgroupId: subgroup?.id ?? null,
        preset: {
          content: template.content ?? "",
          categoryId: category?.id ?? null,
          fields: (template.fields ?? []).map(key => ({ key, value: "" })),
        },
        key: ++viewCount,
      });
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao usar o modelo.");
    }
  };

  const templateGroups = on("templates") ? templatesFor(world.kind) : [];

  const startSubgroupIn = (parentId: string | null) => {
    expandTo(parentId);
    setAddingIn(parentId);
  };

  const addSubgroup = async (name: string, parentId: string | null) => {
    setAddingIn(undefined);
    if (!name.trim()) return;

    const existing = findSubgroupByName(subgroups, name, parentId);
    if (existing) {
      expandTo(existing.id);
      return;
    }

    try {
      const created = await createSubgroup(world.id, name, parentId, endPosition());
      setSubgroups(current => [...current, created]);
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
    const existing = findSubgroupByName(subgroups, trimmed, subgroup.parentId);
    if (existing && existing.id !== subgroup.id) {
      setTreeError(`Já existe um subgrupo “${existing.name}” aqui.`);
      return false;
    }

    try {
      await renameSubgroup(subgroup.id, trimmed);
      setSubgroups(current => current.map(item => (item.id === subgroup.id ? { ...item, name: trimmed } : item)));
      setTreeError("");
      return true;
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao renomear subgrupo.");
      return false;
    }
  };

  // Moves a note or subgroup to a placement worked out by placeAmong, in the database and on screen.
  const applyMove = async (source: { kind: "note" | "subgroup"; id: string }, placement: Placement) => {
    const { parentId, position, respaced } = placement;

    if (source.kind === "subgroup") {
      const subgroup = subgroups.find(item => item.id === source.id);
      if (!subgroup) return;
      const clash = parentId !== subgroup.parentId && findSubgroupByName(subgroups, subgroup.name, parentId);
      if (clash) {
        setTreeError(`Já existe um subgrupo “${clash.name}” lá.`);
        return;
      }
    }

    const newPosition = (kind: "note" | "subgroup", id: string, old: number) =>
      respaced.find(item => item.kind === kind && item.id === id)?.position ?? old;

    try {
      if (source.kind === "note") await moveNote(source.id, placement);
      else await moveSubgroup(source.id, placement);

      setNotes(current =>
        current.map(note =>
          note.id === source.id && source.kind === "note"
            ? { ...note, subgroup_id: parentId, position }
            : { ...note, position: newPosition("note", note.id, note.position) },
        ),
      );
      setSubgroups(current =>
        current.map(item =>
          item.id === source.id && source.kind === "subgroup"
            ? { ...item, parentId, position }
            : { ...item, position: newPosition("subgroup", item.id, item.position) },
        ),
      );
      expandTo(parentId);
      setTreeError("");
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao mover.");
    }
  };

  // "Mover para…" in a subgroup's menu: to the end of the chosen place.
  const moveSubgroupTo = (subgroup: SubgroupItem, parentId: string | null) => {
    const siblings = childrenOf(parentId, notes, subgroups).filter(child => child.item.id !== subgroup.id);
    applyMove({ kind: "subgroup", id: subgroup.id }, placeAmong(parentId, siblings, null, "after"));
  };

  const parentOf = (kind: "note" | "subgroup", id: string) =>
    kind === "note"
      ? notes.find(note => note.id === id)?.subgroup_id ?? null
      : subgroups.find(subgroup => subgroup.id === id)?.parentId ?? null;

  // A subgroup can't go inside itself or anything nested in it.
  const canGoInto = (source: DragSource, parentId: string | null) =>
    source.kind === "note" || parentId === null || !subtreeIds(subgroups, source.id).has(parentId);

  // The listing is a column, so the pointer's height decides; the corkboard flows in rows, so its left-right does.
  const resolveDrop =
    (axis: "x" | "y") =>
    (source: DragSource, target: HTMLElement, x: number, y: number): DropIntent | null => {
      if (target.dataset.drop === "end") {
        const parentId = target.dataset.parent || null;
        return canGoInto(source, parentId) ? { kind: "end", id: parentId, where: "inside" } : null;
      }

      const kind = target.dataset.kind as "note" | "subgroup";
      const id = target.dataset.id!;
      if (kind === source.kind && id === source.id) return null;

      const rect = target.getBoundingClientRect();
      const ratio = axis === "y" ? (y - rect.top) / rect.height : (x - rect.left) / rect.width;
      const where = kind === "subgroup" && ratio > 0.25 && ratio < 0.75 ? "inside" : ratio < 0.5 ? "before" : "after";
      const parentId = where === "inside" ? id : parentOf(kind, id);
      return canGoInto(source, parentId) ? { kind, id, where } : null;
    };

  const handleDrop = (source: DragSource, intent: DropIntent) => {
    const into = intent.kind === "end" || intent.where === "inside";
    const parentId = intent.kind === "end" ? intent.id : into ? intent.id : parentOf(intent.kind, intent.id);
    const siblings = childrenOf(parentId, notes, subgroups).filter(
      child => !(child.kind === source.kind && child.item.id === source.id),
    );
    const anchor = into ? null : `${intent.kind}:${intent.id}`;
    applyMove(source, placeAmong(parentId, siblings, anchor, intent.where === "before" ? "before" : "after"));
  };

  const treeDrag = useDragDrop({ resolve: resolveDrop("y"), onDrop: handleDrop });
  const boardDrag = useDragDrop({ resolve: resolveDrop("x"), onDrop: handleDrop });

  // Nothing inside is lost: it all moves up a level, where the subgroup was (see planSubgroupDelete).
  const removeSubgroup = async (subgroup: SubgroupItem) => {
    const noteCount = notes.filter(note => note.subgroup_id === subgroup.id).length;
    const childCount = subgroups.filter(item => item.parentId === subgroup.id).length;
    const parentName = subgroups.find(item => item.id === subgroup.parentId)?.name;
    const contents = [
      noteCount ? (noteCount === 1 ? "1 verbete" : `${noteCount} verbetes`) : "",
      childCount ? (childCount === 1 ? "1 subgrupo" : `${childCount} subgrupos`) : "",
    ]
      .filter(Boolean)
      .join(" e ");
    const destination = parentName ? `para “${parentName}”` : "para o topo do volume";
    const warning = contents ? ` O que está nele (${contents}) vai ${destination}.` : "";
    if (!window.confirm(`Excluir o subgrupo “${subgroup.name}”?${warning}`)) return;

    try {
      const plan = planSubgroupDelete(subgroup, notes, subgroups);
      await deleteSubgroup(subgroup, plan);
      setSubgroups(current =>
        current
          .filter(item => item.id !== subgroup.id)
          .map(item => plan.subgroups.find(child => child.id === item.id) ?? item),
      );
      setNotes(current =>
        current.map(note => {
          const moved = plan.notes.find(item => item.id === note.id);
          return moved ? { ...note, subgroup_id: subgroup.parentId, position: moved.position } : note;
        }),
      );
      // A manuscript or corkboard of the deleted subgroup has nothing left to show.
      setView(open =>
        (open?.kind === "manuscript" || open?.kind === "board") && open.subgroupId === subgroup.id ? null : open,
      );
      setTreeError("");
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao excluir subgrupo.");
    }
  };

  const changeGoal = async (goal: number | null) => {
    try {
      await setDailyGoal(world.id, goal);
      refreshStats();
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Erro ao salvar a meta.");
    }
  };

  const filterParts = [
    terms.length ? `para “${query.trim()}”` : "",
    categoryId ? `em ${categoryName(categoryId)}` : "",
    statusFilter ? `com status ${NOTE_STATUSES.find(item => item.id === statusFilter)?.label ?? "sem status"}` : "",
  ].filter(Boolean);
  const emptyFilterText = `Nenhum verbete encontrado ${filterParts.join(" ")}.`;

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
    view ? "volume--note-open" : "",
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
            <div className="volume__views">
              {VOLUME_VIEWS.filter(item => on(item.feature)).map(item => (
                <button
                  key={item.kind}
                  type="button"
                  className="volume__view-button"
                  aria-pressed={view?.kind === item.kind && !("subgroupId" in view && view.subgroupId)}
                  onClick={() => showVolumeView(item.kind)}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                className="volume__view-button volume__view-button--settings"
                aria-pressed={view?.kind === "settings"}
                onClick={() => showVolumeView("settings")}
                title="Recursos do volume"
              >
                ⚙ Recursos
              </button>
            </div>
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

        {!loading && !error && on("goals") && <WritingGoal key={stats.goal ?? 0} stats={stats} onSetGoal={changeGoal} />}

        {notes.length > 0 && (
          <div className="volume__search-row">
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
            {on("status") && (
            <select
              className="volume__status-filter"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Status</option>
              {NOTE_STATUSES.map(item => (
                <option key={item.id} value={item.id}>
                  {item.mark} {item.label}
                </option>
              ))}
              <option value="none">Sem status</option>
            </select>
            )}
          </div>
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

        {/* Dropping in the empty space under the listing puts the item at the end of the volume. */}
        <div
          className="volume__tree"
          data-drag-scroll
          data-drop="end"
          data-parent=""
          data-drop-where={treeDrag.drag?.intent?.kind === "end" && treeDrag.drag.intent.id === null ? "inside" : undefined}
        >
          {loading ? (
            <p className="volume__status">Carregando verbetes...</p>
          ) : error ? (
            <p className="volume__status volume__status--error">{error}</p>
          ) : (
            <>
              {notes.length === 0 && subgroups.length === 0 && addingIn === undefined && (
                <p className="volume__status">
                  Esta gaveta ainda está vazia. Comece um verbete ou crie subgrupos para organizar o volume.
                </p>
              )}
              {filtering && visibleNotes.length === 0 && <p className="volume__status">{emptyFilterText}</p>}
              <NoteTree
                notes={visibleNotes}
                subgroups={subgroups}
                categories={categories}
                features={features}
                openNoteId={openNote?.id ?? null}
                filtering={filtering}
                addingIn={addingIn}
                dragHandle={treeDrag.dragHandle}
                dropAt={treeDrag.drag?.intent ?? null}
                onOpen={openExisting}
                onNewNote={openNewIn}
                onNewSubgroup={startSubgroupIn}
                onToggle={subgroup => setCollapsed(subgroup, !subgroup.collapsed)}
                onAddSubgroup={addSubgroup}
                onRename={renameSubgroupTo}
                onMove={moveSubgroupTo}
                onDelete={removeSubgroup}
                onShowManuscript={showManuscript}
                onShowBoard={showBoard}
              />
              {treeError && (
                <p className="volume__status volume__status--error" role="alert">
                  {treeError}
                </p>
              )}
            </>
          )}
        </div>

        {choosingTemplate && (
          <div className="template-menu" role="menu" aria-label="Novo verbete">
            <button
              type="button"
              className="tree-menu__item"
              onClick={() => {
                setChoosingTemplate(false);
                openNewIn(null);
              }}
              autoFocus
            >
              Verbete em branco
            </button>
            {templateGroups.map(({ group, templates }) => (
              <div key={group ?? "modelos"} className="template-menu__group">
                {group && <p className="tree-menu__heading">{group}</p>}
                {templates.map(template => (
                  <button
                    key={`${group}-${template.id}`}
                    type="button"
                    className="tree-menu__item"
                    onClick={() => openFromTemplate(template)}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        <footer className="volume__actions">
          <button
            type="button"
            className="binder-button volume__new-note"
            aria-expanded={templateGroups.length ? choosingTemplate : undefined}
            onClick={() => (templateGroups.length ? setChoosingTemplate(!choosingTemplate) : openNewIn(null))}
          >
            <span aria-hidden="true">+</span> Verbete
          </button>
          <button type="button" className="binder-button volume__new-subgroup" onClick={() => setAddingIn(null)}>
            <span aria-hidden="true">+</span> Subgrupo
          </button>
        </footer>
      </aside>

      {/* Blank until something is opened. */}
      <section className="volume__main">
        {loading || !view ? (
          showSidebarButton && <div className="volume__blank">{showSidebarButton}</div>
        ) : view.kind === "note" ? (
          <NoteEditor
            key={view.key}
            headStart={showSidebarButton}
            world={world}
            note={openNoteItem}
            initialSubgroupId={view.subgroupId}
            preset={view.preset}
            features={features}
            allNotes={notes}
            onOpenNote={openExisting}
            categories={categories}
            subgroups={subgroups}
            onCategoryCreated={created => setCategories(current => [...current, created])}
            onSaved={saved => handleSaved(saved, view.key)}
            onDeleted={handleDeleted}
            onClose={() => setView(null)}
          />
        ) : view.kind === "manuscript" ? (
          <ManuscriptView
            key={view.key}
            rootId={view.subgroupId}
            worldName={world.name}
            notes={notes}
            subgroups={subgroups}
            features={features}
            headStart={showSidebarButton}
            onOpenNote={openExisting}
            onShowBoard={showBoard}
          />
        ) : view.kind === "board" ? (
          <Corkboard
            key={view.key}
            rootId={view.subgroupId}
            worldName={world.name}
            notes={notes}
            subgroups={subgroups}
            categories={categories}
            features={features}
            dragHandle={boardDrag.dragHandle}
            dropAt={boardDrag.drag?.intent ?? null}
            headStart={showSidebarButton}
            onOpenNote={openExisting}
            onOpenBoard={showBoard}
            onNewNote={openNewIn}
            onShowManuscript={showManuscript}
          />
        ) : view.kind === "settings" ? (
          <VolumeSettings
            features={features}
            kind={world.kind ?? null}
            headStart={showSidebarButton}
            onToggle={toggleFeature}
            onKindChange={changeKind}
          />
        ) : view.kind === "timeline" ? (
          <TimelineView notes={notes} categories={categories} headStart={showSidebarButton} onOpenNote={openExisting} />
        ) : view.kind === "graph" ? (
          <RelationshipMap notes={notes} categories={categories} headStart={showSidebarButton} onOpenNote={openExisting} />
        ) : view.kind === "names" ? (
          <NameCheck notes={notes} headStart={showSidebarButton} onOpenNote={openExisting} />
        ) : (
          <GameTable
            worldId={world.id}
            notes={notes}
            categories={categories}
            subgroups={subgroups}
            headStart={showSidebarButton}
            onOpenNote={openExisting}
          />
        )}
      </section>

      {treeDrag.ghost}
      {boardDrag.ghost}
    </main>
  );
}
