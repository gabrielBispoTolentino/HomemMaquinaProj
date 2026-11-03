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

function childKey(child: ChildItem) {
  return `${child.kind}:${child.item.id}`;
}

// Everything in the volume by parent (null for the top), each list in order. Built once per version of the two lists
// (the listing replaces them when anything changes), since the tree, the corkboard and the manuscript ask for every
// subgroup's contents on each render.
const indexes = new WeakMap<NoteItem[], WeakMap<SubgroupItem[], Map<string | null, readonly ChildItem[]>>>();

function childIndex(notes: NoteItem[], subgroups: SubgroupItem[]) {
  let bySubgroups = indexes.get(notes);
  if (!bySubgroups) indexes.set(notes, (bySubgroups = new WeakMap()));
  let index = bySubgroups.get(subgroups);
  if (index) return index;

  const lists = new Map<string | null, ChildItem[]>();
  const add = (parentId: string | null, child: ChildItem) => {
    const list = lists.get(parentId);
    if (list) list.push(child);
    else lists.set(parentId, [child]);
  };
  for (const item of subgroups) add(item.parentId, { kind: "subgroup", item });
  for (const item of notes) add(item.subgroup_id, { kind: "note", item });
  for (const list of lists.values()) list.sort((a, b) => a.item.position - b.item.position);
  index = lists;
  bySubgroups.set(subgroups, index);
  return index;
}

const NONE: readonly ChildItem[] = [];

// What's directly inside a subgroup (or the top of the volume, for null), in order. Shared between callers: copy it
// before changing it.
export function childrenOf(parentId: string | null, notes: NoteItem[], subgroups: SubgroupItem[]): readonly ChildItem[] {
  return childIndex(notes, subgroups).get(parentId) ?? NONE;
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
