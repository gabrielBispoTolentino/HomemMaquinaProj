import { useEffect, useRef, useState } from "react";
import { MENTION } from "../lib/mentions";
import { columnName, evaluateSheet, shiftReferences, type Sheet } from "../lib/sheets";
import "./CSS/Sheets.css";

type SheetBlockProps = {
  rows: Sheet;
  // undo is the notice to show when the change throws something away, offering "Desfazer".
  onChange: (rows: Sheet, undo?: string) => void;
  onRemove: () => void;
  // Set right after the table is inserted, to put the cursor in its first cell.
  focusFirst: boolean;
  onFocused: () => void;
};

type Cell = { row: number; col: number };

// A table inside a note, worked like a small spreadsheet: column letters and row numbers, a cell shows its formula
// while it's being edited and the result otherwise, arrows, Enter and Tab move between cells. While the cursor is in
// the table, a bar under it shows the cell's contents and adds or removes rows and columns.
export default function SheetBlock({ rows, onChange, onRemove, focusFirst, onFocused }: SheetBlockProps) {
  const [active, setActive] = useState<Cell>({ row: 0, col: 0 });
  // The cell with the cursor, which shows what was typed (a formula) instead of its result.
  const [editing, setEditing] = useState<Cell | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  // A cell to move into once the table is drawn again, e.g. the first cell of a row just added.
  const pendingFocus = useRef<Cell | null>(null);
  const results = evaluateSheet(rows);
  const width = rows[0]?.length ?? 1;
  const at = { row: Math.min(active.row, rows.length - 1), col: Math.min(active.col, width - 1) };

  const focusCell = ({ row, col }: Cell) => {
    const input = gridRef.current?.querySelector<HTMLInputElement>(`[data-cell="${row}:${col}"]`);
    input?.focus();
    // Selected, so typing replaces the cell, as in a spreadsheet.
    input?.select();
  };

  useEffect(() => {
    if (!pendingFocus.current) return;
    focusCell(pendingFocus.current);
    pendingFocus.current = null;
  });

  useEffect(() => {
    if (!focusFirst) return;
    focusCell({ row: 0, col: 0 });
    onFocused();
  }, [focusFirst]);

  const setCell = ({ row, col }: Cell, value: string) =>
    onChange(rows.map((cells, r) => (r === row ? cells.map((cell, c) => (c === col ? value : cell)) : cells)));

  const move = (from: Cell, rowStep: number, colStep: number) => {
    const row = Math.max(0, Math.min(rows.length - 1, from.row + rowStep));
    const col = Math.max(0, Math.min(width - 1, from.col + colStep));
    if (row !== from.row || col !== from.col) focusCell({ row, col });
  };

  const addRow = () => {
    const index = at.row + 1;
    const shifted = shiftReferences(rows, "row", index, 1);
    onChange([...shifted.slice(0, index), Array<string>(width).fill(""), ...shifted.slice(index)]);
    pendingFocus.current = { row: index, col: at.col };
  };

  const addColumn = () => {
    const index = at.col + 1;
    onChange(shiftReferences(rows, "col", index, 1).map(cells => [...cells.slice(0, index), "", ...cells.slice(index)]));
    pendingFocus.current = { row: at.row, col: index };
  };

  const removeRow = () => {
    const shifted = shiftReferences(rows, "row", at.row, -1);
    onChange(
      shifted.filter((_, row) => row !== at.row),
      `Linha ${at.row + 1} excluída.`,
    );
    pendingFocus.current = { row: Math.min(at.row, rows.length - 2), col: at.col };
  };

  const removeColumn = () => {
    const shifted = shiftReferences(rows, "col", at.col, -1);
    onChange(
      shifted.map(cells => cells.filter((_, col) => col !== at.col)),
      `Coluna ${columnName(at.col)} excluída.`,
    );
    pendingFocus.current = { row: at.row, col: Math.min(at.col, width - 2) };
  };

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>, cell: Cell) => {
    const input = event.currentTarget;
    const { selectionStart: start, selectionEnd: end, value } = input;
    const whole = start === 0 && end === value.length;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      move(cell, event.key === "ArrowUp" ? -1 : 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      move(cell, event.shiftKey ? -1 : 1, 0);
    } else if (event.key === "ArrowLeft" && (whole || (start === 0 && end === 0))) {
      event.preventDefault();
      move(cell, 0, -1);
    } else if (event.key === "ArrowRight" && (whole || (start === value.length && end === value.length))) {
      event.preventDefault();
      move(cell, 0, 1);
    } else if (event.key === "Escape") {
      input.blur();
    }
  };

  // Keeps the cursor in the cell while a bar button is pressed, so the bar stays open and the cell stays chosen.
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div className="sheet">
      <div className="sheet__scroll">
        <table ref={gridRef} className="sheet__grid">
          <thead>
            <tr>
              <th className="sheet__corner" aria-hidden="true" />
              {rows[0]!.map((_, col) => (
                <th key={col} scope="col" className={col === at.col ? "sheet__head sheet__head--active" : "sheet__head"}>
                  {columnName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, row) => (
              <tr key={row}>
                <th scope="row" className={row === at.row ? "sheet__head sheet__head--active" : "sheet__head"}>
                  {row + 1}
                </th>
                {cells.map((raw, col) => {
                  const result = results[row]![col]!;
                  const isEditing = editing?.row === row && editing.col === col;
                  const name = `${columnName(col)}${row + 1}`;
                  return (
                    <td key={col}>
                      <input
                        data-cell={`${row}:${col}`}
                        className={isEditing ? "sheet__cell" : `sheet__cell sheet__cell--${result.kind}`}
                        value={isEditing ? raw : result.text.replace(MENTION, "$1")}
                        onChange={event => setCell({ row, col }, event.target.value)}
                        onFocus={() => {
                          setActive({ row, col });
                          setEditing({ row, col });
                        }}
                        onBlur={() => setEditing(current => (current?.row === row && current.col === col ? null : current))}
                        onKeyDown={event => handleKey(event, { row, col })}
                        aria-label={result.title ? `${name}: ${result.title}` : name}
                        title={result.title}
                        autoComplete="off"
                        enterKeyHint="next"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sheet__bar">
        <label className="sheet__formula">
          <span className="sheet__ref">{`${columnName(at.col)}${at.row + 1}`}</span>
          <input
            value={rows[at.row]![at.col]!}
            onChange={event => setCell(at, event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                focusCell(at);
              }
            }}
            placeholder="Texto, número ou =SOMA(B2:B5)"
            aria-label={`Conteúdo da célula ${columnName(at.col)}${at.row + 1}`}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="sheet__tools">
          <button type="button" className="sheet__tool" onMouseDown={keepFocus} onClick={addRow}>
            <span aria-hidden="true">+</span> Linha
          </button>
          <button type="button" className="sheet__tool" onMouseDown={keepFocus} onClick={addColumn}>
            <span aria-hidden="true">+</span> Coluna
          </button>
          <button type="button" className="sheet__tool" onMouseDown={keepFocus} onClick={removeRow} disabled={rows.length < 2}>
            Excluir linha {at.row + 1}
          </button>
          <button type="button" className="sheet__tool" onMouseDown={keepFocus} onClick={removeColumn} disabled={width < 2}>
            Excluir coluna {columnName(at.col)}
          </button>
          <button type="button" className="sheet__tool sheet__tool--danger" onMouseDown={keepFocus} onClick={onRemove}>
            Remover tabela
          </button>
        </div>
      </div>
    </div>
  );
}
