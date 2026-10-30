import { useRef, useState } from "react";
import { categoryColor, type CategoryItem } from "../lib/categories";
import { featureOn, type FeatureId } from "../lib/features";
import type { NoteItem } from "../lib/notes";
import { childrenOf, type ChildItem } from "../lib/order";
import { subgroupPaths, subtreeIds, type SubgroupItem } from "../lib/subgroups";
import { statusInfo } from "../lib/writing";
import type { DropIntent, Landed } from "./WorldNotes.tsx";
import type { DragSource } from "./useDragDrop.tsx";

type DragHandle = (source: DragSource) => Record<string, unknown>;

type NoteTreeProps = {
  // Already filtered.
  notes: NoteItem[];
  subgroups: SubgroupItem[];
  categories: CategoryItem[];
  features: Set<FeatureId>;
  openNoteId: string | null;
  // While searching or filtering, subgroups without matches are hidden and the rest are shown expanded.
  filtering: boolean;
  // Where the new-subgroup field is showing: undefined for nowhere, null for the top of the volume.
  addingIn: string | null | undefined;
  dragHandle: DragHandle;
  // Where the item being dragged would land, to mark it.
  dropAt: DropIntent | null;
  landed: Landed;
  onOpen: (note: NoteItem) => void;
  onNewNote: (subgroupId: string | null) => void;
  onNewSubgroup: (parentId: string) => void;
  onToggle: (subgroup: SubgroupItem) => void;
  onAddSubgroup: (name: string, parentId: string | null) => void;
  // Resolves to false when the name was rejected, so the header shows the saved name again.
  onRename: (subgroup: SubgroupItem, name: string) => Promise<boolean>;
  onMove: (subgroup: SubgroupItem, parentId: string | null) => void;
  onDelete: (subgroup: SubgroupItem) => void;
  onShowManuscript: (subgroupId: string) => void;
  onShowBoard: (subgroupId: string) => void;
};

// The data-drop-where attribute the drop target gets while something is dragged over it (see Notes.css).
export function dropMark(dropAt: DropIntent | null, kind: DropIntent["kind"], id: string | null) {
  return dropAt && dropAt.kind === kind && dropAt.id === id ? dropAt.where : undefined;
}

type NoteRowProps = {
  note: NoteItem;
  categories: CategoryItem[];
  showStatus: boolean;
  open: boolean;
  landed: boolean;
  dragHandle: DragHandle;
  dropAt: DropIntent | null;
  onOpen: () => void;
};

function NoteRow({ note, categories, showStatus, open, landed, dragHandle, dropAt, onOpen }: NoteRowProps) {
  const category = categories.find(item => item.id === note.category_id);
  const status = showStatus ? statusInfo(note.status) : null;
  const title = note.title.trim() || "Sem título";

  return (
    <li>
      <button
        type="button"
        className={`tree-note${landed ? " tree-note--landed" : ""}`}
        aria-current={open ? "page" : undefined}
        onClick={onOpen}
        data-drop="item"
        data-kind="note"
        data-id={note.id}
        data-drop-where={dropMark(dropAt, "note", note.id)}
        {...dragHandle({ kind: "note", id: note.id, label: title })}
      >
        {status && (
          <span className="tree-note__status" title={status.label} aria-label={status.label}>
            {status.mark}
          </span>
        )}
        <span className={`tree-note__title${note.title.trim() ? "" : " tree-note__title--untitled"}`}>{title}</span>
        {category && (
          <span
            className="tree-note__category"
            style={{ "--category": categoryColor(categories, category.id) } as React.CSSProperties}
          >
            {category.name}
          </span>
        )}
      </button>
    </li>
  );
}

// A one-line text field that commits on Enter or blur and cancels on Escape (committing null).
function NameInput({
  initial,
  label,
  onCommit,
}: {
  initial: string;
  label: string;
  onCommit: (name: string | null) => void;
}) {
  const [name, setName] = useState(initial);
  const cancel = useRef(false);

  return (
    <input
      className="tree-group__input"
      value={name}
      onChange={event => setName(event.target.value)}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          cancel.current = true;
          event.currentTarget.blur();
        }
      }}
      onBlur={() => onCommit(cancel.current ? null : name)}
      placeholder="Nome do subgrupo"
      aria-label={label}
      maxLength={60}
      enterKeyHint="done"
      autoFocus
    />
  );
}

type SubgroupMenuProps = {
  subgroup: SubgroupItem;
  subgroups: SubgroupItem[];
  features: Set<FeatureId>;
  onClose: () => void;
  onNewNote: () => void;
  onNewSubgroup: () => void;
  onShowManuscript: () => void;
  onShowBoard: () => void;
  onRename: () => void;
  onMove: (parentId: string | null) => void;
  onDelete: () => void;
};

// Opens under a subgroup's header. "Mover para…" swaps the actions for a list of places it can go.
function SubgroupMenu(props: SubgroupMenuProps) {
  const { subgroup, subgroups } = props;
  const [moving, setMoving] = useState(false);

  const act = (action: () => void) => () => {
    props.onClose();
    action();
  };

  const nested = subtreeIds(subgroups, subgroup.id);
  const destinations = subgroupPaths(subgroups).filter(
    path => !nested.has(path.id) && path.id !== subgroup.parentId,
  );

  return (
    <div
      className="tree-menu"
      onKeyDown={event => {
        if (event.key === "Escape") props.onClose();
      }}
    >
      {moving ? (
        <>
          <p className="tree-menu__heading">Mover “{subgroup.name}” para</p>
          {subgroup.parentId !== null && (
            <button type="button" className="tree-menu__item" onClick={act(() => props.onMove(null))} autoFocus>
              Topo do volume
            </button>
          )}
          {destinations.map(path => (
            <button key={path.id} type="button" className="tree-menu__item" onClick={act(() => props.onMove(path.id))}>
              {path.label}
            </button>
          ))}
          {destinations.length === 0 && subgroup.parentId === null && (
            <p className="tree-menu__heading">Não há outro subgrupo para onde mover.</p>
          )}
          <button type="button" className="tree-menu__item tree-menu__item--muted" onClick={() => setMoving(false)}>
            Voltar
          </button>
        </>
      ) : (
        <>
          <button type="button" className="tree-menu__item" onClick={act(props.onNewNote)} autoFocus>
            Novo verbete aqui
          </button>
          <button type="button" className="tree-menu__item" onClick={act(props.onNewSubgroup)}>
            Novo subgrupo aqui
          </button>
          {featureOn(props.features, "manuscript") && (
            <button type="button" className="tree-menu__item" onClick={act(props.onShowManuscript)}>
              Ler como manuscrito
            </button>
          )}
          {featureOn(props.features, "corkboard") && (
            <button type="button" className="tree-menu__item" onClick={act(props.onShowBoard)}>
              Ver no quadro
            </button>
          )}
          <button type="button" className="tree-menu__item" onClick={act(props.onRename)}>
            Renomear
          </button>
          <button type="button" className="tree-menu__item" onClick={() => setMoving(true)}>
            Mover para…
          </button>
          <button type="button" className="tree-menu__item tree-menu__item--danger" onClick={act(props.onDelete)}>
            Excluir subgrupo
          </button>
        </>
      )}
    </div>
  );
}

// The volume's listing in the sidebar. Subgroups are collapsible, nestable folders; inside each one (and at the top
// of the volume) subgroups and notes share one order, which is changed by dragging.
export default function NoteTree(props: NoteTreeProps) {
  const { notes, subgroups, categories, openNoteId, filtering, addingIn, dragHandle, dropAt, landed } = props;
  // One menu and one rename at a time, across the whole tree.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Notes anywhere inside a subgroup, nested ones included.
  const counts = new Map<string, number>();
  const countIn = (id: string): number => {
    const cached = counts.get(id);
    if (cached !== undefined) return cached;
    const count = childrenOf(id, notes, subgroups).reduce(
      (total, child) => total + (child.kind === "note" ? 1 : countIn(child.item.id)),
      0,
    );
    counts.set(id, count);
    return count;
  };

  const newSubgroupField = (parentId: string | null) =>
    addingIn === parentId && (
      <li className="tree-group">
        <div className="tree-group__head">
          <NameInput
            initial=""
            label="Nome do novo subgrupo"
            onCommit={name => props.onAddSubgroup(name ?? "", parentId)}
          />
        </div>
      </li>
    );

  const renderSubgroup = (subgroup: SubgroupItem) => {
    const count = countIn(subgroup.id);
    if (filtering && count === 0 && addingIn !== subgroup.id) return null;

    const expanded = filtering || !subgroup.collapsed || addingIn === subgroup.id;
    const children = childrenOf(subgroup.id, notes, subgroups);

    return (
      <li key={subgroup.id} className="tree-group">
        <div
          className={`tree-group__head${landed?.kind === "subgroup" && landed.id === subgroup.id ? " tree-group__head--landed" : ""}`}
          data-drop="item"
          data-kind="subgroup"
          data-id={subgroup.id}
          data-drop-where={dropMark(dropAt, "subgroup", subgroup.id)}
        >
          {renamingId === subgroup.id ? (
            <NameInput
              initial={subgroup.name}
              label={`Novo nome para ${subgroup.name}`}
              onCommit={async name => {
                if (name !== null) await props.onRename(subgroup, name);
                setRenamingId(null);
              }}
            />
          ) : (
            <button
              type="button"
              className="tree-group__toggle"
              aria-expanded={expanded}
              onClick={() => props.onToggle(subgroup)}
              disabled={filtering}
              {...dragHandle({ kind: "subgroup", id: subgroup.id, label: subgroup.name })}
            >
              <span className="tree-group__caret" aria-hidden="true">
                ▸
              </span>
              <span className="tree-group__name">{subgroup.name}</span>
              <span className="tree-group__count">{count}</span>
            </button>
          )}
          <button
            type="button"
            className="tree-group__action"
            aria-label={`Ações de ${subgroup.name}`}
            aria-expanded={menuFor === subgroup.id}
            title="Ações"
            onClick={() => setMenuFor(menuFor === subgroup.id ? null : subgroup.id)}
          >
            ⋯
          </button>
        </div>
        {menuFor === subgroup.id && (
          <SubgroupMenu
            subgroup={subgroup}
            subgroups={subgroups}
            features={props.features}
            onClose={() => setMenuFor(null)}
            onNewNote={() => props.onNewNote(subgroup.id)}
            onNewSubgroup={() => props.onNewSubgroup(subgroup.id)}
            onShowManuscript={() => props.onShowManuscript(subgroup.id)}
            onShowBoard={() => props.onShowBoard(subgroup.id)}
            onRename={() => setRenamingId(subgroup.id)}
            onMove={parentId => props.onMove(subgroup, parentId)}
            onDelete={() => props.onDelete(subgroup)}
          />
        )}
        {expanded && (children.length > 0 || addingIn === subgroup.id) && (
          <ul
            className="tree-group__children"
            data-drop="end"
            data-parent={subgroup.id}
            data-drop-where={dropMark(dropAt, "end", subgroup.id)}
          >
            {children.map(renderChild)}
            {newSubgroupField(subgroup.id)}
          </ul>
        )}
      </li>
    );
  };

  const renderChild = (child: ChildItem) =>
    child.kind === "subgroup" ? (
      renderSubgroup(child.item)
    ) : (
      <NoteRow
        key={child.item.id}
        note={child.item}
        categories={categories}
        showStatus={featureOn(props.features, "status")}
        open={child.item.id === openNoteId}
        landed={landed?.kind === "note" && landed.id === child.item.id}
        dragHandle={dragHandle}
        dropAt={dropAt}
        onOpen={() => props.onOpen(child.item)}
      />
    );

  return (
    <ul className="note-tree" aria-label="Verbetes">
      {childrenOf(null, notes, subgroups).map(renderChild)}
      {newSubgroupField(null)}
    </ul>
  );
}
