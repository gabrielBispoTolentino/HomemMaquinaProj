import { useEffect, useState, type ReactNode } from "react";
import { deleteForever, emptyTrash, loadTrash, restoreNote, type NoteItem, type TrashedNote } from "../lib/notes";
import { confirmAction } from "./Dialogs.tsx";
import "./CSS/Worldbuilding.css";

type TrashViewProps = {
  worldId: string;
  // Changes whenever a note goes in or comes out elsewhere (e.g. "Desfazer"), so the list reloads.
  refresh: number;
  headStart?: ReactNode;
  onRestored: (note: NoteItem) => void;
};

// "28 de out."
function trashedDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function excerpt(content: string) {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

// The volume's Lixeira: deleted notes wait here until they're restored or deleted for good.
export default function TrashView({ worldId, refresh, headStart, onRestored }: TrashViewProps) {
  const [items, setItems] = useState<TrashedNote[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTrash(worldId)
      .then(setItems)
      .catch(err => setError(err instanceof Error ? err.message : "Erro ao abrir a Lixeira."));
  }, [worldId, refresh]);

  const restore = async (item: TrashedNote) => {
    try {
      const note = await restoreNote(item.id);
      setItems(current => current?.filter(entry => entry.id !== item.id) ?? null);
      if (note) onRestored(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao restaurar o verbete.");
    }
  };

  const removeForever = async (item: TrashedNote) => {
    const confirmed = await confirmAction({
      title: `Apagar “${item.title.trim() || "Sem título"}” de vez?`,
      message: "O verbete e as versões guardadas dele somem para sempre. Não dá para desfazer.",
      confirmLabel: "Apagar de vez",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteForever(item.id);
      setItems(current => current?.filter(entry => entry.id !== item.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar o verbete.");
    }
  };

  const empty = async () => {
    if (!items?.length) return;
    const count = items.length === 1 ? "O verbete que está nela some" : `Os ${items.length} verbetes que estão nela somem`;
    const confirmed = await confirmAction({
      title: "Esvaziar a Lixeira?",
      message: `${count} para sempre, com as versões guardadas. Não dá para desfazer.`,
      confirmLabel: "Esvaziar",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await emptyTrash(worldId);
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao esvaziar a Lixeira.");
    }
  };

  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Lixeira
        </h2>
        {items && items.length > 0 && (
          <button type="button" className="writing-button writing-button--quiet trash__empty" onClick={empty}>
            Esvaziar
          </button>
        )}
      </header>

      <div className="world-view__body">
        <p className="settings__intro">
          Verbetes excluídos ficam aqui até você restaurá-los ou apagá-los de vez. Ao restaurar, o verbete volta para o
          subgrupo onde estava.
        </p>
        {error && (
          <p className="world-view__empty world-view__error" role="alert">
            {error}
          </p>
        )}
        {items === null ? (
          !error && <p className="world-view__empty">Abrindo a Lixeira...</p>
        ) : items.length === 0 ? (
          <p className="world-view__empty">A Lixeira está vazia.</p>
        ) : (
          <ul className="trash">
            {items.map(item => (
              <li key={item.id} className="trash__item">
                <div className="trash__text">
                  <p className="trash__title">{item.title.trim() || "Sem título"}</p>
                  {item.content.trim() && <p className="trash__excerpt">{excerpt(item.content)}</p>}
                  <p className="trash__date">Excluído em {trashedDate(item.deleted_at)}</p>
                </div>
                <div className="trash__actions">
                  <button type="button" className="writing-button writing-button--accent" onClick={() => restore(item)}>
                    Restaurar
                  </button>
                  <button type="button" className="writing-button writing-button--quiet" onClick={() => removeForever(item)}>
                    Apagar de vez
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
