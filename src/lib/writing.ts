import { queryAll, queryOne, run, type Statement } from "./db";

// Writing aids for books (and any long text): note status, word counts, and a daily word goal per volume.

export const NOTE_STATUSES = [
  { id: "ideia", label: "Ideia", mark: "○" },
  { id: "rascunho", label: "Rascunho", mark: "◔" },
  { id: "revisao", label: "Revisão", mark: "◑" },
  { id: "final", label: "Final", mark: "●" },
] as const;

export type NoteStatus = (typeof NOTE_STATUSES)[number]["id"];

export function statusInfo(status: string | null) {
  return NOTE_STATUSES.find(item => item.id === status) ?? null;
}

// Letters and digits, with apostrophes and hyphens inside a word ("d'água", "guarda-chuva") counting as one.
export function countWords(text: string) {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function formatWords(count: number) {
  return count === 1 ? "1 palavra" : `${count.toLocaleString("pt-BR")} palavras`;
}

// The local calendar day, "2026-10-27", which is what a daily goal is about.
function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Adds words written (or removed, when negative) to today's total for the volume.
export function recordWordsStatement(worldId: string, delta: number): Statement[] {
  if (delta === 0) return [];
  return [
    {
      sql: `INSERT INTO writing_days (world_id, day, words) VALUES (?, ?, ?)
            ON CONFLICT (world_id, day) DO UPDATE SET words = words + excluded.words`,
      params: [worldId, dayKey(new Date()), delta],
    },
  ];
}

export type WritingStats = {
  goal: number | null;
  today: number;
  // Days in a row the goal was met, counting today only once it's met (so a streak isn't broken mid-day).
  streak: number;
};

export async function loadWritingStats(worldId: string): Promise<WritingStats> {
  const [world, days] = await Promise.all([
    queryOne<{ daily_goal: number | null }>("SELECT daily_goal FROM worlds WHERE id = ?", [worldId]),
    queryAll<{ day: string; words: number }>(
      "SELECT day, words FROM writing_days WHERE world_id = ? ORDER BY day DESC LIMIT 400",
      [worldId],
    ),
  ]);
  const goal = world?.daily_goal ?? null;
  const words = new Map(days.map(row => [row.day, row.words]));
  const today = words.get(dayKey(new Date())) ?? 0;

  let streak = 0;
  if (goal) {
    const date = new Date();
    if (today < goal) date.setDate(date.getDate() - 1);
    while ((words.get(dayKey(date)) ?? 0) >= goal) {
      streak++;
      date.setDate(date.getDate() - 1);
    }
  }

  return { goal, today, streak };
}

export async function setDailyGoal(worldId: string, goal: number | null) {
  await run("UPDATE worlds SET daily_goal = ? WHERE id = ?", [goal, worldId]);
}
