import { newId, now, queryAll, run } from "./db";
import { importFromSupabase } from "./supabaseImport";

export type WorldItem = {
  id: string;
  name: string;
  accent_color?: string | null;
  icon?: string | null;
};

export async function loadWorlds(userId: number): Promise<WorldItem[]> {
  await importFromSupabase(userId);
  return queryAll<WorldItem>(
    "SELECT id, name, accent_color, icon FROM worlds WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
}

export async function createWorld(userId: number, name: string, description: string | null): Promise<WorldItem> {
  const world = { id: newId(), name, accent_color: null, icon: null };
  const timestamp = now();
  await run(
    "INSERT INTO worlds (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [world.id, userId, name, description, timestamp, timestamp],
  );
  return world;
}
