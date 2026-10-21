import { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import type { WorldItem } from "./WorldList.tsx";
import "./CSS/Notes.css";

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
};

type WorldNotesProps = {
  world: WorldItem;
  onBack: () => void;
  onOpenNote: (note: NoteItem | null) => void;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function WorldNotes({ world, onBack, onOpenNote }: WorldNotesProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const accent = world.accent_color ?? "#f5a7a1";

  useEffect(() => {
    const loadNotes = async () => {
      try {
        setLoading(true);
        setError("");

        const supabase = getSupabaseClient();
        const { data, error: selectError } = await supabase
          .from("notes")
          .select("id, title, content, updated_at")
          .eq("world_id", world.id)
          .order("updated_at", { ascending: false });

        if (selectError) {
          throw selectError;
        }

        setNotes(data ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar notas.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [world.id]);

  return (
    <main className="notes">
      <header className="notes__header">
        <button type="button" aria-label="Voltar" className="notes__icon-button" onClick={onBack}>
          ←
        </button>
        <h1 className="notes__title">
          <span aria-hidden="true">{world.icon ?? "✎"}</span>
          {world.name}
        </h1>
        <button
          type="button"
          className="notes__create-button"
          style={{ background: accent }}
          onClick={() => onOpenNote(null)}
        >
          <span aria-hidden="true">+</span>
          Nova nota
        </button>
      </header>

      {loading ? (
        <p className="notes__status">Carregando notas...</p>
      ) : error ? (
        <p className="notes__status notes__status--error">{error}</p>
      ) : notes.length === 0 ? (
        <p className="notes__status">Nenhuma nota neste mundo ainda.</p>
      ) : (
        <section className="notes__list" aria-label="Notas">
          {notes.map(note => (
            <button
              key={note.id}
              type="button"
              className="note-card"
              style={{ borderLeftColor: accent }}
              onClick={() => onOpenNote(note)}
            >
              <span className="note-card__title">{note.title.trim() || "Sem título"}</span>
              {note.content.trim() && <span className="note-card__preview">{note.content.trim()}</span>}
              <span className="note-card__date">{formatDate(note.updated_at)}</span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
