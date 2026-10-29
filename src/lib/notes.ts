import { newId, now, queryAll, run, runBatch } from "./db";
import { endPosition, respacedStatements, type Placement } from "./order";
import { countWords, recordWordsStatement } from "./writing";

// A custom field: "Idade" → "32".
export type NoteField = { key: string; value: string };

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  subgroup_id: string | null;
  position: number;
  status: string | null;
  synopsis: string;
  fields: NoteField[];
  timeline: string;
  created_at: string;
  updated_at: string;
};

export type NoteDraft = {
  title: string;
  content: string;
  categoryId: string | null;
  subgroupId: string | null;
  status: string | null;
  synopsis: string;
  fields: NoteField[];
  timeline: string;
};

function parseFields(stored: string): NoteField[] {
  try {
    const fields = JSON.parse(stored);
    return Array.isArray(fields) ? fields.map(field => ({ key: String(field.key ?? ""), value: String(field.value ?? "") })) : [];
  } catch {
    return [];
  }
}

export async function loadNotes(worldId: string): Promise<NoteItem[]> {
  const rows = await queryAll<Omit<NoteItem, "fields"> & { fields: string }>(
    `SELECT id, title, content, category_id, subgroup_id, position, status, synopsis, fields, timeline, created_at,
       updated_at
     FROM notes WHERE world_id = ? AND deleted_at IS NULL`,
    [worldId],
  );
  return rows.map(row => ({ ...row, fields: parseFields(row.fields) }));
}

// A note in the volume's Lixeira, newest first.
export type TrashedNote = { id: string; title: string; content: string; deleted_at: string };

export async function loadTrash(worldId: string): Promise<TrashedNote[]> {
  return queryAll<TrashedNote>(
    "SELECT id, title, content, deleted_at FROM notes WHERE world_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    [worldId],
  );
}

// Its words count towards today's writing in the volume.
export async function createNote(worldId: string, draft: NoteDraft, position: number) {
  const id = newId();
  const timestamp = now();
  await runBatch([
    {
      sql: `INSERT INTO notes (id, world_id, title, content, category_id, subgroup_id, position, status, synopsis,
              fields, timeline, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id,
        worldId,
        draft.title,
        draft.content,
        draft.categoryId,
        draft.subgroupId,
        position,
        draft.status,
        draft.synopsis,
        JSON.stringify(draft.fields),
        draft.timeline,
        timestamp,
        timestamp,
      ],
    },
    ...recordWordsStatement(worldId, countWords(draft.content)),
  ]);
  return { id, created_at: timestamp };
}

// wordsDelta is how many words the content gained (or lost) since the last save. Resolves to the new updated_at.
export async function updateNote(id: string, worldId: string, draft: NoteDraft, wordsDelta: number) {
  const timestamp = now();
  await runBatch([
    {
      sql: `UPDATE notes SET title = ?, content = ?, category_id = ?, subgroup_id = ?, status = ?, synopsis = ?,
              fields = ?, timeline = ?, updated_at = ?
            WHERE id = ?`,
      params: [
        draft.title,
        draft.content,
        draft.categoryId,
        draft.subgroupId,
        draft.status,
        draft.synopsis,
        JSON.stringify(draft.fields),
        draft.timeline,
        timestamp,
        id,
      ],
    },
    ...recordWordsStatement(worldId, wordsDelta),
  ]);
  return timestamp;
}

// A drag and drop in the listing or on the corkboard.
export async function moveNote(id: string, { parentId, position, respaced }: Placement) {
  await runBatch([
    ...respacedStatements(respaced),
    { sql: "UPDATE notes SET subgroup_id = ?, position = ? WHERE id = ?", params: [parentId, position, id] },
  ]);
}

// Deleting a note moves it to the Lixeira, where it can be restored; only deleteForever removes it.
export async function trashNote(id: string) {
  await run("UPDATE notes SET deleted_at = ? WHERE id = ?", [now(), id]);
}

// Back into the volume, at the end of its subgroup (or of the volume, if the subgroup is gone; the database
// already cleared subgroup_id then). Resolves to the note as the listing shows it.
export async function restoreNote(id: string): Promise<NoteItem | null> {
  await run("UPDATE notes SET deleted_at = NULL, position = ? WHERE id = ?", [endPosition(), id]);
  const rows = await queryAll<Omit<NoteItem, "fields"> & { fields: string }>(
    `SELECT id, title, content, category_id, subgroup_id, position, status, synopsis, fields, timeline, created_at,
       updated_at
     FROM notes WHERE id = ?`,
    [id],
  );
  return rows[0] ? { ...rows[0], fields: parseFields(rows[0].fields) } : null;
}

// For good, with its versions.
export async function deleteForever(id: string) {
  await run("DELETE FROM notes WHERE id = ? AND deleted_at IS NOT NULL", [id]);
}

export async function emptyTrash(worldId: string) {
  await run("DELETE FROM notes WHERE world_id = ? AND deleted_at IS NOT NULL", [worldId]);
}
