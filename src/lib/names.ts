import { titleKey } from "./mentions";
import type { NoteItem } from "./notes";

// The name check: words in the volume's text that are almost, but not quite, a note's name, like "Auorra" next
// to the note "Aurora". Also note titles that are almost the same as each other.

export type NameSuspect = {
  found: string;
  likely: string;
  // The notes the misspelling is in.
  notes: NoteItem[];
};

export type TitlePair = { a: NoteItem; b: NoteItem };

function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length]!;
}

// Short names only tolerate one wrong letter; longer ones two. Plurals ("Corvo"/"Corvos") aren't mistakes.
function looksLike(word: string, name: string) {
  if (word === name || word === `${name}s` || name === `${word}s` || word === `${name}es`) return false;
  const limit = name.length >= 7 ? 2 : 1;
  return distance(word, name) <= limit;
}

// Proper names are capitalized; the check only looks at those, four letters or longer.
const CAPITALIZED = /\p{Lu}[\p{L}'’-]{3,}/gu;

export function checkNames(notes: NoteItem[]) {
  // Each word of four letters or more in a title is a name to check against ("Ordem do Véu" → "ordem", "veu").
  const names = new Map<string, string>();
  for (const note of notes) {
    for (const word of note.title.match(/[\p{L}'’-]{4,}/gu) ?? []) {
      const key = titleKey(word);
      if (!names.has(key)) names.set(key, word);
    }
  }

  const suspects = new Map<string, NameSuspect>();
  for (const note of notes) {
    const text = `${note.title} ${note.content} ${note.synopsis} ${note.fields.map(field => field.value).join(" ")}`;
    for (const word of text.match(CAPITALIZED) ?? []) {
      const key = titleKey(word);
      if (names.has(key)) continue;
      for (const [nameKey, name] of names) {
        if (!looksLike(key, nameKey)) continue;
        const id = `${key}→${nameKey}`;
        const suspect = suspects.get(id) ?? { found: word, likely: name, notes: [] };
        if (!suspect.notes.includes(note)) suspect.notes.push(note);
        suspects.set(id, suspect);
        break;
      }
    }
  }

  const pairs: TitlePair[] = [];
  const titled = notes.filter(note => titleKey(note.title).length >= 4);
  titled.forEach((a, i) => {
    for (const b of titled.slice(i + 1)) {
      const keyA = titleKey(a.title);
      const keyB = titleKey(b.title);
      if (keyA !== keyB && looksLike(keyA, keyB)) pairs.push({ a, b });
    }
  });

  return { suspects: [...suspects.values()], pairs };
}
