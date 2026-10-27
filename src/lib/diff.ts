// Paragraph-by-paragraph comparison of two versions of a text, for the versions panel.
export type DiffPart = { type: "same" | "added" | "removed"; text: string };

// Past this many paragraph pairs the comparison table gets too big to build quickly.
const MAX_CELLS = 4_000_000;

function paragraphs(text: string) {
  return text.split(/\n+/).filter(paragraph => paragraph.trim());
}

// null when the texts are too long to compare.
export function diffParagraphs(before: string, after: string): DiffPart[] | null {
  const a = paragraphs(before);
  const b = paragraphs(after);
  if (a.length * b.length > MAX_CELLS) return null;

  // Longest common subsequence, filled from the end so the walk below can go forwards.
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j] ? lcs[(i + 1) * width + j + 1]! + 1 : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      parts.push({ type: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[(i + 1) * width + j]! >= lcs[i * width + j + 1]!) {
      parts.push({ type: "removed", text: a[i++]! });
    } else {
      parts.push({ type: "added", text: b[j++]! });
    }
  }
  while (i < a.length) parts.push({ type: "removed", text: a[i++]! });
  while (j < b.length) parts.push({ type: "added", text: b[j++]! });
  return parts;
}
