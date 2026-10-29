// Preferences that belong to this device rather than to a volume, kept in localStorage: losing them only means
// the defaults come back.

export const TEXT_SIZES = [
  { id: "p", label: "P", name: "Pequeno", scale: 0.9 },
  { id: "m", label: "M", name: "Médio", scale: 1 },
  { id: "g", label: "G", name: "Grande", scale: 1.15 },
  { id: "gg", label: "GG", name: "Muito grande", scale: 1.3 },
] as const;

export type TextSize = (typeof TEXT_SIZES)[number]["id"];

const TEXT_SIZE_KEY = "archivist.textSize";

export function getTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY);
    return TEXT_SIZES.some(size => size.id === stored) ? (stored as TextSize) : "m";
  } catch {
    return "m";
  }
}

// The size of the text being read and written (notes, manuscript), as --text-scale on the page (see Notes.css).
export function applyTextSize(size: TextSize = getTextSize()) {
  const scale = TEXT_SIZES.find(item => item.id === size)?.scale ?? 1;
  document.documentElement.style.setProperty("--text-scale", String(scale));
}

export function setTextSize(size: TextSize) {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {
    // Still applies for now; the next start just uses the default.
  }
  applyTextSize(size);
}

// Whether a one-time introduction (e.g. the volume guide shown on the first volume opened) was already shown.
export function seen(key: string) {
  try {
    return localStorage.getItem(`archivist.seen.${key}`) === "1";
  } catch {
    return true;
  }
}

export function markSeen(key: string) {
  try {
    localStorage.setItem(`archivist.seen.${key}`, "1");
  } catch {
    // Shown again next time, which is harmless.
  }
}
