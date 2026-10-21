import { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import "./CSS/WorldList.css";

type LoggedUser = {
  id: number;
  name: string;
  email: string;
};

export type WorldItem = {
  id: string;
  name: string;
  accent_color?: string | null;
  icon?: string | null;
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
      setError("Faça login para ver seus mundos.");
      return;
    }

    const loadWorlds = async () => {
      try {
        setLoading(true);
        setError("");

        const supabase = getSupabaseClient();
        const { data, error: selectError } = await supabase
          .from("worlds")
          .select("id, name, accent_color, icon")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (selectError) {
          throw selectError;
        }

        setWorlds(data ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar mundos.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadWorlds();
  }, [user]);

  const handleCreateWorld = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setCreateError("Faça login para criar um mundo.");
      return;
    }

    const name = worldName.trim();
    if (!name) {
      setCreateError("Digite um nome para o mundo.");
      return;
    }

    try {
      setCreating(true);
      setCreateError("");

      const supabase = getSupabaseClient();
      const { data, error: insertError } = await supabase
        .from("worlds")
        .insert({
          user_id: user.id,
          name,
          description: worldDescription.trim() || null,
        })
        .select("id, name, accent_color, icon")
        .single();

      if (insertError) {
        throw insertError;
      }

      const createdWorld = data as WorldItem;
      setWorlds(currentWorlds => [createdWorld, ...currentWorlds]);
      setWorldName("");
      setWorldDescription("");
      setIsCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar mundo.";
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
          <h1>Menu</h1>
          {user && <span className="world-list__user">{user.name}</span>}
        </div>
        <div className="world-list__actions">
          {user && (
            <button type="button" className="world-list__create-button" onClick={() => setIsCreateOpen(true)}>
              <span aria-hidden="true">+</span>
              Criar mundo
            </button>
          )}
          <button type="button" aria-label="Voltar" className="world-list__theme-toggle" onClick={onBack}>
            ←
          </button>
        </div>
      </header>

      {loading ? (
        <p className="world-list__status">Carregando mundos...</p>
      ) : error ? (
        <p className="world-list__status world-list__status--error">{error}</p>
      ) : worlds.length === 0 ? (
        <p className="world-list__status">Nenhum mundo criado ainda.</p>
      ) : (
        <section className="world-list__list" aria-label="Lista de mundos">
          {worlds.map(world => (
            <button
              key={world.id}
              type="button"
              className="world-card"
              style={{ background: world.accent_color ?? "#f5a7a1" }}
              onClick={() => onOpenWorld(world)}
            >
              <span className="world-card__icon" aria-hidden="true">
                {world.icon ?? "✎"}
              </span>
              <span className="world-card__name">{world.name}</span>
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
              <h2 id="create-world-title">Novo mundo</h2>
              <button type="button" className="world-list__dialog-close" onClick={closeCreateDialog} aria-label="Fechar">
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
                  placeholder="Conte um pouco sobre este mundo"
                  maxLength={500}
                  rows={3}
                />
              </label>

              {createError && <p className="world-list__status world-list__status--error">{createError}</p>}

              <button type="submit" className="world-list__dialog-submit" disabled={creating}>
                {creating ? "Criando..." : "Criar mundo"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
