import { newId, now, queryAll, run, runBatch, type Statement } from "./db";
import { parseFeatures, serializeFeatures, type FeatureId } from "./features";
import { importFromSupabase } from "./supabaseImport";
import { volumeKind, type SeedItem, type VolumeKind } from "./volumeKinds";

export type WorldItem = {
  id: string;
  name: string;
  accent_color?: string | null;
  icon?: string | null;
  // The model it was made from and the features it has on (see features.ts); null for older volumes.
  kind?: string | null;
  features?: string | null;
};

export async function loadWorlds(userId: number): Promise<WorldItem[]> {
  await importFromSupabase(userId);
  return queryAll<WorldItem>(
    "SELECT id, name, accent_color, icon, kind, features FROM worlds WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
}

// The model's starting categories, subgroups and notes, as inserts.
function seedStatements(worldId: string, kind: VolumeKind): Statement[] {
  const statements: Statement[] = [];
  const start = Date.now();
  // Distinct, increasing timestamps keep the categories in the model's order.
  const stamp = (offset: number) => new Date(start + offset).toISOString();

  const categoryIds = new Map<string, string>();
  kind.categories.forEach((name, index) => {
    const id = newId();
    categoryIds.set(name, id);
    statements.push({
      sql: "INSERT INTO categories (id, world_id, name, created_at) VALUES (?, ?, ?, ?)",
      params: [id, worldId, name, stamp(index)],
    });
  });

  const walk = (items: SeedItem[], parentId: string | null) => {
    items.forEach((item, index) => {
      const position = (index + 1) * 1024;
      if (item.kind === "subgroup") {
        const id = newId();
        statements.push({
          sql: "INSERT INTO subgroups (id, world_id, parent_id, name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          params: [id, worldId, parentId, item.name, position, stamp(0)],
        });
        walk(item.children ?? [], id);
        return;
      }

      const template = item.template ? kind.templates.find(entry => entry.id === item.template) : undefined;
      const category = item.category ?? template?.category;
      const fields = (template?.fields ?? []).map(key => ({ key, value: "" }));
      statements.push({
        sql: `INSERT INTO notes (id, world_id, title, content, category_id, subgroup_id, position, synopsis, fields,
                timeline, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          newId(),
          worldId,
          item.title,
          item.content ?? template?.content ?? "",
          category ? categoryIds.get(category) ?? null : null,
          parentId,
          position,
          item.synopsis ?? "",
          JSON.stringify(fields),
          item.timeline ?? "",
          stamp(0),
          stamp(0),
        ],
      });
    });
  };
  walk(kind.structure, null);

  return statements;
}

// A new volume from one of the models in volumeKinds.ts: its features switched on and its starting structure in.
export async function createWorld(
  userId: number,
  name: string,
  description: string | null,
  kindId: VolumeKind["id"],
): Promise<WorldItem> {
  const kind = volumeKind(kindId)!;
  const world: WorldItem = {
    id: newId(),
    name,
    accent_color: kind.accent,
    icon: kind.icon,
    kind: kind.id,
    features: serializeFeatures(kind.features),
  };
  const timestamp = now();
  await runBatch([
    {
      sql: `INSERT INTO worlds (id, user_id, name, description, accent_color, icon, kind, features, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [world.id, userId, name, description, kind.accent, kind.icon, kind.id, world.features!, timestamp, timestamp],
    },
    ...seedStatements(world.id, kind),
  ]);
  return world;
}

export async function setWorldFeatures(worldId: string, features: Set<FeatureId>) {
  const stored = serializeFeatures(features);
  await run("UPDATE worlds SET features = ? WHERE id = ?", [stored, worldId]);
  return stored;
}

// Only changes which note templates the volume offers; features are switched separately.
export async function setWorldKind(worldId: string, kind: string | null) {
  await run("UPDATE worlds SET kind = ? WHERE id = ?", [kind, worldId]);
}

export function worldFeatures(world: WorldItem) {
  return parseFeatures(world.features);
}
