import { getSupabaseClient } from "./supabase";

// Categories are created by the user, one set per world (see supabase/categories.sql).
export type CategoryItem = {
  id: string;
  name: string;
};

export async function loadCategories(worldId: string): Promise<CategoryItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("world_id", worldId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createCategory(worldId: string, name: string): Promise<CategoryItem> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ world_id: worldId, name: name.trim() })
    .select("id, name")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Matches the unique index on (world_id, lower(trim(name))).
export function findCategoryByName(categories: CategoryItem[], name: string) {
  const key = name.trim().toLowerCase();
  return categories.find(category => category.name.trim().toLowerCase() === key);
}

export async function renameCategory(id: string, name: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", id);

  if (error) {
    throw error;
  }
}

// The database clears notes.category_id for the notes that used it (on delete set null).
export async function deleteCategory(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
