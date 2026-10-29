import { useEffect, useState } from "react";
import { getSyncStatus, setSyncEnabled, subscribeSync, syncNow, type SyncStatus } from "../lib/sync";
import { VOLUME_KINDS, type VolumeKind } from "../lib/volumeKinds";
import { createWorld, loadWorlds, type WorldItem } from "../lib/worlds";
import "./CSS/WorldList.css";
import { confirmAction } from "./Dialogs.tsx";

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

function syncLabel({ enabled, syncing, syncedAt, error }: SyncStatus) {
  if (!enabled) return "Só neste aparelho";
  if (syncing) return "Sincronizando…";
  if (error) return error;
  if (!syncedAt) return "Na nuvem";
  const date = new Date(syncedAt);
  const today = date.toDateString() === new Date().toDateString();
  const when = date.toLocaleString("pt-BR", today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `Na nuvem · sincronizado ${today ? "às" : "em"} ${when}`;
}

export default function WorldList({ user, onBack, onOpenWorld }: WorldListProps) {
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [worldName, setWorldName] = useState("");
  const [worldDescription, setWorldDescription] = useState("");
  // The model the new volume starts from; asked for in the dialog, nothing picked until the user chooses.
  const [worldKind, setWorldKind] = useState<VolumeKind["id"] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [sync, setSync] = useState(getSyncStatus);

  useEffect(() => subscribeSync(setSync), []);

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

  // Volumes another device added or changed, once a sync brings them in.
  useEffect(() => {
    if (!user || sync.pulls === 0) return;
    loadWorlds(user.id)
      .then(setWorlds)
      .catch(err => console.warn("Não foi possível recarregar os volumes.", err));
  }, [sync.pulls]);

  const toggleSync = async () => {
    if (!user) return;
    if (
      sync.enabled &&
      !(await confirmAction({
        title: "Parar de sincronizar neste aparelho?",
        message: "A cópia na nuvem continua guardada, e o que você escrever daqui em diante fica só neste aparelho.",
        confirmLabel: "Parar de sincronizar",
      }))
    ) {
      return;
    }
    try {
      await setSyncEnabled(user.id, !sync.enabled);
    } catch (err) {
      console.warn("Não foi possível mudar a sincronização.", err);
    }
  };

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
    if (!worldKind) {
      setCreateError("Escolha um modelo para o volume.");
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const createdWorld = await createWorld(user.id, name, worldDescription.trim() || null, worldKind);
      setWorlds(currentWorlds => [createdWorld, ...currentWorlds]);
      setWorldName("");
      setWorldDescription("");
      setWorldKind(null);
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

      {user && (
        <div className={`world-list__sync${sync.error ? " world-list__sync--error" : ""}`} role="status">
          <span className="world-list__sync-state">
            <span aria-hidden="true">{sync.enabled ? "☁" : "▣"}</span> {syncLabel(sync)}
          </span>
          {sync.enabled && (
            <button type="button" className="world-list__sync-link" onClick={() => syncNow()} disabled={sync.syncing}>
              Sincronizar agora
            </button>
          )}
          <button type="button" className="world-list__sync-link" onClick={toggleSync}>
            {sync.enabled ? "Desativar" : "Ativar sincronização"}
          </button>
        </div>
      )}

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
              {/* The model decides which features start switched on and what the volume comes with. */}
              <fieldset className="world-list__kinds">
                <legend className="world-list__field">Modelo</legend>
                {VOLUME_KINDS.map(kind => (
                  <label key={kind.id} className="kind-option" style={{ "--world": kind.accent } as React.CSSProperties}>
                    <input
                      type="radio"
                      name="volume-kind"
                      value={kind.id}
                      checked={worldKind === kind.id}
                      onChange={() => setWorldKind(kind.id)}
                    />
                    <span className="kind-option__icon" aria-hidden="true">
                      {kind.icon}
                    </span>
                    <span className="kind-option__text">
                      <span className="kind-option__label">{kind.label}</span>
                      <span className="kind-option__description">{kind.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

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

              <button type="submit" className="binder-button world-list__dialog-submit" disabled={creating || !worldKind}>
                {creating ? "Criando..." : worldKind ? "Criar volume" : "Escolha um modelo"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
