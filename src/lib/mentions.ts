import type { NoteItem } from "./notes";
import { tablesToText } from "./sheets";

// [[Nome]] in a note's text mentions the note with that title (the "mentions" feature), and [segredo]…[/segredo]
// marks a passage only the game master should see (the "secrets" feature).

export const MENTION = /\[\[([^[\]\n]+?)\]\]/g;
export const SECRET = /\[segredo\]([\s\S]*?)\[\/segredo\]/gi;

// Case- and accent-insensitive, so [[aurora]] finds "Aurora".
export function titleKey(title: string) {
  return title.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

// Notes by title key; when two share a title, the first one wins.
export function notesByTitle(notes: NoteItem[]) {
  const byTitle = new Map<string, NoteItem>();
  for (const note of notes) {
    const key = titleKey(note.title);
    if (key && !byTitle.has(key)) byTitle.set(key, note);
  }
  return byTitle;
}

// The notes a text mentions, each once, in the order first mentioned.
export function mentionedNotes(text: string, byTitle: Map<string, NoteItem>) {
  const found: NoteItem[] = [];
  for (const match of text.matchAll(MENTION)) {
    const note = byTitle.get(titleKey(match[1]!));
    if (note && !found.includes(note)) found.push(note);
  }
  return found;
}

// The text cut into plain runs and [[mentions]], each with where it starts in the text, for showing mentions as links.
export function mentionSegments(text: string) {
  const segments: { start: number; text: string; name?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    if (match.index > last) segments.push({ start: last, text: text.slice(last, match.index) });
    segments.push({ start: match.index, text: match[0], name: match[1]! });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ start: last, text: text.slice(last) });
  return segments;
}

// Every mention between notes in the volume, as from → to pairs (each pair once, no self-mentions).
export function mentionLinks(notes: NoteItem[]) {
  const byTitle = notesByTitle(notes);
  const links: { from: NoteItem; to: NoteItem }[] = [];
  for (const note of notes) {
    for (const target of mentionedNotes(note.content, byTitle)) {
      if (target.id !== note.id) links.push({ from: note, to: target });
    }
  }
  return links;
}

// The notes whose text mentions this one.
export function backlinks(note: { id: string; title: string }, notes: NoteItem[]) {
  const key = titleKey(note.title);
  if (!key) return [];
  return notes.filter(
    other => other.id !== note.id && [...other.content.matchAll(MENTION)].some(match => titleKey(match[1]!) === key),
  );
}

// The text as the players should see it: secrets removed.
export function withoutSecrets(text: string) {
  return text.replace(SECRET, "").replace(/\n{3,}/g, "\n\n").trim();
}

// For exports: [[Nome]] becomes Nome, secret markers go (the secrets themselves stay unless removed first), and
// tables become tab-separated rows with their formulas worked out.
export function plainText(text: string) {
  return tablesToText(text, "tsv").replace(MENTION, "$1").replace(/\[\/?segredo\]/gi, "").trim();
}

// The timeline's order for a "Quando" like "Ano 312, inverno" or "-50": its first number. null when it has none.
export function timelineOrder(when: string) {
  const match = when.match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number.parseFloat(match[0].replace(",", ".")) : null;
}
