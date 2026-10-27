import { useRef, useState } from "react";
import { categoryColor, deleteCategory, findCategoryByName, renameCategory, type CategoryItem } from "../lib/categories";

type CategoryManagerProps = {
  categories: CategoryItem[];
  // How many of the volume's notes use each category, shown in each row and in the delete warning.
  noteCounts: Record<string, number>;
  onRenamed: (category: CategoryItem) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

type CategoryRowProps = {
  category: CategoryItem;
  color: string;
  count: number;
  deleting: boolean;
  // Resolves to false when the name was rejected, so the row shows the saved name again.
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
};

function noteCountText(count: number) {
  return count === 1 ? "1 verbete" : `${count} verbetes`;
}

function CategoryRow({ category, color, count, deleting, onRename, onDelete }: CategoryRowProps) {
  const [name, setName] = useState(category.name);
  // Set by Escape so the blur that follows restores the name instead of saving it.
  const cancel = useRef(false);

  const commit = async () => {
    if (cancel.current) {
      cancel.current = false;
      setName(category.name);
      return;
    }

    const saved = await onRename(name);
    setName(saved ? name.trim() : category.name);
  };

  return (
    <li className="category-row" style={{ "--category": color } as React.CSSProperties}>
      <span className="category-row__tab" aria-hidden="true" />
      <input
        className="category-row__name"
        value={name}
        onChange={event => setName(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            cancel.current = true;
            event.currentTarget.blur();
          }
        }}
        onBlur={commit}
        aria-label={`Nome da categoria ${category.name}`}
        maxLength={40}
        enterKeyHint="done"
        disabled={deleting}
      />
      <span className="category-row__count">{noteCountText(count)}</span>
      <button
        type="button"
        className="category-row__delete"
        onClick={onDelete}
        disabled={deleting}
        aria-label={`Excluir a categoria ${category.name}`}
      >
        Excluir
      </button>
    </li>
  );
}

export default function CategoryManager({ categories, noteCounts, onRenamed, onDeleted, onClose }: CategoryManagerProps) {
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rename = async (category: CategoryItem, name: string) => {
    const trimmed = name.trim();
    if (trimmed === category.name) return true;

    if (!trimmed) {
      setError("O nome da categoria não pode ficar vazio.");
      return false;
    }

    // A change of case only matches the category itself, which is allowed.
    const existing = findCategoryByName(categories, trimmed);
    if (existing && existing.id !== category.id) {
      setError(`Já existe uma categoria “${existing.name}”.`);
      return false;
    }

    try {
      await renameCategory(category.id, trimmed);
      setError("");
      onRenamed({ ...category, name: trimmed });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao renomear categoria.");
      return false;
    }
  };

  const remove = async (category: CategoryItem) => {
    const count = noteCounts[category.id] ?? 0;
    const warning = count ? ` ${count === 1 ? "1 verbete ficará" : `${count} verbetes ficarão`} sem categoria.` : "";
    if (!window.confirm(`Excluir a categoria “${category.name}”?${warning}`)) return;

    try {
      setDeletingId(category.id);
      await deleteCategory(category.id);
      setError("");
      onDeleted(category.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir categoria.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="category-manager">
      <div className="category-manager__head">
        <h2 className="category-manager__title">Categorias</h2>
        <button type="button" className="category-manager__done" onClick={onClose}>
          Concluído
        </button>
      </div>
      <ul className="category-manager__list">
        {categories.map(category => (
          <CategoryRow
            key={category.id}
            category={category}
            color={categoryColor(categories, category.id)}
            count={noteCounts[category.id] ?? 0}
            deleting={deletingId === category.id}
            onRename={name => rename(category, name)}
            onDelete={() => remove(category)}
          />
        ))}
      </ul>
      {error && (
        <p className="category-manager__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
