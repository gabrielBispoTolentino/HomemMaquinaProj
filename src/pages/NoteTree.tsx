import { useRef, useState } from "react";
import { categoryColor, type CategoryItem } from "../lib/categories";
import type { NoteItem } from "../lib/notes";
import type { SubgroupItem } from "../lib/subgroups";

type NoteTreeProps = {
  // Already filtered and sorted.
  notes: NoteItem[];
  subgroups: SubgroupItem[];
  categories: CategoryItem[];
  openNoteId: string | null;
  // While searching or filtering, subgroups without matches are hidden and the rest are shown expanded.
  filtering: boolean;
  addingSubgroup: boolean;
  onOpen: (note: NoteItem) => void;
  onNewNote: (subgroupId: string | null) => void;
  onToggle: (subgroup: SubgroupItem) => void;
  onAddSubgroup: (name: string) => void;
  // Resolves to false when the name was rejected, so the header shows the saved name again.
  onRename: (subgroup: SubgroupItem, name: string) => Promise<boolean>;
  onDelete: (subgroup: SubgroupItem) => void;
};

type NoteRowProps = {
  note: NoteItem;
  categories: CategoryItem[];
  open: boolean;
  onOpen: () => void;
};

function NoteRow({ note, categories, open, onOpen }: NoteRowProps) {
  const category = categories.find(item => item.id === note.category_id);

  return (
    <li>
      <button type="button" className="tree-note" aria-current={open ? "page" : undefined} onClick={onOpen}>
        <span className={`tree-note__title${note.title.trim() ? "" : " tree-note__title--untitled"}`}>
          {note.title.trim() || "Sem título"}
        </span>
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

// A one-line text field that commits on Enter or blur and cancels on Escape.
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

type SubgroupSectionProps = {
  subgroup: SubgroupItem;
  notes: NoteItem[];
  expanded: boolean;
  filtering: boolean;
  categories: CategoryItem[];
  openNoteId: string | null;
  onOpen: (note: NoteItem) => void;
  onNewNote: () => void;
  onToggle: () => void;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
};

function SubgroupSection(props: SubgroupSectionProps) {
  const { subgroup, notes, expanded, filtering, categories, openNoteId } = props;
  const [renaming, setRenaming] = useState(false);

  const commitRename = async (name: string | null) => {
    if (name !== null) await props.onRename(name);
    setRenaming(false);
  };

  return (
    <li className="tree-group">
      <div className="tree-group__head">
        {renaming ? (
          <NameInput initial={subgroup.name} label={`Novo nome para ${subgroup.name}`} onCommit={commitRename} />
        ) : (
          <button
            type="button"
            className="tree-group__toggle"
            aria-expanded={expanded}
            onClick={props.onToggle}
            disabled={filtering}
          >
            <span className="tree-group__caret" aria-hidden="true">
              ▸
            </span>
            <span className="tree-group__name">{subgroup.name}</span>
            <span className="tree-group__count">{notes.length}</span>
          </button>
        )}
        <button
          type="button"
          className="tree-group__action"
          onClick={props.onNewNote}
          aria-label={`Novo verbete em ${subgroup.name}`}
          title="Novo verbete aqui"
        >
          +
        </button>
        <button
          type="button"
          className="tree-group__action"
          onClick={() => setRenaming(true)}
          aria-label={`Renomear ${subgroup.name}`}
          title="Renomear"
        >
          ✎
        </button>
        <button
          type="button"
          className="tree-group__action"
          onClick={props.onDelete}
          aria-label={`Excluir o subgrupo ${subgroup.name}`}
          title="Excluir subgrupo"
        >
          ×
        </button>
      </div>
      {expanded && notes.length > 0 && (
        <ul className="tree-group__notes">
          {notes.map(note => (
            <NoteRow
              key={note.id}
              note={note}
              categories={categories}
              open={note.id === openNoteId}
              onOpen={() => props.onOpen(note)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// The volume's listing in the sidebar: subgroups (collapsible folders) first, then the notes outside any subgroup.
export default function NoteTree(props: NoteTreeProps) {
  const { notes, subgroups, categories, openNoteId, filtering } = props;
  const looseNotes = notes.filter(note => !note.subgroup_id);

  return (
    <ul className="note-tree" aria-label="Verbetes">
      {subgroups.map(subgroup => {
        const subgroupNotes = notes.filter(note => note.subgroup_id === subgroup.id);
        if (filtering && subgroupNotes.length === 0) return null;

        return (
          <SubgroupSection
            key={subgroup.id}
            subgroup={subgroup}
            notes={subgroupNotes}
            expanded={filtering || !subgroup.collapsed}
            filtering={filtering}
            categories={categories}
            openNoteId={openNoteId}
            onOpen={props.onOpen}
            onNewNote={() => props.onNewNote(subgroup.id)}
            onToggle={() => props.onToggle(subgroup)}
            onRename={name => props.onRename(subgroup, name)}
            onDelete={() => props.onDelete(subgroup)}
          />
        );
      })}
      {props.addingSubgroup && (
        <li className="tree-group">
          <div className="tree-group__head">
            <NameInput initial="" label="Nome do novo subgrupo" onCommit={name => props.onAddSubgroup(name ?? "")} />
          </div>
        </li>
      )}
      {looseNotes.map(note => (
        <NoteRow
          key={note.id}
          note={note}
          categories={categories}
          open={note.id === openNoteId}
          onOpen={() => props.onOpen(note)}
        />
      ))}
    </ul>
  );
}
