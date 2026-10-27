import { useEffect, useState } from "react";
import { createWorld, loadWorlds, type WorldItem } from "../lib/worlds";
import "./CSS/WorldList.css";

type LoggedUser = {
  id: number;
  name: string;
  email: string;
};

type WorldListProps = {
  user: LoggedUser | null;
  onBack: () => void;
  onOpenWorld: (world: WorldItem) => void;
};

export default function WorldList({ user, onBack, onOpenWorld }: WorldListProps) {
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [worldName, setWorldName] = useState("");
  const [worldDescription, setWorldDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (!user) {
      setWorlds([]);
      setLoading(false);
      setError("Faça login para ver seus volumes.");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setWorlds(await loadWorlds(user.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar volumes.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const handleCreateWorld = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setCreateError("Faça login para abrir um volume.");
      return;
    }

    const name = worldName.trim();
    if (!name) {
      setCreateError("Dê um nome ao volume.");
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const createdWorld = await createWorld(user.id, name, worldDescription.trim() || null);
      setWorlds(currentWorlds => [createdWorld, ...currentWorlds]);
      setWorldName("");
      setWorldDescription("");
      setIsCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar volume.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const closeCreateDialog = () => {
    if (creating) return;
    setCreateError("");
    setIsCreateOpen(false);
  };

  return (
    <main className="world-list">
      <header className="world-list__header">
        <div>
          <h1>Volumes</h1>
          {user && <span className="world-list__user">{user.name}</span>}
        </div>
        <div className="world-list__actions">
          {user && (
            <button type="button" className="binder-button world-list__create-button" onClick={() => setIsCreateOpen(true)}>
              <span aria-hidden="true">+</span>
              Novo volume
            </button>
          )}
          <button type="button" aria-label="Voltar" className="binder-icon-button" onClick={onBack}>
            ←
          </button>
        </div>
      </header>

      {loading ? (
        <p className="world-list__status">Carregando volumes...</p>
      ) : error ? (
        <p className="world-list__status world-list__status--error">{error}</p>
      ) : worlds.length === 0 ? (
        <p className="world-list__status">A estante ainda está vazia. Abra o primeiro volume para começar o seu arquivo.</p>
      ) : (
        <section className="world-list__list" aria-label="Volumes">
          {worlds.map((world, index) => (
            <button
              key={world.id}
              type="button"
              className="world-divider"
              data-tab={index % 3}
              style={{ "--world": world.accent_color ?? "#f5a7a1" } as React.CSSProperties}
              onClick={() => onOpenWorld(world)}
            >
              <span className="world-divider__tab" aria-hidden="true">
                {world.icon ?? "✎"}
              </span>
              <span className="world-divider__name">{world.name}</span>
            </button>
          ))}
        </section>
      )}

      {isCreateOpen && (
        <div className="world-list__dialog-backdrop" role="presentation" onMouseDown={closeCreateDialog}>
          <section
            className="world-list__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-world-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="world-list__dialog-header">
              <h2 id="create-world-title">Novo volume</h2>
              <button type="button" className="binder-icon-button world-list__dialog-close" onClick={closeCreateDialog} aria-label="Fechar">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateWorld}>
              <label className="world-list__field">
                Nome
                <input
                  type="text"
                  value={worldName}
                  onChange={event => setWorldName(event.target.value)}
                  placeholder="Ex.: As terras de Aurora"
                  maxLength={80}
                  autoFocus
                />
              </label>
              <label className="world-list__field">
                Descrição <span>(opcional)</span>
                <textarea
                  value={worldDescription}
                  onChange={event => setWorldDescription(event.target.value)}
                  placeholder="Do que trata este volume?"
                  maxLength={500}
                  rows={3}
                />
              </label>

              {createError && <p className="world-list__status world-list__status--error">{createError}</p>}

              <button type="submit" className="binder-button world-list__dialog-submit" disabled={creating}>
                {creating ? "Criando..." : "Criar volume"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
