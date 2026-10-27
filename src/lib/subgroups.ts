import { newId, now, queryAll, run, runBatch } from "./db";
import type { NoteItem } from "./notes";
import { childrenOf, respacedStatements, type Placement } from "./order";

// Subgroups are folders inside a volume, and can be nested. A note sits in at most one; categories are a
// separate, independent label.
export type SubgroupItem = {
  id: string;
  name: string;
  // null for a subgroup at the top of the volume.
  parentId: string | null;
  // Order among everything in the parent, notes included (see order.ts).
  position: number;
  collapsed: boolean;
};

export async function loadSubgroups(worldId: string): Promise<SubgroupItem[]> {
  const rows = await queryAll<{
    id: string;
    name: string;
    parent_id: string | null;
    position: number;
    collapsed: number;
  }>("SELECT id, name, parent_id, position, collapsed FROM subgroups WHERE world_id = ?", [worldId]);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    position: row.position,
    collapsed: row.collapsed === 1,
  }));
}

export async function createSubgroup(
  worldId: string,
  name: string,
  parentId: string | null,
  position: number,
): Promise<SubgroupItem> {
  const subgroup = { id: newId(), name: name.trim(), parentId, position, collapsed: false };
  await run("INSERT INTO subgroups (id, world_id, parent_id, name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    subgroup.id,
    worldId,
    parentId,
    subgroup.name,
    position,
    now(),
  ]);
  return subgroup;
}

// Matches the unique index on (world_id, parent, lower(trim(name))): names only clash among siblings.
function nameKey(name: string) {
  return name.trim().toLowerCase();
}

export function findSubgroupByName(subgroups: SubgroupItem[], name: string, parentId: string | null) {
  return subgroups.find(subgroup => subgroup.parentId === parentId && nameKey(subgroup.name) === nameKey(name));
}

export async function renameSubgroup(id: string, name: string) {
  await run("UPDATE subgroups SET name = ? WHERE id = ?", [name.trim(), id]);
}

// A move from the menu, or a drag and drop in the listing or on the corkboard.
export async function moveSubgroup(id: string, { parentId, position, respaced }: Placement) {
  await runBatch([
    ...respacedStatements(respaced),
    { sql: "UPDATE subgroups SET parent_id = ?, position = ? WHERE id = ?", params: [parentId, position, id] },
  ]);
}

export async function setSubgroupCollapsed(id: string, collapsed: boolean) {
  await run("UPDATE subgroups SET collapsed = ? WHERE id = ?", [collapsed ? 1 : 0, id]);
}

export type DeletePlan = {
  // The subgroups inside, as they'll be once moved up a level.
  subgroups: SubgroupItem[];
  notes: { id: string; position: number }[];
};

// Everything inside a subgroup that's being deleted moves up into its parent, in the same order, where the
// subgroup was. A subgroup whose name is already taken there gets the deleted one's name added, e.g. "Notas (Cena 1)".
export function planSubgroupDelete(subgroup: SubgroupItem, notes: NoteItem[], subgroups: SubgroupItem[]): DeletePlan {
  const taken = new Set(
    subgroups
      .filter(item => item.parentId === subgroup.parentId && item.id !== subgroup.id)
      .map(item => nameKey(item.name)),
  );

  const siblings = childrenOf(subgroup.parentId, notes, subgroups);
  const next = siblings[siblings.findIndex(child => child.item.id === subgroup.id) + 1]?.item.position;
  const inside = childrenOf(subgroup.id, notes, subgroups);
  // Evenly between where the subgroup was and whatever came after it.
  const gap = next !== undefined ? (next - subgroup.position) / (inside.length + 1) : 1024;
  const positionAt = (index: number) => subgroup.position + gap * (index + 1);

  const plan: DeletePlan = { subgroups: [], notes: [] };
  inside.forEach((child, index) => {
    if (child.kind === "note") {
      plan.notes.push({ id: child.item.id, position: positionAt(index) });
      return;
    }

    let name = child.item.name;
    for (let n = 1; taken.has(nameKey(name)); n++) {
      name = n === 1 ? `${child.item.name} (${subgroup.name})` : `${child.item.name} (${subgroup.name} ${n})`;
    }
    taken.add(nameKey(name));
    plan.subgroups.push({ ...child.item, parentId: subgroup.parentId, name, position: positionAt(index) });
  });
  return plan;
}

// Nothing inside is lost: it all moves up a level, as planned by planSubgroupDelete.
export async function deleteSubgroup({ id, parentId }: SubgroupItem, plan: DeletePlan) {
  await runBatch([
    ...plan.notes.map(note => ({
      sql: "UPDATE notes SET subgroup_id = ?, position = ? WHERE id = ?",
      params: [parentId, note.position, note.id],
    })),
    ...plan.subgroups.map(child => ({
      sql: "UPDATE subgroups SET parent_id = ?, name = ?, position = ? WHERE id = ?",
      params: [child.parentId, child.name, child.position, child.id],
    })),
    { sql: "DELETE FROM subgroups WHERE id = ?", params: [id] },
  ]);
}

// A subgroup's direct subgroups, in listing order.
export function childSubgroups(subgroups: SubgroupItem[], parentId: string | null) {
  return subgroups.filter(subgroup => subgroup.parentId === parentId).sort((a, b) => a.position - b.position);
}

// Every subgroup with its full path ("Capítulo 1 / Cena 2"), in the order the listing shows them.
export function subgroupPaths(subgroups: SubgroupItem[]) {
  const paths: { id: string; label: string }[] = [];
  const visit = (parentId: string | null, prefix: string) => {
    for (const subgroup of childSubgroups(subgroups, parentId)) {
      const label = prefix + subgroup.name;
      paths.push({ id: subgroup.id, label });
      visit(subgroup.id, `${label} / `);
    }
  };
  visit(null, "");
  return paths;
}

// The subgroup and everything nested in it; a subgroup can't be moved into any of these.
export function subtreeIds(subgroups: SubgroupItem[], id: string) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const subgroup of subgroups) {
      if (subgroup.parentId && ids.has(subgroup.parentId) && !ids.has(subgroup.id)) {
        ids.add(subgroup.id);
        grew = true;
      }
    }
  }
  return ids;
}
