import { now, queryOne, runBatch, type Statement } from "./db";
import { getSupabaseClient } from "./supabase";

// Worlds used to be stored in Supabase. The first time a user opens their worlds on this device,
// copy what they had there into the local database. If Supabase can't be reached, the copy is
// tried again next time; the local worlds still load.

// Supabase timestamps carry microseconds and an offset; store them like the local ones so they sort together.
function toIso(value: string) {
  return new Date(value).toISOString();
}

async function fetchRemote(userId: number) {
  const supabase = getSupabaseClient();
  const { data: worlds, error: worldsError } = await supabase
    .from("worlds")
    .select("id, name, description, accent_color, icon, created_at, updated_at")
    .eq("user_id", userId);
  if (worldsError) throw worldsError;
  if (!worlds?.length) return { worlds: [], categories: [], notes: [] };

  const worldIds = worlds.map(world => world.id);
  const [{ data: categories, error: categoriesError }, { data: notes, error: notesError }] = await Promise.all([
    supabase.from("categories").select("id, world_id, name, created_at").in("world_id", worldIds),
    supabase
      .from("notes")
      .select("id, world_id, title, content, category_id, created_at, updated_at")
      .in("world_id", worldIds),
  ]);
  if (categoriesError) throw categoriesError;
  if (notesError) throw notesError;

  return { worlds, categories: categories ?? [], notes: notes ?? [] };
}

export async function importFromSupabase(userId: number) {
  const done = await queryOne("SELECT user_id FROM supabase_imports WHERE user_id = ?", [userId]);
  if (done) return;

  try {
    await runBatch(importStatements(userId, await fetchRemote(userId)));
  } catch (err) {
    console.warn("Não foi possível importar os mundos do Supabase; tentando de novo na próxima vez.", err);
  }
}

function importStatements(userId: number, remote: Awaited<ReturnType<typeof fetchRemote>>): Statement[] {
  // Parents first, so the foreign keys hold. "or ignore" skips anything already copied.
  return [
    ...remote.worlds.map(world => ({
      sql: `INSERT OR IGNORE INTO worlds (id, user_id, name, description, accent_color, icon, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        world.id,
        userId,
        world.name,
        world.description,
        world.accent_color,
        world.icon,
        toIso(world.created_at),
        toIso(world.updated_at),
      ],
    })),
    ...remote.categories.map(category => ({
      sql: "INSERT OR IGNORE INTO categories (id, world_id, name, created_at) VALUES (?, ?, ?, ?)",
      params: [category.id, category.world_id, category.name, toIso(category.created_at)],
    })),
    ...remote.notes.map(note => ({
      // Ordered by creation, like notes written here (see order.ts).
      sql: `INSERT OR IGNORE INTO notes (id, world_id, title, content, category_id, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        note.id,
        note.world_id,
        note.title,
        note.content,
        note.category_id,
        new Date(note.created_at).getTime(),
        toIso(note.created_at),
        toIso(note.updated_at),
      ],
    })),
    { sql: "INSERT INTO supabase_imports (user_id, imported_at) VALUES (?, ?)", params: [userId, now()] },
  ];
}
