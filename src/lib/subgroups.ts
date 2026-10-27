import { newId, now, queryAll, run } from "./db";

// Subgroups are folders inside a volume. A note sits in at most one; categories are a separate, independent label.
export type SubgroupItem = {
  id: string;
  name: string;
  collapsed: boolean;
};

export async function loadSubgroups(worldId: string): Promise<SubgroupItem[]> {
  const rows = await queryAll<{ id: string; name: string; collapsed: number }>(
    "SELECT id, name, collapsed FROM subgroups WHERE world_id = ? ORDER BY created_at ASC",
    [worldId],
  );
  return rows.map(row => ({ ...row, collapsed: row.collapsed === 1 }));
}

export async function createSubgroup(worldId: string, name: string): Promise<SubgroupItem> {
  const subgroup = { id: newId(), name: name.trim(), collapsed: false };
  await run("INSERT INTO subgroups (id, world_id, name, created_at) VALUES (?, ?, ?, ?)", [
    subgroup.id,
    worldId,
    subgroup.name,
    now(),
  ]);
  return subgroup;
}

// Matches the unique index on (world_id, lower(trim(name))).
export function findSubgroupByName(subgroups: SubgroupItem[], name: string) {
  const key = name.trim().toLowerCase();
  return subgroups.find(subgroup => subgroup.name.trim().toLowerCase() === key);
}

export async function renameSubgroup(id: string, name: string) {
  await run("UPDATE subgroups SET name = ? WHERE id = ?", [name.trim(), id]);
}

export async function setSubgroupCollapsed(id: string, collapsed: boolean) {
  await run("UPDATE subgroups SET collapsed = ? WHERE id = ?", [collapsed ? 1 : 0, id]);
}

// The database moves its notes out of the subgroup (on delete set null); the notes themselves stay.
export async function deleteSubgroup(id: string) {
  await run("DELETE FROM subgroups WHERE id = ?", [id]);
}
