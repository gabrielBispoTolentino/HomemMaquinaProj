import { citedItems, formatCitation, inlineSegments, type SourceNote } from "../lib/citations";
import { titleKey } from "../lib/mentions";
import type { NoteItem } from "../lib/notes";

type MentionTextProps = {
  content: string;
  byTitle: Map<string, NoteItem>;
  // The volume's sources, for [@citations].
  sources: Map<string, SourceNote>;
  // What's shown as links and notes; the rest reads as typed.
  kinds: { mentions: boolean; citations: boolean; footnotes: boolean };
  // The open note, so a mention of itself isn't a link.
  noteId: string | null;
  onOpenNote: (note: NoteItem) => void;
  // Clicked somewhere other than a link: edit with the caret at that point of the text.
  onEdit: (caret: number, scrollTop: number) => void;
};

// Where a click landed, as a text node and an offset in it.
function pointInText(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    return position && { node: position.offsetNode, offset: position.offset };
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

// Where in the text a point of this reading view falls (its end when the point isn't on the text), e.g. for a
// click or a right click.
export function caretAtPoint(container: HTMLElement, x: number, y: number, length: number) {
  const point = pointInText(x, y);
  const run = point?.node.parentElement?.closest<HTMLElement>("[data-start]");
  const caret = point && run && container.contains(run) ? Number(run.dataset.start) + point.offset : length;
  return Math.min(caret, length);
}

// The note's text while it isn't being edited: [[Nome]] shows as just the name, underlined, and one click opens that
// note; [@Fonte] shows as it will be cited, "(SILVA, 2021)", and opens the source; a [nota] shows as its number with
// the note's text in small type. Laid out exactly like the textarea it replaces, so switching between the two
// doesn't move anything.
export default function MentionText({ content, byTitle, sources, kinds, noteId, onOpenNote, onEdit }: MentionTextProps) {
  const startEditing = (event: React.MouseEvent<HTMLDivElement>) => {
    // Leave a selection alone, so text can still be copied from here.
    if (!window.getSelection()?.isCollapsed) return;
    onEdit(caretAtPoint(event.currentTarget, event.clientX, event.clientY, content.length), event.currentTarget.scrollTop);
  };

  // A link that opens a note, by click or Enter.
  const link = (key: number, target: NoteItem, text: string, className: string, title?: string) => (
    <span
      key={key}
      className={className}
      role="link"
      tabIndex={0}
      title={title}
      onClick={event => {
        event.stopPropagation();
        onOpenNote(target);
      }}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpenNote(target);
        }
      }}
    >
      {text}
    </span>
  );

  return (
    <div
      className="note-editor__content note-editor__content--reading"
      role="textbox"
      aria-multiline="true"
      aria-readonly="false"
      tabIndex={0}
      onClick={startEditing}
      onKeyDown={event => {
        if (event.target === event.currentTarget && event.key === "Enter") {
          event.preventDefault();
          onEdit(content.length, event.currentTarget.scrollTop);
        }
      }}
    >
      {inlineSegments(content, kinds).map(segment => {
        const inNote = "footnote" in segment && segment.footnote ? " footnote-text" : "";

        if (segment.kind === "footnote-open") {
          return (
            <sup key={segment.start} className="footnote-mark" data-start={segment.start} title="Nota de rodapé">
              {segment.number}
            </sup>
          );
        }
        if (segment.kind === "footnote-close") return null;

        if (segment.kind === "text") {
          return (
            <span key={segment.start} data-start={segment.start} className={inNote || undefined}>
              {segment.text}
            </span>
          );
        }

        if (segment.kind === "citation") {
          const formatted = formatCitation(segment.inner, sources);
          const first = sources.get(titleKey(citedItems(segment.inner)[0]?.name ?? ""));
          if (!formatted || !first) {
            return (
              <span
                key={segment.start}
                data-start={segment.start}
                className={`citation citation--missing${inNote}`}
                title="Nenhuma fonte com este título"
              >
                {segment.text}
              </span>
            );
          }
          return link(segment.start, first, formatted, `citation${inNote}`, `Abrir a fonte “${first.title.trim()}”`);
        }

        const target = byTitle.get(titleKey(segment.name));
        // The name sits two characters in, after the opening [[.
        if (!target || target.id === noteId) {
          return (
            <span
              key={segment.start}
              data-start={segment.start + 2}
              className={(target ? inNote.trim() : `mention-link mention-link--missing${inNote}`) || undefined}
              title={target ? undefined : "Nenhum verbete com este título"}
            >
              {segment.name}
            </span>
          );
        }
        return link(segment.start, target, segment.name, `mention-link${inNote}`);
      })}
    </div>
  );
}
