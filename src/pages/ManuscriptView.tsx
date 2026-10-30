import { Capacitor } from "@capacitor/core";
import { Fragment, useState, type ReactNode } from "react";
import { featureOn, type FeatureId } from "../lib/features";
import { MENTION, plainText, withoutSecrets } from "../lib/mentions";
import type { NoteItem } from "../lib/notes";
import { bodyParts, evaluateSheet, tablesToText, type Sheet } from "../lib/sheets";
import { childrenOf } from "../lib/order";
import type { SubgroupItem } from "../lib/subgroups";
import { countWords, formatWords } from "../lib/writing";
import "./CSS/Sheets.css";
import "./CSS/Writing.css";

type ManuscriptViewProps = {
  // The subgroup to read; null for the whole volume.
  rootId: string | null;
  worldName: string;
  notes: NoteItem[];
  subgroups: SubgroupItem[];
  features: Set<FeatureId>;
  headStart?: ReactNode;
  onOpenNote: (note: NoteItem) => void;
  onShowBoard: (subgroupId: string | null) => void;
};

type Section =
  | { kind: "heading"; id: string; depth: number; text: string }
  | { kind: "note"; note: NoteItem; depth: number };

// Everything inside, depth first and in order: a subgroup's name as a heading, then what's in it.
function sectionsOf(rootId: string | null, notes: NoteItem[], subgroups: SubgroupItem[]) {
  const sections: Section[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const child of childrenOf(parentId, notes, subgroups)) {
      if (child.kind === "note") {
        sections.push({ kind: "note", note: child.item, depth });
      } else {
        sections.push({ kind: "heading", id: child.item.id, depth, text: child.item.name });
        walk(child.item.id, depth + 1);
      }
    }
  };
  walk(rootId, 0);
  return sections;
}

// Headings start at h2 under the manuscript's own h1, and stop at h6.
function headingLevel(depth: number) {
  return Math.min(depth + 2, 6);
}

// A note's text for reading and exporting: [[Nome]] mentions read as plain names, in the players' version the game
// master's secrets are left out, and tables are Markdown tables or tab-separated rows (which paste into a
// spreadsheet as cells), formulas worked out.
function noteText(content: string, players: boolean, tables: "tsv" | "markdown" = "tsv") {
  return plainText(tablesToText(players ? withoutSecrets(content) : content, tables));
}

// A table on the page, with formulas worked out; the first row is its header.
function SheetTable({ rows }: { rows: Sheet }) {
  const [head = [], ...body] = evaluateSheet(rows);
  const text = (value: string) => value.replace(MENTION, "$1");
  return (
    <table className="manuscript__table">
      <thead>
        <tr>
          {head.map((cell, col) => (
            <th key={col} className={cell.kind === "number" ? "manuscript__number" : undefined}>
              {text(cell.text)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((cells, row) => (
          <tr key={row}>
            {cells.map((cell, col) => (
              <td key={col} className={cell.kind === "number" ? "manuscript__number" : undefined} title={cell.title}>
                {text(cell.text)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A note on the page: its text (secrets marked, or left out for the players) with its tables drawn as tables.
function NoteBody({ content, players, secrets, tables }: { content: string; players: boolean; secrets: boolean; tables: boolean }) {
  const source = players ? withoutSecrets(content) : content;
  if (!tables) return <>{secrets && !players ? <NoteText content={source} /> : plainText(source)}</>;
  return (
    <>
      {bodyParts(source).map((part, index) =>
        part.kind === "table" ? (
          <SheetTable key={index} rows={part.rows} />
        ) : (
          <Fragment key={index}>{secrets && !players ? <NoteText content={part.text} /> : plainText(part.text)}</Fragment>
        ),
      )}
    </>
  );
}

// On the page, secrets that stay in are marked as such.
function NoteText({ content }: { content: string }) {
  const parts = content.trim().split(/\[segredo\]([\s\S]*?)\[\/segredo\]/i);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 ? (
          <span key={index} className="manuscript__secret">
            {part.replace(MENTION, "$1").trim()}
          </span>
        ) : (
          part.replace(MENTION, "$1").replace(/\[\/?segredo\]/gi, "")
        ),
      )}
    </>
  );
}

function toMarkdown(title: string, sections: Section[], players: boolean) {
  const parts = [`# ${title}`];
  for (const section of sections) {
    const hashes = "#".repeat(headingLevel(section.depth));
    if (section.kind === "heading") parts.push(`${hashes} ${section.text}`);
    else {
      if (section.note.title.trim()) parts.push(`${hashes} ${section.note.title.trim()}`);
      const text = noteText(section.note.content, players, "markdown");
      if (text) parts.push(text);
    }
  }
  return `${parts.join("\n\n")}\n`;
}

function toPlainText(title: string, sections: Section[], players: boolean) {
  const parts = [title];
  for (const section of sections) {
    if (section.kind === "heading") parts.push(section.text.toUpperCase());
    else parts.push(...[section.note.title.trim(), noteText(section.note.content, players)].filter(Boolean));
  }
  return `${parts.join("\n\n")}\n`;
}

// A subgroup (or the whole volume) read as one continuous text, the way it would be printed. It can be copied,
// downloaded as Markdown or printed (to PDF, on a computer).
export default function ManuscriptView(props: ManuscriptViewProps) {
  const { rootId, notes, subgroups, features } = props;
  const [copied, setCopied] = useState(false);
  // The players' version leaves out the game master's secrets (with the "secrets" feature).
  const [players, setPlayers] = useState(false);
  const secrets = featureOn(features, "secrets");
  const hideSecrets = secrets && players;
  const title = subgroups.find(subgroup => subgroup.id === rootId)?.name ?? props.worldName;
  const sections = sectionsOf(rootId, notes, subgroups);
  const words = sections.reduce((total, section) => total + (section.kind === "note" ? countWords(section.note.content) : 0), 0);
  // The phone apps can't save a downloaded file from the WebView; copying works everywhere.
  const canDownload = !Capacitor.isNativePlatform();

  const copy = async () => {
    await navigator.clipboard.writeText(toPlainText(title, sections, hideSecrets));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([toMarkdown(title, sections, hideSecrets)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[\\/:*?"<>|]+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="manuscript-pane">
      <header className="manuscript-pane__toolbar">
        {props.headStart}
        <span className="manuscript-pane__words">{formatWords(words)}</span>
        {secrets && (
          <label className="manuscript-pane__players">
            <input type="checkbox" checked={players} onChange={event => setPlayers(event.target.checked)} />
            Versão dos jogadores
          </label>
        )}
        {featureOn(features, "corkboard") && (
          <button type="button" className="writing-button" onClick={() => props.onShowBoard(rootId)}>
            Quadro
          </button>
        )}
        <button type="button" className="writing-button" onClick={copy}>
          {copied ? "Copiado!" : "Copiar"}
        </button>
        {canDownload && (
          <>
            <button type="button" className="writing-button" onClick={download}>
              Baixar .md
            </button>
            <button type="button" className="writing-button" onClick={() => window.print()}>
              Imprimir
            </button>
          </>
        )}
      </header>

      <div className="manuscript">
        <h1 className="manuscript__title">{title}</h1>
        {sections.length === 0 && <p className="manuscript__empty">Ainda não há verbetes aqui.</p>}
        {sections.map(section => {
          const Heading = `h${headingLevel(section.depth)}` as "h2";
          if (section.kind === "heading") {
            return (
              <Heading key={section.id} className="manuscript__part">
                {section.text}
              </Heading>
            );
          }

          const { note } = section;
          return (
            <section key={note.id} className="manuscript__note">
              {note.title.trim() && (
                <Heading className="manuscript__heading">
                  <button type="button" onClick={() => props.onOpenNote(note)} title="Abrir para editar">
                    {note.title.trim()}
                  </button>
                </Heading>
              )}
              <div className="manuscript__text">
                <NoteBody content={note.content} players={hideSecrets} secrets={secrets} tables={featureOn(features, "tables")} />
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
