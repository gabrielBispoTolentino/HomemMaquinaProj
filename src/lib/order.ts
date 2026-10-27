import type { Statement } from "./db";
import type { NoteItem } from "./notes";
import type { SubgroupItem } from "./subgroups";

// Notes and subgroups share one manual order inside each parent: everything in a subgroup (or at the top of the
// volume) is sorted by `position`, so a chapter's scenes and notes can be arranged however the author likes.
// Positions are numbers with room between them; moving an item puts it halfway between its new neighbors.

export type ChildItem = { kind: "note"; item: NoteItem } | { kind: "subgroup"; item: SubgroupItem };

const STEP = 1024;

// A position after everything created so far.
export function endPosition() {
  return Date.now();
}

export function childKey(child: ChildItem) {
  return `${child.kind}:${child.item.id}`;
}

// What's directly inside a subgroup (or the top of the volume, for null), in order.
export function childrenOf(parentId: string | null, notes: NoteItem[], subgroups: SubgroupItem[]): ChildItem[] {
  const children: ChildItem[] = [
    ...subgroups.filter(subgroup => subgroup.parentId === parentId).map(item => ({ kind: "subgroup" as const, item })),
    ...notes.filter(note => note.subgroup_id === parentId).map(item => ({ kind: "note" as const, item })),
  ];
  return children.sort((a, b) => a.item.position - b.item.position);
}

export type Placement = {
  parentId: string | null;
  position: number;
  // When the neighbors are too close to fit between, the siblings are spread out again first.
  respaced: { kind: ChildItem["kind"]; id: string; position: number }[];
};

// Where an item lands when dropped before or after `anchorKey` among `siblings` (which must not include the item
// being moved), or at the end when there's no anchor.
export function placeAmong(
  parentId: string | null,
  siblings: ChildItem[],
  anchorKey: string | null,
  where: "before" | "after",
): Placement {
  const index = anchorKey ? siblings.findIndex(child => childKey(child) === anchorKey) : -1;
  const at = index === -1 ? siblings.length : where === "before" ? index : index + 1;
  const prev = siblings[at - 1]?.item.position;
  const next = siblings[at]?.item.position;

  if (prev !== undefined && next !== undefined && next - prev < 1e-6) {
    // Spread the siblings out, leaving a gap at the drop point.
    const respaced = siblings.map((child, i) => ({
      kind: child.kind,
      id: child.item.id,
      position: (i < at ? i : i + 1) * STEP,
    }));
    return { parentId, position: at * STEP, respaced };
  }

  const position =
    prev !== undefined && next !== undefined
      ? (prev + next) / 2
      : prev !== undefined
        ? prev + STEP
        : next !== undefined
          ? next - STEP
          : endPosition();
  return { parentId, position, respaced: [] };
}

export function respacedStatements(respaced: Placement["respaced"]): Statement[] {
  return respaced.map(({ kind, id, position }) => ({
    sql: `UPDATE ${kind === "note" ? "notes" : "subgroups"} SET position = ? WHERE id = ?`,
    params: [position, id],
  }));
}
