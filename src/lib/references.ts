// A source's bibliographic reference (the "citations" feature), kept on its note (notes.reference, as JSON), and
// how it's written in ABNT: in the reference list (NBR 6023) and cited in the text (NBR 10520).

export const SOURCE_TYPES = [
  { id: "livro", label: "Livro" },
  { id: "artigo", label: "Artigo de periódico" },
  { id: "capitulo", label: "Capítulo de livro" },
  { id: "tese", label: "Tese, dissertação ou TCC" },
  { id: "site", label: "Página da internet" },
  { id: "outro", label: "Outro" },
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number]["id"];

// Authors and editors are written as the user types them, one per ";": "Silva, João; Souza, Maria". A name with no
// comma is an institution ("Instituto Brasileiro de Geografia e Estatística").
export type Reference = {
  type: SourceType;
  authors: string;
  year: string;
  title: string;
  subtitle: string;
  // The journal (artigo), the whole book (capítulo) or the site (site); for "outro", where it was published.
  container: string;
  // The book's organizers, for a chapter.
  editors: string;
  edition: string;
  place: string;
  publisher: string;
  volume: string;
  issue: string;
  pages: string;
  // For a thesis: "Tese (Doutorado em Letras)" and the university.
  degree: string;
  institution: string;
  doi: string;
  url: string;
  // When the page was read, as the user writes it ("12 mar. 2025").
  accessed: string;
};

export type ReferenceKey = Exclude<keyof Reference, "type">;

export function emptyReference(type: SourceType = "livro"): Reference {
  return {
    type,
    authors: "",
    year: "",
    title: "",
    subtitle: "",
    container: "",
    editors: "",
    edition: "",
    place: "",
    publisher: "",
    volume: "",
    issue: "",
    pages: "",
    degree: "",
    institution: "",
    doi: "",
    url: "",
    accessed: "",
  };
}

// The fields the form shows for each type of source, in order.
export const REFERENCE_FIELDS: Record<SourceType, ReferenceKey[]> = {
  livro: ["authors", "title", "subtitle", "edition", "place", "publisher", "year", "pages", "doi", "url", "accessed"],
  artigo: ["authors", "title", "subtitle", "container", "place", "volume", "issue", "pages", "year", "doi", "url", "accessed"],
  capitulo: ["authors", "title", "editors", "container", "edition", "place", "publisher", "year", "pages", "doi", "url", "accessed"],
  tese: ["authors", "title", "subtitle", "year", "degree", "institution", "place", "url", "accessed"],
  site: ["authors", "title", "container", "year", "url", "accessed"],
  outro: ["authors", "title", "subtitle", "container", "place", "publisher", "year", "pages", "doi", "url", "accessed"],
};

export const FIELD_LABELS: Record<ReferenceKey, { label: string; placeholder?: string }> = {
  authors: { label: "Autores", placeholder: "Sobrenome, Nome; Sobrenome, Nome" },
  year: { label: "Ano", placeholder: "2021" },
  title: { label: "Título" },
  subtitle: { label: "Subtítulo" },
  container: { label: "Publicado em", placeholder: "Revista, livro ou site" },
  editors: { label: "Organizadores", placeholder: "Sobrenome, Nome; Sobrenome, Nome" },
  edition: { label: "Edição", placeholder: "2" },
  place: { label: "Local", placeholder: "São Paulo" },
  publisher: { label: "Editora" },
  volume: { label: "Volume" },
  issue: { label: "Número" },
  pages: { label: "Páginas", placeholder: "45-67" },
  degree: { label: "Tipo de trabalho", placeholder: "Tese (Doutorado em Letras)" },
  institution: { label: "Instituição", placeholder: "Universidade de São Paulo" },
  doi: { label: "DOI", placeholder: "10.1000/xyz123" },
  url: { label: "Endereço (URL)" },
  accessed: { label: "Acesso em", placeholder: "12 mar. 2025" },
};

// The stored JSON, filled out to every field; null when the note isn't a source.
export function parseReference(stored: string | null | undefined): Reference | null {
  if (!stored) return null;
  try {
    const value = JSON.parse(stored);
    if (!value || typeof value !== "object") return null;
    const reference = emptyReference(SOURCE_TYPES.some(type => type.id === value.type) ? value.type : "outro");
    for (const key of Object.keys(reference) as ReferenceKey[]) {
      if (key !== ("type" as string) && typeof value[key] === "string") reference[key] = value[key];
    }
    return reference;
  } catch {
    return null;
  }
}

export function serializeReference(reference: Reference | null) {
  return reference ? JSON.stringify(reference) : null;
}

// Everything typed into it, for the volume's search.
export function referenceText(reference: Reference) {
  return Object.values(reference).join(" ");
}

type Name = { family: string; given: string; institution: boolean };

function parseNames(text: string): Name[] {
  return text
    .split(";")
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => {
      const comma = name.indexOf(",");
      if (comma === -1) return { family: name, given: "", institution: true };
      return { family: name.slice(0, comma).trim(), given: name.slice(comma + 1).trim(), institution: false };
    });
}

const upper = (text: string) => text.toLocaleUpperCase("pt-BR");

// "SILVA, João" or, for an institution, "INSTITUTO BRASILEIRO DE GEOGRAFIA E ESTATÍSTICA".
function listName(name: Name) {
  return name.institution || !name.given ? upper(name.family) : `${upper(name.family)}, ${name.given}`;
}

// NBR 6023: up to three authors all named; from four on, the first one and "et al.".
function authorList(text: string) {
  const names = parseNames(text);
  if (!names.length) return "";
  if (names.length > 3) return `${listName(names[0]!)} et al.`;
  return names.map(listName).join("; ");
}

// A piece of a formatted reference; emphasized pieces (the title, or the journal) are bold in ABNT.
export type RefPart = { text: string; emphasis?: boolean };

// Ends a sentence with a period, unless it already ends with one (an abbreviation, "et al.", "?").
function sentence(text: string) {
  const trimmed = text.trim();
  return /[.?!]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function edition(text: string) {
  const value = text.trim();
  if (!value) return "";
  return /^\d+$/.test(value) ? `${value}. ed.` : sentence(value);
}

function pages(text: string, prefix: string) {
  const value = text.trim().replace(/^p+\.\s*/i, "");
  return value ? `${prefix} ${value.replace(/\s*[-–]\s*/, "-")}` : "";
}

function doi(text: string) {
  const value = text.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return value ? `DOI: https://doi.org/${value}.` : "";
}

const year = (reference: Reference) => reference.year.trim() || "[s. d.]";
const imprint = (reference: Reference) =>
  `${reference.place.trim() || "[S. l.]"}: ${reference.publisher.trim() || "[s. n.]"}, ${year(reference)}.`;

// Online: the DOI, or the address with the day it was read.
function online(reference: Reference) {
  const parts = [doi(reference.doi)];
  if (reference.url.trim()) {
    parts.push(`Disponível em: ${reference.url.trim()}.`);
    if (reference.accessed.trim()) parts.push(`Acesso em: ${sentence(reference.accessed)}`);
  }
  return parts.filter(Boolean).join(" ");
}

// The title in bold and, after a colon, the subtitle in plain type.
function titleParts(reference: Reference, end = "."): RefPart[] {
  const title = reference.title.trim() || "[Sem título]";
  const subtitle = reference.subtitle.trim();
  return subtitle ? [{ text: title, emphasis: true }, { text: `: ${subtitle}${end}` }] : [{ text: title, emphasis: true }, { text: end }];
}

// The title in plain type (an article or a chapter, whose journal or book is the bold part).
function plainTitle(reference: Reference) {
  const title = reference.title.trim() || "[Sem título]";
  const subtitle = reference.subtitle.trim();
  return sentence(subtitle ? `${title}: ${subtitle}` : title);
}

function join(parts: (RefPart | string | null | undefined | false)[]): RefPart[] {
  const out: RefPart[] = [];
  for (const part of parts) {
    if (!part) continue;
    const piece = typeof part === "string" ? { text: part } : part;
    if (!piece.text) continue;
    const previous = out[out.length - 1];
    // A space between pieces, except before the punctuation that closes one.
    const glue = previous && !/^[\s.,:;)]/.test(piece.text) && !/\s$/.test(previous.text) ? " " : "";
    out.push({ ...piece, text: glue + piece.text });
  }
  return out;
}

// The reference as it goes in the list at the end of the text (NBR 6023:2018).
export function formatReference(reference: Reference): RefPart[] {
  const authors = authorList(reference.authors);
  const lead = authors ? sentence(authors) : null;
  const r = reference;

  switch (r.type) {
    case "livro":
      return join([lead, ...titleParts(r), edition(r.edition), imprint(r), r.pages.trim() && `${r.pages.trim().replace(/^(\d+)$/, "$1 p")}.`, online(r)]);
    case "artigo":
      return join([
        lead,
        plainTitle(r),
        { text: r.container.trim() || "[Periódico]", emphasis: true },
        [r.place.trim(), r.volume.trim() && `v. ${r.volume.trim()}`, r.issue.trim() && `n. ${r.issue.trim()}`, pages(r.pages, "p."), year(r)]
          .filter(Boolean)
          .map(part => `, ${part}`)
          .join("") + ".",
        online(r),
      ]);
    case "capitulo": {
      const editors = authorList(r.editors);
      return join([
        lead,
        plainTitle(r),
        "In:",
        editors ? `${editors} (org.).` : null,
        { text: r.container.trim() || "[Livro]", emphasis: true },
        ".",
        edition(r.edition),
        imprint(r),
        r.pages.trim() && `${pages(r.pages, "p.")}.`,
        online(r),
      ]);
    }
    case "tese":
      return join([
        lead,
        ...titleParts(r),
        `${year(r)}.`,
        r.degree.trim() || "Trabalho acadêmico",
        [r.institution.trim(), r.place.trim(), year(r)].filter(Boolean).map((part, index) => (index ? `, ${part}` : ` – ${part}`)).join("") + ".",
        online(r),
      ]);
    case "site":
      return join([lead, ...titleParts(r), r.container.trim() && `${r.container.trim()},`, `${year(r)}.`, online(r)]);
    default:
      return join([
        lead,
        ...titleParts(r),
        r.container.trim() && sentence(r.container),
        r.place.trim() || r.publisher.trim() ? imprint(r) : `${year(r)}.`,
        r.pages.trim() && `${pages(r.pages, "p.")}.`,
        online(r),
      ]);
  }
}

export function referencePlain(reference: Reference) {
  return formatReference(reference)
    .map(part => part.text)
    .join("");
}

// Bold as Markdown, for the .md download.
export function referenceMarkdown(reference: Reference) {
  return formatReference(reference)
    .map(part => (part.emphasis ? part.text.replace(/^(\s*)(.+?)(\s*)$/, "$1**$2**$3") : part.text))
    .join("");
}

// The author part of a citation in the text: "SILVA", "SILVA; SOUZA", "SILVA et al.". With no author, the title's
// first word, as NBR 10520 asks ("ESTUDO...").
function citationAuthor(reference: Reference) {
  const names = parseNames(reference.authors);
  if (!names.length) {
    const first = reference.title.trim().split(/\s+/)[0] ?? "";
    return first ? `${upper(first)}...` : "[S. A.]";
  }
  if (names.length > 3) return `${upper(names[0]!.family)} et al.`;
  return names.map(name => upper(name.family)).join("; ");
}

// "42" is a page; "p. 42", "cap. 3" or anything else is kept as written.
function formatLocator(locator: string) {
  const value = locator.trim();
  return /^\d[\d\s,–-]*$/.test(value) ? `p. ${value}` : value;
}

// One source as cited in the text: "SILVA, 2021, p. 42".
export function citationText(reference: Reference, locator = "") {
  const where = locator.trim() ? `, ${formatLocator(locator)}` : "";
  return `${citationAuthor(reference)}, ${year(reference)}${where}`;
}

// What sorts the reference list: alphabetical by the start of the reference (the authors), then the year.
export function referenceSortKey(reference: Reference) {
  return `${referencePlain(reference).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()}`;
}

// Turning a note that kept its source in custom fields ("Autor(es)", "Ano"…, as the Fonte template did) into a
// source: the reference those fields make, and the fields that weren't taken.
const FIELD_MAP: Record<string, ReferenceKey> = {
  "autor(es)": "authors",
  autor: "authors",
  autores: "authors",
  ano: "year",
  titulo: "title",
  publicacao: "container",
  revista: "container",
  editora: "publisher",
  local: "place",
  paginas: "pages",
  "doi ou url": "doi",
  doi: "doi",
  url: "url",
};

const fieldKey = (key: string) => key.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export function referenceFromFields(fields: { key: string; value: string }[], title: string) {
  const reference = emptyReference(fields.some(field => fieldKey(field.key) === "publicacao" && field.value.trim()) ? "artigo" : "livro");
  const rest: typeof fields = [];
  for (const field of fields) {
    let target = FIELD_MAP[fieldKey(field.key)];
    if (target === "doi" && /^https?:\/\//i.test(field.value.trim()) && !/doi\.org/i.test(field.value)) target = "url";
    if (target && !reference[target]) reference[target] = field.value.trim();
    else if (!target) rest.push(field);
  }
  if (!reference.title) reference.title = title.trim();
  return { reference, rest };
}

// Whether a note looks like a source kept in fields, so it's worth offering to turn it into one.
export function looksLikeSource(fields: { key: string; value: string }[]) {
  return fields.some(field => FIELD_MAP[fieldKey(field.key)] === "authors" && field.value.trim());
}
