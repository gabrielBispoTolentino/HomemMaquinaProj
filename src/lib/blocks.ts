import { parseRows, tableBlock, type Sheet } from "./sheets";

// The blocks a gadget puts into a note's text (see gadgets.ts), each on lines of its own:
//
//   [tabela] … [/tabela]       a table (sheets.ts)
//   [imagem:ID|Legenda]        an image, kept in note_images (images.ts); the caption is optional
//
// Being in the text itself, they're found by search and kept by versions, sync and the Lixeira with nothing new.

export type BlockKind = "table" | "image";

export type BodyPart =
  | { kind: "text"; text: string }
  | { kind: "table"; rows: Sheet }
  // upload is the picture itself, only on an image just picked and not stored yet (see insertGadget in NoteEditor).
  | { kind: "image"; id: string; caption: string; upload?: { data: string; width: number; height: number } };

// The newline on each side belongs to the block, so the text around it doesn't gain blank lines on every save.
const PATTERNS: Record<BlockKind, string> = {
  table: String.raw`(?<table>\[tabela\]\n?(?<tableBody>[\s\S]*?)\n?\[\/tabela\])`,
  image: String.raw`(?<image>\[imagem:(?<imageId>[\w-]+)(?:\|(?<imageCaption>[^\]\n]*))?\])`,
};

function blockPattern(kinds: Iterable<BlockKind>) {
  const alternatives = [...new Set(kinds)].map(kind => PATTERNS[kind]);
  return alternatives.length ? new RegExp(String.raw`\n?(?:${alternatives.join("|")})\n?`, "gi") : null;
}

// The text cut at its blocks (only the kinds whose feature is on; the rest stay text): always text, block, text, …,
// text, so there is somewhere to write around each block.
export function bodyParts(content: string, kinds: Iterable<BlockKind>): BodyPart[] {
  const pattern = blockPattern(kinds);
  if (!pattern) return [{ kind: "text", text: content }];
  const parts: BodyPart[] = [];
  let last = 0;
  for (const match of content.matchAll(pattern)) {
    parts.push({ kind: "text", text: content.slice(last, match.index) });
    const groups = match.groups!;
    if (groups.table !== undefined) parts.push({ kind: "table", rows: parseRows(groups.tableBody ?? "") });
    else parts.push({ kind: "image", id: groups.imageId!, caption: groups.imageCaption ?? "" });
    last = match.index + match[0].length;
  }
  parts.push({ kind: "text", text: content.slice(last) });
  return parts;
}

function serializeBlock(part: Exclude<BodyPart, { kind: "text" }>) {
  if (part.kind === "table") return tableBlock(part.rows);
  const caption = part.caption.replace(/[\]\n]/g, "");
  return caption ? `[imagem:${part.id}|${caption}]` : `[imagem:${part.id}]`;
}

// Back into the note's text, each block on lines of its own. Two texts left side by side (a block between them was
// removed) become one; no text between two blocks (or after the last) adds nothing.
export function joinParts(parts: BodyPart[]) {
  let out = "";
  let previous: BodyPart["kind"] | null = null;
  for (const part of parts) {
    if (part.kind !== "text") {
      if (out) out += "\n";
      out += serializeBlock(part);
    } else if (previous === null) {
      out += part.text;
    } else if (previous === "text") {
      if (out && part.text) out += "\n";
      out += part.text;
    } else {
      if (part.text) out += `\n${part.text}`;
      // Stays after the block, so the next block is one line below it.
      else continue;
    }
    previous = part.kind;
  }
  return out;
}

const IMAGE_BLOCK = /\n?\[imagem:([\w-]+)(?:\|([^\]\n]*))?\]\n?/gi;

// Every image the text shows, by id.
export function imageIds(text: string) {
  return [...text.matchAll(IMAGE_BLOCK)].map(match => match[1]!);
}

// Images as text, for exports: each one replaced by what `render` makes of it, on lines of its own.
export function imagesToText(text: string, render: (id: string, caption: string) => string) {
  return text
    .replace(IMAGE_BLOCK, (_whole, id: string, caption = "") => {
      const shown = render(id, caption.trim());
      return shown ? `\n\n${shown}\n\n` : "\n";
    })
    .replace(/\n{3,}/g, "\n\n");
}

// The text without its blocks, e.g. for counting the words written: tables and images aren't writing.
export function withoutBlocks(text: string) {
  const pattern = blockPattern(["table", "image"])!;
  return text.replace(pattern, "\n");
}
