import { now, queryAll, run } from "./db";

// Images in notes (the "images" feature). The picture is kept in note_images, scaled down when attached so the
// database and sync stay light; the note's text only holds [imagem:ID|Legenda] where it shows (see blocks.ts).
// An image stays as long as its note does, so undo, versions and the Lixeira can always bring it back.

export type NoteImage = { id: string; data: string; width: number; height: number };

// The longest side, in pixels, and the quality pictures are stored at: sharp on a page or a phone, a few hundred
// KB at most.
const MAX_SIDE = 1600;
const QUALITY = 0.82;

// Opens the system's picker for one picture (on phones, the gallery or the camera). Resolves to null when closed
// without choosing. Must be called within the click that asked for it.
export function pickImageFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close?: () => void };

// The picture decoded straight from the file. Not through a blob: URL, which the page's Content-Security-Policy
// (img-src in index.html) doesn't allow; a data: URL is the fallback where createImageBitmap is missing.
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Some formats (SVG, for one) only decode in an <img>: try that below.
    }
  }
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = url;
  await image.decode();
  return { source: image, width: image.naturalWidth, height: image.naturalHeight };
}

// The picture scaled down to MAX_SIDE and compressed: WebP where the browser makes it (it keeps transparency), or
// else JPEG on white (PNG for pictures that may be transparent).
export async function prepareImage(file: File): Promise<Omit<NoteImage, "id">> {
  // Some pickers leave the type blank; decoding is what decides.
  if (file.type && !file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  let image: Decoded;
  try {
    image = await decode(file);
  } catch {
    throw new Error(`Não foi possível abrir “${file.name}”. Tente uma imagem JPG, PNG ou WebP.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;

  let data = canvas.toDataURL("image/webp", QUALITY);
  const webp = data.startsWith("data:image/webp");
  const transparent = /png|gif|webp|svg/.test(file.type);
  if (!webp && !transparent) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image.source, 0, 0, width, height);
  image.close?.();
  data = webp
    ? canvas.toDataURL("image/webp", QUALITY)
    : transparent
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", QUALITY);
  return { data, width, height };
}

// The images with these ids: the ones a note or a manuscript shows.
export async function loadImages(ids: string[]): Promise<NoteImage[]> {
  const found: NoteImage[] = [];
  for (let start = 0; start < ids.length; start += 200) {
    const chunk = ids.slice(start, start + 200);
    found.push(
      ...(await queryAll<NoteImage>(
        `SELECT id, data, width, height FROM note_images WHERE id IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      )),
    );
  }
  return found;
}

export async function saveImage(image: NoteImage, noteId: string, worldId: string) {
  await run(
    `INSERT INTO note_images (id, note_id, world_id, data, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [image.id, noteId, worldId, image.data, image.width, image.height, now()],
  );
}
