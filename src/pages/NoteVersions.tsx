import { useEffect, useState } from "react";
import { diffParagraphs } from "../lib/diff";
import { createSnapshot, deleteSnapshot, loadSnapshots, type SnapshotItem } from "../lib/snapshots";
import { countWords, formatWords } from "../lib/writing";
import "./CSS/Writing.css";
import { confirmAction } from "./Dialogs.tsx";

type NoteVersionsProps = {
  title: string;
  content: string;
  // Saves pending edits and resolves to the note's id, or null while a new note is still empty.
  ensureSaved: () => Promise<string | null>;
  onRestore: (snapshot: SnapshotItem) => void;
  onClose: () => void;
};

// "27 de out. de 2026, 14:32".
function versionDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

// The note's saved versions: keep one before a big rewrite, compare it with the current text, or go back to it.
export default function NoteVersions({ title, content, ensureSaved, onRestore, onClose }: NoteVersionsProps) {
  const [noteId, setNoteId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [comparing, setComparing] = useState<SnapshotItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    ensureSaved()
      .then(async id => {
        setNoteId(id);
        if (id) setSnapshots(await loadSnapshots(id));
      })
      .catch(err => setError(err instanceof Error ? err.message : "Erro ao carregar versões."));
  }, []);

  const keep = async () => {
    try {
      const id = await ensureSaved();
      if (!id) return;
      const snapshot = await createSnapshot(id, title, content);
      setSnapshots(current => [snapshot, ...current]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar versão.");
    }
  };

  // The current text is kept as a version first, so restoring can be undone.
  const restore = async (snapshot: SnapshotItem) => {
    const confirmed = await confirmAction({
      title: `Voltar para a versão de ${versionDate(snapshot.created_at)}?`,
      message: "O texto atual fica guardado como uma versão, então dá para voltar a ele depois.",
      confirmLabel: "Restaurar versão",
    });
    if (!confirmed) return;
    try {
      const id = await ensureSaved();
      if (!id) return;
      const current = await createSnapshot(id, title, content);
      setSnapshots(list => [current, ...list]);
      setComparing(null);
      onRestore(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao restaurar versão.");
    }
  };

  const remove = async (snapshot: SnapshotItem) => {
    const confirmed = await confirmAction({
      title: `Excluir a versão de ${versionDate(snapshot.created_at)}?`,
      message: "O verbete continua como está; só esta versão guardada é apagada, e não dá para desfazer.",
      confirmLabel: "Excluir versão",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteSnapshot(snapshot.id);
      setSnapshots(list => list.filter(item => item.id !== snapshot.id));
      if (comparing?.id === snapshot.id) setComparing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir versão.");
    }
  };

  const diff = comparing && diffParagraphs(comparing.content, content);

  return (
    <section className="versions" aria-label="Versões do verbete">
      <header className="versions__head">
        <h3 className="versions__title">{comparing ? `Comparando com ${versionDate(comparing.created_at)}` : "Versões"}</h3>
        {comparing ? (
          <button type="button" className="writing-button" onClick={() => setComparing(null)}>
            Voltar à lista
          </button>
        ) : (
          <button type="button" className="writing-button writing-button--accent" onClick={keep} disabled={!noteId && !title && !content}>
            Guardar versão atual
          </button>
        )}
        <button type="button" className="writing-button" onClick={onClose}>
          Fechar
        </button>
      </header>

      {error && <p className="versions__error">{error}</p>}

      {comparing ? (
        diff ? (
          <div className="versions__diff">
            <p className="versions__legend">
              <del>Só na versão guardada</del> <ins>Só no texto atual</ins>
            </p>
            {diff.length === 0 && <p className="versions__empty">As duas estão vazias.</p>}
            {diff.map((part, index) =>
              part.type === "added" ? (
                <ins key={index}>{part.text}</ins>
              ) : part.type === "removed" ? (
                <del key={index}>{part.text}</del>
              ) : (
                <p key={index}>{part.text}</p>
              ),
            )}
          </div>
        ) : (
          <p className="versions__empty">O texto é longo demais para comparar parágrafo por parágrafo.</p>
        )
      ) : snapshots.length === 0 ? (
        <p className="versions__empty">
          Nenhuma versão guardada. Guarde uma antes de reescrever, para poder comparar ou voltar a ela.
        </p>
      ) : (
        <ul className="versions__list">
          {snapshots.map(snapshot => (
            <li key={snapshot.id} className="versions__item">
              <span className="versions__when">
                {versionDate(snapshot.created_at)}
                <span className="versions__words">{formatWords(countWords(snapshot.content))}</span>
              </span>
              <button type="button" className="writing-button" onClick={() => setComparing(snapshot)}>
                Comparar
              </button>
              <button type="button" className="writing-button" onClick={() => restore(snapshot)}>
                Restaurar
              </button>
              <button
                type="button"
                className="writing-button writing-button--quiet"
                onClick={() => remove(snapshot)}
                aria-label={`Excluir a versão de ${versionDate(snapshot.created_at)}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
