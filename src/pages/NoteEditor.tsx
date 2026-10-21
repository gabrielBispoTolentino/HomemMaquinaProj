import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import type { WorldItem } from "./WorldList.tsx";
import type { NoteItem } from "./WorldNotes.tsx";
import "./CSS/Notes.css";

type NoteEditorProps = {
  world: WorldItem;
  // null starts a new note, which is only inserted once it has some text.
  note: NoteItem | null;
  onBack: () => void;
};

type SaveState = "saved" | "pending" | "error";

const AUTOSAVE_DELAY_MS = 800;

export default function NoteEditor({ world, note, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const noteId = useRef(note?.id ?? null);
  const draft = useRef({ title, content });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves run one after another so a new note is never inserted twice.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const persist = async () => {
    if (!dirty.current) return;
    dirty.current = false;

    const { title, content } = draft.current;
    const supabase = getSupabaseClient();

    if (!noteId.current) {
      if (!title.trim() && !content.trim()) return;

      const { data, error: insertError } = await supabase
        .from("notes")
        .insert({ world_id: world.id, title, content })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      noteId.current = data.id;
      return;
    }

    const { error: updateError } = await supabase.from("notes").update({ title, content }).eq("id", noteId.current);

    if (updateError) {
      throw updateError;
    }
  };

  const save = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    queue.current = queue.current
      .then(persist)
      .then(() => {
        setError("");
        setSaveState(dirty.current ? "pending" : "saved");
      })
      .catch(err => {
        dirty.current = true;
        setSaveState("error");
        setError(err instanceof Error ? err.message : "Erro ao salvar nota.");
      });

    return queue.current;
  };

  const edit = (next: { title: string; content: string }) => {
    setTitle(next.title);
    setContent(next.content);
    draft.current = next;
    dirty.current = true;
    setSaveState("pending");

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  };

  // Leaving the screen another way (e.g. the Android back button) still saves pending edits.
  useEffect(() => {
    return () => {
      if (dirty.current) save();
    };
  }, []);

  const handleBack = async () => {
    await save();
    if (!dirty.current) onBack();
  };

  const handleDelete = async () => {
    if (!noteId.current) {
      dirty.current = false;
      onBack();
      return;
    }

    if (!window.confirm("Excluir esta nota?")) return;

    try {
      setDeleting(true);
      if (timer.current) clearTimeout(timer.current);
      dirty.current = false;
      await queue.current;

      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase.from("notes").delete().eq("id", noteId.current);

      if (deleteError) {
        throw deleteError;
      }

      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir nota.");
      setDeleting(false);
    }
  };

  const statusText = error || (saveState === "pending" ? "Salvando..." : "Salvo");

  return (
    <main className="notes notes--editor">
      <header className="notes__header">
        <button type="button" aria-label="Voltar" className="notes__icon-button" onClick={handleBack}>
          ←
        </button>
        <span className="notes__world-name">
          <span aria-hidden="true">{world.icon ?? "✎"}</span>
          {world.name}
        </span>
        <button
          type="button"
          className="notes__delete-button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Excluir nota"
        >
          Excluir
        </button>
      </header>

      <section className="note-editor">
        <input
          className="note-editor__title"
          type="text"
          value={title}
          onChange={event => edit({ title: event.target.value, content })}
          placeholder="Título"
          maxLength={200}
          autoFocus={!note}
        />
        <p className={`note-editor__status${saveState === "error" ? " notes__status--error" : ""}`} role="status">
          {statusText}
        </p>
        <textarea
          className="note-editor__content"
          value={content}
          onChange={event => edit({ title, content: event.target.value })}
          placeholder="Escreva sua nota..."
        />
      </section>
    </main>
  );
}
