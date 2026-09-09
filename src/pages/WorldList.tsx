import { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import "./CSS/WorldList.css";

type LoggedUser = {
  id: number;
  name: string;
  email: string;
};

type WorldItem = {
  id: string;
  name: string;
  accent_color?: string | null;
  icon?: string | null;
};

type WorldListProps = {
  user: LoggedUser | null;
  onBack: () => void;
};

// Cores baseadas na imagem para caso o mundo não tenha cor salva
const DEFAULT_COLORS = ["#ff634f", "#4adeaa", "#1aa4c8"];

export default function WorldList({ user, onBack }: WorldListProps) {
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

        if (selectError) throw selectError;

        setWorlds(data ?? []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao carregar mundos.";
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

      if (insertError) throw insertError;

      const createdWorld = data as WorldItem;
      setWorlds((currentWorlds) => [createdWorld, ...currentWorlds]);
      setWorldName("");
      setWorldDescription("");
      setIsCreateOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar mundo.";
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
      {/* Cabeçalho minimalista (apenas o ícone da lua) */}
      <header className="world-list__header">
        <button
          type="button"
          aria-label="Alternar Tema"
          className="world-list__theme-toggle"
        >
          🌙
        </button>
      </header>

      {/* Lista de Mundos */}
      {loading ? (
        <p className="world-list__status">Carregando mundos...</p>
      ) : error ? (
        <p className="world-list__status world-list__status--error">{error}</p>
      ) : worlds.length === 0 ? (
        <p className="world-list__status">Nenhum mundo criado ainda.</p>
      ) : (
        <section className="world-list__list" aria-label="Lista de mundos">
          {worlds.map((world, index) => {
            const bgColor =
              world.accent_color ??
              DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            return (
              <button
                key={world.id}
                type="button"
                className="world-card"
                style={{ background: bgColor }}
              >
                <span className="world-card__icon" aria-hidden="true">
                  {world.icon ?? "✎"}
                </span>
                <span className="world-card__name">{world.name}</span>
              </button>
            );
          })}
        </section>
      )}

      {/* Barra de Navegação Inferior */}
      <nav className="bottom-nav">
        <button
          aria-label="Início"
          className="bottom-nav__item"
          onClick={onBack}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>
        <button aria-label="Buscar" className="bottom-nav__item">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        {/* Espaço reservado para o botão flutuante central */}
        <div className="bottom-nav__spacer" />

        <button aria-label="Salvos" className="bottom-nav__item">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
        <button aria-label="Perfil" className="bottom-nav__item">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </button>

        {user && (
          <button
            type="button"
            className="bottom-nav__fab"
            onClick={() => setIsCreateOpen(true)}
            aria-label="Criar mundo"
          >
            +
          </button>
        )}
      </nav>

      {/* Modal de Criação (Reaproveitando suas classes originais) */}
      {isCreateOpen && (
        <div
          className="world-list__dialog-backdrop"
          role="presentation"
          onMouseDown={closeCreateDialog}
        >
          <section
            className="world-list__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-world-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="world-list__dialog-header">
              <h2 id="create-world-title">Novo mundo</h2>
              <button
                type="button"
                className="world-list__dialog-close"
                onClick={closeCreateDialog}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateWorld}>
              <label className="world-list__field">
                Nome
                <input
                  type="text"
                  value={worldName}
                  onChange={(event) => setWorldName(event.target.value)}
                  placeholder="Ex.: As terras de Aurora"
                  maxLength={80}
                  autoFocus
                />
              </label>
              <label className="world-list__field">
                Descrição <span>(opcional)</span>
                <textarea
                  value={worldDescription}
                  onChange={(event) => setWorldDescription(event.target.value)}
                  placeholder="Conte um pouco sobre este mundo"
                  maxLength={500}
                  rows={3}
                />
              </label>

              {createError && (
                <p className="world-list__status world-list__status--error">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                className="world-list__dialog-submit"
                disabled={creating}
              >
                {creating ? "Criando..." : "Criar mundo"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
