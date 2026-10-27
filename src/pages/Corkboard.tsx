import type { ReactNode } from "react";
import { categoryColor, type CategoryItem } from "../lib/categories";
import { featureOn, type FeatureId } from "../lib/features";
import { plainText } from "../lib/mentions";
import type { NoteItem } from "../lib/notes";
import { childrenOf } from "../lib/order";
import type { SubgroupItem } from "../lib/subgroups";
import { statusInfo } from "../lib/writing";
import { dropMark } from "./NoteTree.tsx";
import type { DropIntent } from "./WorldNotes.tsx";
import type { DragSource } from "./useDragDrop.tsx";
import "./CSS/Writing.css";

type CorkboardProps = {
  // The subgroup whose contents are pinned up; null for the top of the volume.
  rootId: string | null;
  worldName: string;
  notes: NoteItem[];
  subgroups: SubgroupItem[];
  categories: CategoryItem[];
  features: Set<FeatureId>;
  dragHandle: (source: DragSource) => Record<string, unknown>;
  dropAt: DropIntent | null;
  headStart?: ReactNode;
  onOpenNote: (note: NoteItem) => void;
  onOpenBoard: (subgroupId: string | null) => void;
  onNewNote: (subgroupId: string | null) => void;
  onShowManuscript: (subgroupId: string | null) => void;
};

// What a card says about a note: its synopsis, or else the start of the text.
function cardText(note: NoteItem) {
  return note.synopsis.trim() || plainText(note.content).slice(0, 280);
}

// A subgroup's notes and subgroups as index cards, in order, for plotting: drag a card to move it, or onto a
// subgroup's card to put it inside.
export default function Corkboard(props: CorkboardProps) {
  const { rootId, notes, subgroups, categories, dragHandle, dropAt } = props;
  const root = subgroups.find(subgroup => subgroup.id === rootId) ?? null;
  const children = childrenOf(rootId, notes, subgroups);

  const countNotes = (id: string): number =>
    childrenOf(id, notes, subgroups).reduce((total, child) => total + (child.kind === "note" ? 1 : countNotes(child.item.id)), 0);

  return (
    <article className="board">
      <header className="board__head">
        {props.headStart}
        {root && (
          <button
            type="button"
            className="binder-icon-button"
            aria-label="Subir um nível"
            title="Subir um nível"
            onClick={() => props.onOpenBoard(root.parentId)}
          >
            ↑
          </button>
        )}
        <h2 className="board__title">
          <span className="board__kind">Quadro</span>
          {root?.name ?? props.worldName}
        </h2>
        {featureOn(props.features, "manuscript") && (
          <button type="button" className="writing-button" onClick={() => props.onShowManuscript(rootId)}>
            Manuscrito
          </button>
        )}
        <button type="button" className="writing-button writing-button--accent" onClick={() => props.onNewNote(rootId)}>
          <span aria-hidden="true">+</span> Verbete
        </button>
      </header>

      <ul className="board__cards" data-drop="end" data-parent={rootId ?? ""} data-drop-where={dropMark(dropAt, "end", rootId)}>
        {children.length === 0 && <li className="board__empty">Nada aqui ainda. Crie um verbete ou arraste um para cá.</li>}
        {children.map(child => {
          if (child.kind === "subgroup") {
            const subgroup = child.item;
            const count = countNotes(subgroup.id);
            return (
              <li key={subgroup.id}>
                <button
                  type="button"
                  className="board-card board-card--folder"
                  onClick={() => props.onOpenBoard(subgroup.id)}
                  data-drop="item"
                  data-kind="subgroup"
                  data-id={subgroup.id}
                  data-drop-where={dropMark(dropAt, "subgroup", subgroup.id)}
                  {...dragHandle({ kind: "subgroup", id: subgroup.id, label: subgroup.name })}
                >
                  <span className="board-card__title">{subgroup.name}</span>
                  <span className="board-card__meta">{count === 1 ? "1 verbete" : `${count} verbetes`}</span>
                </button>
              </li>
            );
          }

          const note = child.item;
          const category = categories.find(item => item.id === note.category_id);
          const status = featureOn(props.features, "status") ? statusInfo(note.status) : null;
          const title = note.title.trim() || "Sem título";
          return (
            <li key={note.id}>
              <button
                type="button"
                className="board-card"
                style={category ? ({ "--category": categoryColor(categories, category.id) } as React.CSSProperties) : undefined}
                onClick={() => props.onOpenNote(note)}
                data-drop="item"
                data-kind="note"
                data-id={note.id}
                data-drop-where={dropMark(dropAt, "note", note.id)}
                {...dragHandle({ kind: "note", id: note.id, label: title })}
              >
                {category && <span className="board-card__tab">{category.name}</span>}
                <span className={`board-card__title${note.title.trim() ? "" : " board-card__title--untitled"}`}>{title}</span>
                {cardText(note) && <span className="board-card__text">{cardText(note)}</span>}
                {status && (
                  <span className="board-card__status">
                    {status.mark} {status.label}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
