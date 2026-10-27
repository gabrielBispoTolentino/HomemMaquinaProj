import { newId, now, queryAll, run } from "./db";

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  subgroup_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteDraft = { title: string; content: string; categoryId: string | null; subgroupId: string | null };

export function loadNotes(worldId: string): Promise<NoteItem[]> {
  return queryAll<NoteItem>(
    "SELECT id, title, content, category_id, subgroup_id, created_at, updated_at FROM notes WHERE world_id = ?",
    [worldId],
  );
}

export async function createNote(worldId: string, { title, content, categoryId, subgroupId }: NoteDraft) {
  const id = newId();
  const timestamp = now();
  await run(
    `INSERT INTO notes (id, world_id, title, content, category_id, subgroup_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, worldId, title, content, categoryId, subgroupId, timestamp, timestamp],
  );
  return { id, created_at: timestamp };
}

// Resolves to the new updated_at.
export async function updateNote(id: string, { title, content, categoryId, subgroupId }: NoteDraft) {
  const timestamp = now();
  await run(
    "UPDATE notes SET title = ?, content = ?, category_id = ?, subgroup_id = ?, updated_at = ? WHERE id = ?",
    [title, content, categoryId, subgroupId, timestamp, id],
  );
  return timestamp;
}

export async function deleteNote(id: string) {
  await run("DELETE FROM notes WHERE id = ?", [id]);
}
