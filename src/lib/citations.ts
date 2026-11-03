import type { NoteItem } from "./notes";
import { MENTION, titleKey } from "./mentions";
import { citationText, referenceSortKey, type Reference } from "./references";

// Citing sources in the text (the "citations" feature) and footnotes (the "footnotes" feature):
//
//   [@Silva 2021]                  cites the source note with that title: (SILVA, 2021)
//   [@Silva 2021, p. 42]           with where in it: (SILVA, 2021, p. 42); a bare number is a page
//   [@Silva 2021; @Souza 2019]     several at once: (SILVA, 2021; SOUZA, 2019)
//   [nota]Texto da nota.[/nota]    a footnote, numbered in the manuscript
//
// A source is a note with a reference (references.ts); like [[mentions]], citations find it by title, ignoring case
// and accents.

const CITATION = /\[@([^\]\n]+)\]/g;
const FOOTNOTE = /\[nota\]([\s\S]*?)\[\/nota\]/gi;

export type CitedItem = { name: string; locator: string };

// "Silva 2021, p. 42" → name and locator. The locator is what follows the last comma, when it looks like one (a
// number, or p./cap./v./… and something), so a title with commas in it still works.
function citedItem(text: string): CitedItem {
  const item = text.trim().replace(/^@/, "").trim();
  const comma = item.lastIndexOf(",");
  if (comma > 0) {
    const tail = item.slice(comma + 1).trim();
    if (/^(\d|§\s*\d|(p|pp|cap|caps|v|n|t|f|fl|seç|sec|fig|tab|l)(\.|\s)\s*\S)/i.test(tail)) {
      return { name: item.slice(0, comma).trim(), locator: tail };
    }
  }
  return { name: item, locator: "" };
}

export function citedItems(inner: string) {
  return inner
    .split(";")
    .map(citedItem)
    .filter(item => item.name);
}

// Source notes by title key. A note in the listing is a source when it has a reference.
export type SourceNote = NoteItem & { reference: Reference };

export function isSource(note: NoteItem): note is SourceNote {
  return note.reference !== null;
}

export function sourcesByTitle(notes: NoteItem[]) {
  const byTitle = new Map<string, SourceNote>();
  for (const note of notes) {
    const key = titleKey(note.title);
    if (isSource(note) && key && !byTitle.has(key)) byTitle.set(key, note);
  }
  return byTitle;
}

// "(SILVA, 2021, p. 42; SOUZA, 2019)", or null when a source in it isn't found.
export function formatCitation(inner: string, sources: Map<string, SourceNote>) {
  const items = citedItems(inner);
  const texts: string[] = [];
  for (const item of items) {
    const source = sources.get(titleKey(item.name));
    if (!source) return null;
    texts.push(citationText(source.reference, item.locator));
  }
  return texts.length ? `(${texts.join("; ")})` : null;
}

// The sources a text cites, each once, in the order first cited.
export function citedSources(text: string, sources: Map<string, SourceNote>) {
  const found: SourceNote[] = [];
  for (const match of text.matchAll(CITATION)) {
    for (const item of citedItems(match[1]!)) {
      const source = sources.get(titleKey(item.name));
      if (source && !found.includes(source)) found.push(source);
    }
  }
  return found;
}

// The names a text cites that match no source.
export function brokenCitations(text: string, sources: Map<string, SourceNote>) {
  const names: string[] = [];
  for (const match of text.matchAll(CITATION)) {
    for (const item of citedItems(match[1]!)) {
      if (!sources.has(titleKey(item.name)) && !names.includes(item.name)) names.push(item.name);
    }
  }
  return names;
}

// Whether a text cites this source, for the notes that mention it.
export function citesTitle(text: string, key: string) {
  for (const match of text.matchAll(CITATION)) {
    if (citedItems(match[1]!).some(item => titleKey(item.name) === key)) return true;
  }
  return false;
}

// The citation being typed just before the caret, "[@Sil" or "[@Silva 2021; @Sou": where its name starts and what's
// typed of it so far.
export function citationAtCaret(text: string, caret: number) {
  const match = text.slice(0, caret).match(/\[@(?:[^\]\n]*;\s*@?)?([^\];\n]*)$/);
  return match ? { start: caret - match[1]!.length, query: match[1]! } : null;
}

// The note's text cut for showing while it isn't edited: plain runs, [[mentions]], [@citations] and the [nota]
// markers around a footnote, each with where it starts in the text. Only the kinds asked for are cut out; the rest
// stay plain text.
export type InlineSegment =
  | { kind: "text"; start: number; text: string; footnote: boolean }
  | { kind: "mention"; start: number; text: string; name: string; footnote: boolean }
  | { kind: "citation"; start: number; text: string; inner: string; footnote: boolean }
  | { kind: "footnote-open"; start: number; text: string; number: number }
  | { kind: "footnote-close"; start: number; text: string; number: number };

export function inlineSegments(text: string, kinds: { mentions: boolean; citations: boolean; footnotes: boolean }) {
  const alternatives: string[] = [];
  if (kinds.mentions) alternatives.push(String.raw`\[\[(?<mention>[^[\]\n]+?)\]\]`);
  if (kinds.citations) alternatives.push(String.raw`\[@(?<citation>[^\]\n]+)\]`);
  if (kinds.footnotes) alternatives.push(String.raw`(?<open>\[nota\])`, String.raw`(?<close>\[\/nota\])`);
  if (!alternatives.length) return [{ kind: "text", start: 0, text, footnote: false }] as InlineSegment[];

  const segments: InlineSegment[] = [];
  let last = 0;
  let inFootnote = false;
  let footnotes = 0;
  for (const match of text.matchAll(new RegExp(alternatives.join("|"), "gi"))) {
    const groups = match.groups!;
    // A [/nota] with no [nota] before it, or a second [nota] inside one, is just text.
    if ((groups.close !== undefined && !inFootnote) || (groups.open !== undefined && inFootnote)) continue;
    if (match.index > last) segments.push({ kind: "text", start: last, text: text.slice(last, match.index), footnote: inFootnote });
    const base = { start: match.index, text: match[0] };
    if (groups.mention !== undefined) segments.push({ ...base, kind: "mention", name: groups.mention, footnote: inFootnote });
    else if (groups.citation !== undefined) segments.push({ ...base, kind: "citation", inner: groups.citation, footnote: inFootnote });
    else if (groups.open !== undefined) {
      inFootnote = true;
      segments.push({ ...base, kind: "footnote-open", number: ++footnotes });
    } else {
      inFootnote = false;
      segments.push({ ...base, kind: "footnote-close", number: footnotes });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", start: last, text: text.slice(last), footnote: inFootnote });
  return segments;
}

// Footnote markers in a text resolved for reading: replaced by `FOOTNOTE_MARK(n)`, where the page draws a
// superscript number.
export const FOOTNOTE_MARK = (n: number) => `\u0000${n}\u0000`;
export const FOOTNOTE_MARKS = /\u0000(\d+)\u0000/;

// Resolves citations and footnotes through a whole manuscript, in reading order: citations become "(SILVA, 2021)",
// footnotes are numbered and collected, and the sources cited are gathered for the reference list. A citation
// whose source isn't found stays as it was written, so it shows what needs fixing.
export class CitationResolver {
  readonly footnotes: string[] = [];
  readonly cited: SourceNote[] = [];

  constructor(
    private readonly sources: Map<string, SourceNote>,
    private readonly options: { citations: boolean; footnotes: boolean; mark: (n: number) => string },
  ) {}

  private citations(text: string) {
    if (!this.options.citations) return text;
    return text.replace(CITATION, (whole, inner: string) => {
      const formatted = formatCitation(inner, this.sources);
      if (!formatted) return whole;
      for (const item of citedItems(inner)) {
        const source = this.sources.get(titleKey(item.name))!;
        if (!this.cited.includes(source)) this.cited.push(source);
      }
      return formatted;
    });
  }

  resolve(text: string) {
    let out = text;
    if (this.options.footnotes) {
      out = out.replace(FOOTNOTE, (_whole, inner: string) => {
        this.footnotes.push(this.citations(inner).replace(MENTION, "$1").replace(/\s+/g, " ").trim());
        return this.options.mark(this.footnotes.length);
      });
    }
    return this.citations(out);
  }

  // The cited sources in the order of the reference list.
  references() {
    return [...this.cited].sort((a, b) => referenceSortKey(a.reference).localeCompare(referenceSortKey(b.reference), "pt-BR"));
  }
}

// For word counts and the corkboard: citations and footnote markers aren't words written.
export function withoutCitationMarkup(text: string) {
  return text.replace(CITATION, " ").replace(/\[\/?nota\]/gi, " ");
}
