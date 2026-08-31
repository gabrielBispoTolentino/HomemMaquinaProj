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

export default function WorldList({ user, onBack }: WorldListProps) {
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <main className="world-list">
      <header className="world-list__header">
        <div>
          <h1>Menu</h1>
          {user && <span className="world-list__user">{user.name}</span>}
        </div>
        <button type="button" aria-label="Voltar" className="world-list__theme-toggle" onClick={onBack}>
          ←
        </button>
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
            >
              <span className="world-card__icon" aria-hidden="true">
                {world.icon ?? "✎"}
              </span>
              <span className="world-card__name">{world.name}</span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
