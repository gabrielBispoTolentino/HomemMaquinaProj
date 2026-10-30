import { useEffect, useState, type ReactNode } from "react";
import type { CategoryItem } from "../lib/categories";
import { pickRandom, rollDice, tableOptions, type DiceRoll } from "../lib/dice";
import type { NoteItem } from "../lib/notes";
import type { SubgroupItem } from "../lib/subgroups";
import "./CSS/Worldbuilding.css";

type GameTableProps = {
  worldId: string;
  notes: NoteItem[];
  categories: CategoryItem[];
  subgroups: SubgroupItem[];
  headStart?: ReactNode;
  onOpenNote: (note: NoteItem) => void;
};

type Combatant = { id: number; name: string; initiative: number };
type Initiative = { combatants: Combatant[]; turn: number; round: number };

const QUICK_DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

// Initiative is kept per volume in this browser, so a fight survives switching notes or reloading mid-session.
function initiativeKey(worldId: string) {
  return `archivist.initiative.${worldId}`;
}

function readInitiative(worldId: string): Initiative {
  try {
    const saved = localStorage.getItem(initiativeKey(worldId));
    if (saved) return JSON.parse(saved);
  } catch {
    // Starts empty.
  }
  return { combatants: [], turn: 0, round: 1 };
}

function Dice() {
  const [expression, setExpression] = useState("1d20");
  const [history, setHistory] = useState<DiceRoll[]>([]);
  const [error, setError] = useState("");

  const roll = (input: string) => {
    const result = rollDice(input);
    if (!result) {
      setError("Use a notação de dados, como 2d6+3 ou d20.");
      return;
    }
    setError("");
    setHistory(current => [result, ...current].slice(0, 12));
  };

  return (
    <section className="table-tool">
      <h3 className="table-tool__title">Dados</h3>
      <form
        className="table-tool__row"
        onSubmit={event => {
          event.preventDefault();
          roll(expression);
        }}
      >
        <input
          className="table-tool__input"
          value={expression}
          onChange={event => setExpression(event.target.value)}
          aria-label="Dados a rolar"
          placeholder="2d6+3"
          enterKeyHint="go"
        />
        <button type="submit" className="writing-button writing-button--accent">
          Rolar
        </button>
      </form>
      <div className="table-tool__quick">
        {QUICK_DICE.map(dice => (
          <button key={dice} type="button" className="writing-button" onClick={() => roll(dice)}>
            {dice}
          </button>
        ))}
      </div>
      {error && <p className="table-tool__error">{error}</p>}
      <ol className="dice-history" aria-live="polite">
        {history.map((result, index) => (
          <li key={history.length - index} className={index === 0 ? "dice-history__latest" : undefined}>
            <span className="dice-history__total">{result.total}</span>
            <span className="dice-history__detail">
              {result.expression} · {result.parts.join(" ")}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

type RandomTablesProps = {
  notes: NoteItem[];
  categories: CategoryItem[];
  subgroups: SubgroupItem[];
  onOpenNote: (note: NoteItem) => void;
};

// A table is a note with one option per line, marked as a table by its category ("Tabela"), its subgroup
// ("Tabelas") or its title. When the volume has none marked, any note with two or more lines can be rolled.
function RandomTables({ notes, categories, subgroups, onOpenNote }: RandomTablesProps) {
  const tableCategories = new Set(categories.filter(item => /tabela/i.test(item.name)).map(item => item.id));
  const tableSubgroups = new Set(subgroups.filter(item => /tabela/i.test(item.name)).map(item => item.id));
  const isTable = (note: NoteItem) =>
    /tabela/i.test(note.title) ||
    (note.category_id !== null && tableCategories.has(note.category_id)) ||
    (note.subgroup_id !== null && tableSubgroups.has(note.subgroup_id));
  const rollable = notes.filter(note => tableOptions(note.content).length >= 2);
  const marked = rollable.filter(isTable);
  const candidates = marked.length ? marked : rollable;
  const [tableId, setTableId] = useState(candidates[0]?.id ?? "");
  const [result, setResult] = useState<string | null>(null);
  // Counts the draws, so drawing the same line twice still shows a new slip.
  const [draws, setDraws] = useState(0);
  const table = candidates.find(note => note.id === tableId) ?? null;

  return (
    <section className="table-tool">
      <h3 className="table-tool__title">Tabelas aleatórias</h3>
      {candidates.length === 0 ? (
        <p className="world-view__empty">
          Crie um verbete com uma opção por linha (nomes de tavernas, encontros, rumores) para rolar aqui.
        </p>
      ) : (
        <>
          <div className="table-tool__row">
            <select
              className="table-tool__input"
              value={tableId}
              onChange={event => {
                setTableId(event.target.value);
                setResult(null);
              }}
              aria-label="Tabela"
            >
              {candidates.map(note => (
                <option key={note.id} value={note.id}>
                  {note.title.trim() || "Sem título"} ({tableOptions(note.content).length})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="writing-button writing-button--accent"
              onClick={() => {
                if (!table) return;
                setResult(pickRandom(tableOptions(table.content)));
                setDraws(count => count + 1);
              }}
            >
              Rolar
            </button>
          </div>
          {result && (
            <p className="table-tool__result" aria-live="polite">
              <span key={draws} className="table-tool__draw">
                {result}
              </span>
            </p>
          )}
          {table && (
            <button type="button" className="table-tool__link" onClick={() => onOpenNote(table)}>
              Editar a tabela
            </button>
          )}
        </>
      )}
    </section>
  );
}

function InitiativeTracker({ worldId }: { worldId: string }) {
  const [state, setState] = useState(() => readInitiative(worldId));
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(initiativeKey(worldId), JSON.stringify(state));
    } catch {
      // Only a convenience.
    }
  }, [state, worldId]);

  const ordered = [...state.combatants].sort((a, b) => b.initiative - a.initiative);
  const current = ordered[state.turn % Math.max(ordered.length, 1)];

  const add = () => {
    if (!name.trim()) return;
    // A blank initiative rolls a d20.
    const initiative = value.trim() ? Number.parseInt(value, 10) || 0 : rollDice("d20")!.total;
    setState(s => ({ ...s, combatants: [...s.combatants, { id: Date.now(), name: name.trim(), initiative }] }));
    setName("");
    setValue("");
  };

  const next = () =>
    setState(s => {
      const turn = s.turn + 1;
      return turn >= s.combatants.length ? { ...s, turn: 0, round: s.round + 1 } : { ...s, turn };
    });

  return (
    <section className="table-tool">
      <h3 className="table-tool__title">
        Iniciativa {ordered.length > 0 && <span className="table-tool__round">Rodada {state.round}</span>}
      </h3>
      <form
        className="table-tool__row"
        onSubmit={event => {
          event.preventDefault();
          add();
        }}
      >
        <input
          className="table-tool__input"
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Nome"
          aria-label="Nome"
        />
        <input
          className="table-tool__input table-tool__input--short"
          value={value}
          onChange={event => setValue(event.target.value)}
          placeholder="d20"
          inputMode="numeric"
          aria-label="Iniciativa (em branco rola um d20)"
        />
        <button type="submit" className="writing-button">
          Adicionar
        </button>
      </form>
      {ordered.length > 0 && (
        <>
          <ol className="initiative">
            {ordered.map(combatant => (
              <li key={combatant.id} className="initiative__row" aria-current={combatant === current ? "true" : undefined}>
                <span className="initiative__value">{combatant.initiative}</span>
                <span className="initiative__name">{combatant.name}</span>
                <button
                  type="button"
                  className="writing-button writing-button--quiet"
                  aria-label={`Remover ${combatant.name}`}
                  onClick={() =>
                    setState(s => ({ ...s, combatants: s.combatants.filter(item => item.id !== combatant.id), turn: 0 }))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <div className="table-tool__row">
            <button type="button" className="writing-button writing-button--accent" onClick={next}>
              Próximo turno
            </button>
            <button
              type="button"
              className="writing-button"
              onClick={() => setState({ combatants: [], turn: 0, round: 1 })}
            >
              Encerrar combate
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// The game master's table: dice, random tables from the volume's notes, and initiative.
export default function GameTable({ worldId, notes, categories, subgroups, headStart, onOpenNote }: GameTableProps) {
  return (
    <article className="world-view">
      <header className="world-view__head">
        {headStart}
        <h2 className="world-view__title">
          <span className="world-view__kind">Volume</span>
          Mesa do mestre
        </h2>
      </header>
      <div className="world-view__body table-tools">
        <Dice />
        <RandomTables notes={notes} categories={categories} subgroups={subgroups} onOpenNote={onOpenNote} />
        <InitiativeTracker worldId={worldId} />
      </div>
    </article>
  );
}
