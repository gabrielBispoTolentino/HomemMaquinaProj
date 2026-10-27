import { newId, now, queryAll, run } from "./db";

// Categories are created by the user, one set per world (see the schema in db.ts).
export type CategoryItem = {
  id: string;
  name: string;
};

export function loadCategories(worldId: string): Promise<CategoryItem[]> {
  return queryAll<CategoryItem>("SELECT id, name FROM categories WHERE world_id = ? ORDER BY created_at ASC", [
    worldId,
  ]);
}

export async function createCategory(worldId: string, name: string): Promise<CategoryItem> {
  const category = { id: newId(), name: name.trim() };
  await run("INSERT INTO categories (id, world_id, name, created_at) VALUES (?, ?, ?, ?)", [
    category.id,
    worldId,
    category.name,
    now(),
  ]);
  return category;
}

// Categories have no stored color; each takes the next pastel in creation order, so a volume's first six never share one.
const CATEGORY_COLORS = ["#c9b6e4", "#a8d5c2", "#f3d38b", "#a9c7e8", "#f2b98f", "#f5a7a1"];

export function categoryColor(categories: CategoryItem[], id: string) {
  const index = Math.max(0, categories.findIndex(category => category.id === id));
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]!;
}

// Matches the unique index on (world_id, lower(trim(name))).
export function findCategoryByName(categories: CategoryItem[], name: string) {
  const key = name.trim().toLowerCase();
  return categories.find(category => category.name.trim().toLowerCase() === key);
}

export async function renameCategory(id: string, name: string) {
  await run("UPDATE categories SET name = ? WHERE id = ?", [name.trim(), id]);
}

// The database clears notes.category_id for the notes that used it (on delete set null).
export async function deleteCategory(id: string) {
  await run("DELETE FROM categories WHERE id = ?", [id]);
}
