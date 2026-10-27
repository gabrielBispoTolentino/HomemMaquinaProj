import { useMemo, type ReactNode } from "react";
import { categoryColor, type CategoryItem } from "../lib/categories";
import { layoutGraph } from "../lib/graphLayout";
import { mentionLinks } from "../lib/mentions";
import type { NoteItem } from "../lib/notes";
import "./CSS/Worldbuilding.css";

type RelationshipMapProps = {
  notes: NoteItem[];
  categories: CategoryItem[];
  headStart?: ReactNode;
  onOpenNote: (note: NoteItem) => void;
};

const WIDTH = 1000;
const HEIGHT = 700;
const MARGIN = 70;

// Which notes mention which: every note in a mention is a dot in its category's color, and a line joins each
// pair. Notes nobody mentions and that mention no one are left out.
export default function RelationshipMap({ notes, categories, headStart, onOpenNote }: RelationshipMapProps) {
  const { nodes, edges } = useMemo(() => {
    const links = mentionLinks(notes);
    const pairs = new Map<string, [string, string]>();
    for (const { from, to } of links) {
      const key = [from.id, to.id].sort().join("|");
      if (!pairs.has(key)) pairs.set(key, [from.id, to.id]);
    }
    const ids = [...new Set(links.flatMap(({ from, to }) => [from.id, to.id]))];
    const placed = layoutGraph(ids, [...pairs.values()], WIDTH, HEIGHT);

    // Fit the drawing to the frame.
    const xs = placed.map(node => node.x);
    const ys = placed.map(node => node.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min((WIDTH - 2 * MARGIN) / (maxX - minX || 1), (HEIGHT - 2 * MARGIN) / (maxY - minY || 1), 1.5);
    const fitted = new Map(
      placed.map(node => [
        node.id,
        {
          x: WIDTH / 2 + (node.x - (minX + maxX) / 2) * scale,
          y: HEIGHT / 2 + (node.y - (minY + maxY) / 2) * scale,
        },
      ]),
    );
    return { nodes: fitted, edges: [...pairs.values()] };
  }, [notes]);

  const noteById = new Map(notes.map(note => [note.id, note]));

  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Mapa de relações
        </h2>
      </header>

      <div className="world-view__body">
        {nodes.size === 0 ? (
          <p className="world-view__empty">
            Ainda não há menções entre verbetes. Escreva [[Nome de um verbete]] no texto de outro para ligá-los.
          </p>
        ) : (
          <svg className="relation-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Mapa de relações entre verbetes">
            {edges.map(([a, b]) => {
              const from = nodes.get(a)!;
              const to = nodes.get(b)!;
              return <line key={`${a}|${b}`} className="relation-map__edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
            })}
            {[...nodes].map(([id, { x, y }]) => {
              const note = noteById.get(id)!;
              const title = note.title.trim() || "Sem título";
              const color = note.category_id ? categoryColor(categories, note.category_id) : "#e8edf0";
              return (
                <g
                  key={id}
                  className="relation-map__node"
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Abrir ${title}`}
                  onClick={() => onOpenNote(note)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") onOpenNote(note);
                  }}
                >
                  <circle r={11} fill={color} />
                  <text y={30} textAnchor="middle">
                    {title.length > 24 ? `${title.slice(0, 23)}…` : title}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </article>
  );
}
