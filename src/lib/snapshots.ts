import { newId, now, queryAll, run } from "./db";

// Saved versions of a note, taken by the author before a big rewrite.
export type SnapshotItem = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export function loadSnapshots(noteId: string): Promise<SnapshotItem[]> {
  return queryAll<SnapshotItem>(
    "SELECT id, title, content, created_at FROM note_snapshots WHERE note_id = ? ORDER BY created_at DESC",
    [noteId],
  );
}

export async function createSnapshot(noteId: string, title: string, content: string): Promise<SnapshotItem> {
  const snapshot = { id: newId(), title, content, created_at: now() };
  await run("INSERT INTO note_snapshots (id, note_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)", [
    snapshot.id,
    noteId,
    title,
    content,
    snapshot.created_at,
  ]);
  return snapshot;
}

export async function deleteSnapshot(id: string) {
  await run("DELETE FROM note_snapshots WHERE id = ?", [id]);
}
