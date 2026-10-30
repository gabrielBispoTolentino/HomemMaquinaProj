import type { BodyPart } from "./blocks";
import { newId } from "./db";
import type { FeatureId } from "./features";
import { pickImageFile, prepareImage } from "./images";
import { blankSheet } from "./sheets";

// Gadgets: the elements that can be put into a note's text, such as a table or an image. They're all offered from
// one place, the menu that opens with a right click on the note ("Inserir"), and each is placed under the line that
// was clicked. A gadget only shows while its feature is on in the volume.
//
// To add one: give it a block in the note's text (BodyPart in blocks.ts), a component to edit it in NoteEditor,
// and an entry here.
export type Gadget = {
  id: string;
  feature: FeatureId;
  label: string;
  // A new one, as it goes into the text, or null when the user backs out (e.g. closes the file picker). Called
  // within the click on the menu, so it can open the system's pickers.
  create: () => Promise<BodyPart | null>;
};

export const GADGETS: Gadget[] = [
  {
    id: "table",
    feature: "tables",
    label: "Tabela",
    create: async () => ({ kind: "table", rows: blankSheet() }),
  },
  {
    id: "image",
    feature: "images",
    label: "Imagem",
    create: async () => {
      const file = await pickImageFile();
      if (!file) return null;
      return { kind: "image", id: newId(), caption: "", upload: await prepareImage(file) };
    },
  },
];
