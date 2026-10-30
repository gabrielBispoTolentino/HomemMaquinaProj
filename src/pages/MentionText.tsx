import { mentionSegments, titleKey } from "../lib/mentions";
import type { NoteItem } from "../lib/notes";

type MentionTextProps = {
  content: string;
  byTitle: Map<string, NoteItem>;
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
// note. Laid out exactly like the textarea it replaces, so switching between the two doesn't move anything.
export default function MentionText({ content, byTitle, noteId, onOpenNote, onEdit }: MentionTextProps) {
  const startEditing = (event: React.MouseEvent<HTMLDivElement>) => {
    // Leave a selection alone, so text can still be copied from here.
    if (!window.getSelection()?.isCollapsed) return;
    onEdit(caretAtPoint(event.currentTarget, event.clientX, event.clientY, content.length), event.currentTarget.scrollTop);
  };

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
      {mentionSegments(content).map(segment => {
        if (segment.name === undefined) {
          return (
            <span key={segment.start} data-start={segment.start}>
              {segment.text}
            </span>
          );
        }

        const target = byTitle.get(titleKey(segment.name));
        // The name sits two characters in, after the opening [[.
        if (!target || target.id === noteId) {
          return (
            <span
              key={segment.start}
              data-start={segment.start + 2}
              className={target ? undefined : "mention-link mention-link--missing"}
              title={target ? undefined : "Nenhum verbete com este título"}
            >
              {segment.name}
            </span>
          );
        }
        return (
          <span
            key={segment.start}
            className="mention-link"
            role="link"
            tabIndex={0}
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
            {segment.name}
          </span>
        );
      })}
    </div>
  );
}
