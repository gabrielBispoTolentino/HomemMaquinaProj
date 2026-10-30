// Tables inside a note's text (the "tables" feature): a block between [tabela] and [/tabela], one row per line and
// the cells between pipes, like a Markdown table. A cell starting with = is a formula, as in a spreadsheet:
//
//   [tabela]
//   | Item | Preço |
//   | Cerveja | 2 |
//   | Total | =SOMA(B2:B2) |
//   [/tabela]
//
// Kept in the text itself, so search, versions, sync and the Lixeira handle tables with nothing new.

export type Sheet = string[][];

export type BodyPart = { kind: "text"; text: string } | { kind: "table"; rows: Sheet };

// The newline on each side belongs to the block, so the text around it doesn't gain blank lines on every save.
const BLOCK = /\n?\[tabela\]\n?([\s\S]*?)\n?\[\/tabela\]\n?/gi;

// The text cut at its tables: always text, table, text, …, text, so there is somewhere to write around each table.
export function bodyParts(content: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  for (const match of content.matchAll(BLOCK)) {
    parts.push({ kind: "text", text: content.slice(last, match.index) });
    parts.push({ kind: "table", rows: parseRows(match[1]!) });
    last = match.index + match[0].length;
  }
  parts.push({ kind: "text", text: content.slice(last) });
  return parts;
}

// Back into the note's text. Two texts left side by side (a table between them was removed) become one.
export function joinParts(parts: BodyPart[]) {
  let out = "";
  let previous: BodyPart["kind"] | null = null;
  for (const part of parts) {
    if (part.kind === "table") {
      if (previous !== null) out += "\n";
      out += tableBlock(part.rows);
    } else {
      if (previous === "table") out += "\n";
      else if (previous === "text" && out && part.text) out += "\n";
      out += part.text;
    }
    previous = part.kind;
  }
  return out;
}

export function blankSheet(rows = 3, columns = 3): Sheet {
  return Array.from({ length: rows }, () => Array<string>(columns).fill(""));
}

function tableBlock(rows: Sheet) {
  return `[tabela]\n${rows.map(serializeRow).join("\n")}\n[/tabela]`;
}

// A cell is written with one space on each side of its pipes, which reading takes off again, so spaces typed at
// either end of a cell survive the trip.
function serializeRow(cells: string[]) {
  const escaped = cells.map(cell => cell.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " "));
  return `| ${escaped.join(" | ")} |`;
}

function parseRow(line: string) {
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === "\\" && i + 1 < line.length) {
      cell += line[++i];
    } else if (char === "|") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  // The pipes at either end of the line only open and close the row.
  if (cells.length > 1 && !cells[0]!.trim()) cells.shift();
  if (cells.length > 1 && !cells[cells.length - 1]!.trim()) cells.pop();
  return cells.map(value => value.replace(/^ /, "").replace(/ $/, ""));
}

// Every row as wide as the widest one.
function parseRows(body: string): Sheet {
  const rows = body
    .split("\n")
    .filter(line => line.trim())
    .map(parseRow);
  if (!rows.length) return blankSheet(1, 1);
  const width = Math.max(...rows.map(row => row.length));
  return rows.map(row => [...row, ...Array<string>(width - row.length).fill("")]);
}

// A, B, …, Z, AA, AB, …
export function columnName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function columnIndex(letters: string) {
  let n = 0;
  for (const letter of letters.toUpperCase()) n = n * 26 + (letter.charCodeAt(0) - 64);
  return n - 1;
}

// A number as typed in a cell: "12", "2,5", "1.234,56", "2.5", "15%". null for anything else.
export function parseNumber(text: string): number | null {
  let value = text.trim().replace(/\s/g, "");
  if (!value) return null;
  let scale = 1;
  if (value.endsWith("%")) {
    value = value.slice(0, -1);
    scale = 0.01;
  }
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^[-+]?\d*,\d+$/.test(value)) value = value.replace(",", ".");
  else if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(value)) return null;
  return Number(value) * scale;
}

// Results the way a spreadsheet in Portuguese shows them: a decimal comma and no thousands separator.
export function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 6, useGrouping: false });
}

// What each error means, shown when pointing at (or reading out) the cell.
const ERRORS: Record<string, string> = {
  "#REF!": "A fórmula aponta para uma célula que não existe.",
  "#DIV/0!": "Divisão por zero.",
  "#NOME?": "Nome de função desconhecido. Use SOMA, MÉDIA, MÍN, MÁX, CONT ou ARRED.",
  "#VALOR!": "Há texto onde a fórmula esperava um número.",
  "#CICLO!": "A fórmula depende do próprio resultado.",
  "#NÚM!": "O resultado não é um número válido.",
  "#ERRO!": "A fórmula está incompleta ou mal escrita.",
};

type CellError = { error: string };
type Value = number | string | CellError | null;
type Ref = { row: number; col: number };

type Node =
  | { k: "num"; value: number }
  | { k: "ref"; ref: Ref }
  | { k: "range"; from: Ref; to: Ref }
  | { k: "neg"; a: Node }
  | { k: "pct"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; name: string; args: Node[] }
  | { k: "err"; code: string };

type Token = { t: "num"; value: number } | { t: "ref"; ref: Ref } | { t: "name"; value: string } | { t: "op"; value: string };

const fail = (code: string): CellError => ({ error: code });
const isError = (value: unknown): value is CellError => typeof value === "object" && value !== null && "error" in value;

// Numbers take a decimal comma or point ("1,5" or "1.5"); arguments are separated by ";", as in a spreadsheet in
// Portuguese, or by "," where it can't be a decimal comma ("SOMA(A1,A2)").
const TOKEN = /\s*(?:(\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?)|\$?([A-Za-z]{1,3})\$?(\d+)(?![\p{L}\d.(])|(#REF!)|([\p{L}][\p{L}\d.]*)|([-+*/^():;,%]))/uy;

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = [];
  let at = 0;
  while (at < source.length) {
    if (!source.slice(at).trim()) break;
    TOKEN.lastIndex = at;
    const match = TOKEN.exec(source);
    if (!match) return null;
    at = TOKEN.lastIndex;
    if (match[1]) tokens.push({ t: "num", value: Number(match[1].replace(",", ".")) });
    else if (match[2]) tokens.push({ t: "ref", ref: { col: columnIndex(match[2]), row: Number(match[3]) - 1 } });
    else if (match[4]) tokens.push({ t: "ref", ref: { col: -1, row: -1 } });
    else if (match[5]) tokens.push({ t: "name", value: match[5] });
    else tokens.push({ t: "op", value: match[6]! });
  }
  return tokens;
}

// expr := term (+|- term)*; term := power (*|/ power)*; power := unary (^ unary)*; unary := -unary | postfix;
// postfix := primary %*; primary := number | ref | ref:ref | NAME(args) | (expr)
function parse(source: string): Node {
  const tokens = tokenize(source);
  if (!tokens) return { k: "err", code: "#ERRO!" };
  let at = 0;
  const peek = () => tokens[at];
  const isOp = (value: string) => peek()?.t === "op" && (peek() as { value: string }).value === value;
  const expect = (value: string) => {
    if (!isOp(value)) throw new Error();
    at++;
  };

  const primary = (): Node => {
    const token = tokens[at++];
    if (!token) throw new Error();
    if (token.t === "num") return { k: "num", value: token.value };
    if (token.t === "ref") {
      if (isOp(":")) {
        at++;
        const end = tokens[at++];
        if (end?.t !== "ref") throw new Error();
        return { k: "range", from: token.ref, to: end.ref };
      }
      return { k: "ref", ref: token.ref };
    }
    if (token.t === "name") {
      if (!isOp("(")) return { k: "err", code: "#NOME?" };
      at++;
      const args: Node[] = [];
      if (!isOp(")")) {
        args.push(expr());
        while (isOp(";") || isOp(",")) {
          at++;
          args.push(expr());
        }
      }
      expect(")");
      return { k: "call", name: token.value, args };
    }
    if (token.value === "(") {
      const inner = expr();
      expect(")");
      return inner;
    }
    throw new Error();
  };

  const postfix = (): Node => {
    let node = primary();
    while (isOp("%")) {
      at++;
      node = { k: "pct", a: node };
    }
    return node;
  };

  const unary = (): Node => {
    if (isOp("-")) {
      at++;
      return { k: "neg", a: unary() };
    }
    if (isOp("+")) {
      at++;
      return unary();
    }
    return postfix();
  };

  const binary = (next: () => Node, ops: string[]) => (): Node => {
    let node = next();
    while (ops.some(isOp)) {
      const op = (tokens[at++] as { value: string }).value;
      node = { k: "bin", op, a: node, b: next() };
    }
    return node;
  };

  const power = binary(unary, ["^"]);
  const term = binary(power, ["*", "/"]);
  const expr = binary(term, ["+", "-"]);

  try {
    const node = expr();
    return at === tokens.length ? node : { k: "err", code: "#ERRO!" };
  } catch {
    return { k: "err", code: "#ERRO!" };
  }
}

const FUNCTIONS: Record<string, string> = {
  SOMA: "sum",
  SUM: "sum",
  MEDIA: "avg",
  AVERAGE: "avg",
  MIN: "min",
  MAX: "max",
  CONT: "count",
  "CONT.NUM": "count",
  COUNT: "count",
  ARRED: "round",
  ROUND: "round",
};

function evaluator(rows: Sheet) {
  const cache = new Map<string, Value>();
  const visiting = new Set<string>();

  const cell = ({ row, col }: Ref): Value => {
    if (row < 0 || col < 0 || row >= rows.length || col >= (rows[0]?.length ?? 0)) return fail("#REF!");
    const key = `${row}:${col}`;
    if (cache.has(key)) return cache.get(key)!;
    if (visiting.has(key)) return fail("#CICLO!");
    const raw = rows[row]![col]!.trim();
    let value: Value;
    if (raw.startsWith("=")) {
      visiting.add(key);
      const result = evaluate(parse(raw.slice(1)));
      visiting.delete(key);
      value = Array.isArray(result) ? fail("#VALOR!") : result;
    } else {
      value = raw ? parseNumber(raw) ?? raw : null;
    }
    cache.set(key, value);
    return value;
  };

  // Empty counts as 0; text that reads as a number counts as that number.
  const toNumber = (value: Value): number | CellError => {
    if (value === null) return 0;
    if (typeof value === "number" || isError(value)) return value;
    return parseNumber(value) ?? fail("#VALOR!");
  };

  const checked = (value: number): number | CellError => (Number.isFinite(value) ? value : fail("#NÚM!"));

  // The numbers a function works on: from ranges only the cells holding numbers, as in a spreadsheet.
  const numbersIn = (args: Node[]): number[] | CellError => {
    const numbers: number[] = [];
    for (const arg of args) {
      const value = evaluate(arg);
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isError(item)) return item;
          if (typeof item === "number") numbers.push(item);
        }
      } else if (value !== null) {
        const number = toNumber(value);
        if (isError(number)) return number;
        numbers.push(number);
      }
    }
    return numbers;
  };

  const call = (name: string, args: Node[]): Value => {
    const fn = FUNCTIONS[name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase()];
    if (!fn) return fail("#NOME?");
    if (fn === "round") {
      if (args.length < 1 || args.length > 2) return fail("#ERRO!");
      const results = args.map(arg => evaluate(arg)).map(value => (Array.isArray(value) ? fail("#VALOR!") : toNumber(value)));
      const [value, digits = 0] = results;
      if (isError(value)) return value;
      if (isError(digits)) return digits;
      const factor = 10 ** Math.trunc(digits);
      return checked((Math.sign(value!) * Math.round(Math.abs(value!) * factor)) / factor);
    }
    const numbers = numbersIn(args);
    if (isError(numbers)) return numbers;
    if (fn === "count") return numbers.length;
    if (fn === "sum") return checked(numbers.reduce((total, n) => total + n, 0));
    if (!numbers.length) return fn === "avg" ? fail("#DIV/0!") : 0;
    if (fn === "avg") return checked(numbers.reduce((total, n) => total + n, 0) / numbers.length);
    return fn === "min" ? Math.min(...numbers) : Math.max(...numbers);
  };

  function evaluate(node: Node): Value | Value[] {
    switch (node.k) {
      case "num":
        return node.value;
      case "err":
        return fail(node.code);
      case "ref":
        return cell(node.ref);
      case "range": {
        const top = Math.min(node.from.row, node.to.row);
        const bottom = Math.max(node.from.row, node.to.row);
        const left = Math.min(node.from.col, node.to.col);
        const right = Math.max(node.from.col, node.to.col);
        if (top < 0 || left < 0 || bottom >= rows.length || right >= (rows[0]?.length ?? 0)) return [fail("#REF!")];
        const values: Value[] = [];
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) values.push(cell({ row, col }));
        return values;
      }
      case "call":
        return call(node.name, node.args);
      case "neg":
      case "pct": {
        const value = evaluate(node.a);
        const number = Array.isArray(value) ? fail("#VALOR!") : toNumber(value);
        if (isError(number)) return number;
        return node.k === "neg" ? -number : number / 100;
      }
      case "bin": {
        const left = evaluate(node.a);
        const right = evaluate(node.b);
        const a = Array.isArray(left) ? fail("#VALOR!") : toNumber(left);
        const b = Array.isArray(right) ? fail("#VALOR!") : toNumber(right);
        if (isError(a)) return a;
        if (isError(b)) return b;
        if (node.op === "+") return checked(a + b);
        if (node.op === "-") return checked(a - b);
        if (node.op === "*") return checked(a * b);
        if (node.op === "/") return b === 0 ? fail("#DIV/0!") : checked(a / b);
        return checked(a ** b);
      }
    }
  }

  return cell;
}

export type CellResult = {
  // What the cell shows: a formula's result, or what was typed.
  text: string;
  kind: "empty" | "number" | "text" | "error";
  // For errors, what went wrong.
  title?: string;
};

// What every cell shows, formulas worked out. Formulas only see cells of their own table.
export function evaluateSheet(rows: Sheet): CellResult[][] {
  const cell = evaluator(rows);
  return rows.map((cells, row) =>
    cells.map((raw, col) => {
      const value = cell({ row, col });
      if (isError(value)) return { text: value.error, kind: "error", title: ERRORS[value.error] };
      if (value === null) return { text: "", kind: "empty" };
      const formula = raw.trim().startsWith("=");
      if (typeof value === "number") return { text: formula ? formatNumber(value) : raw.trim(), kind: "number" };
      return { text: value, kind: "text" };
    }),
  );
}

// Inserting or removing a row or column moves the formulas' references with the cells, as in a spreadsheet: a
// reference to a removed cell becomes #REF!, and a range loses the removed row or column but keeps the rest.
export function shiftReferences(rows: Sheet, axis: "row" | "col", at: number, delta: 1 | -1): Sheet {
  const REFERENCE = /(?<![\p{L}\d.])(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\p{L}\d.(])/gu;
  const split = (ref: string) => {
    const [, colAbs, letters, rowAbs, digits] = ref.match(/^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/)!;
    return { colAbs: colAbs!, rowAbs: rowAbs!, col: columnIndex(letters!), row: Number(digits) - 1 };
  };
  const write = (ref: ReturnType<typeof split>) => `${ref.colAbs}${columnName(ref.col)}${ref.rowAbs}${ref.row + 1}`;
  const index = (ref: ReturnType<typeof split>) => (axis === "row" ? ref.row : ref.col);
  const moved = (ref: ReturnType<typeof split>, value: number) => (axis === "row" ? { ...ref, row: value } : { ...ref, col: value });

  const rewrite = (formula: string) =>
    formula.replace(REFERENCE, (whole, first: string, second: string | undefined) => {
      const start = split(first);
      if (!second) {
        const i = index(start);
        if (delta === 1) return write(i >= at ? moved(start, i + 1) : start);
        if (i === at) return "#REF!";
        return write(i > at ? moved(start, i - 1) : start);
      }
      const end = split(second);
      let from = index(start);
      let to = index(end);
      if (delta === 1) {
        if (from >= at) from++;
        if (to >= at) to++;
      } else {
        if (from > at) from--;
        if (to >= at) to--;
        if (to < from) return "#REF!";
      }
      return `${write(moved(start, from))}:${write(moved(end, to))}`;
    });

  return rows.map(cells => cells.map(raw => (raw.trim().startsWith("=") ? rewrite(raw) : raw)));
}

// Tables as plain text, with formulas worked out: tab-separated rows (they paste into a spreadsheet as cells), or a
// Markdown table whose first row is the header.
export function tablesToText(text: string, style: "tsv" | "markdown") {
  return text
    .replace(BLOCK, (_whole, body: string) => {
      const shown = evaluateSheet(parseRows(body)).map(cells => cells.map(cell => cell.text));
      if (style === "tsv") return `\n\n${shown.map(cells => cells.join("\t")).join("\n")}\n\n`;
      const line = (cells: string[]) => `| ${cells.map(cell => cell.replace(/\|/g, "\\|")).join(" | ")} |`;
      const [head = [], ...rest] = shown;
      return `\n\n${[line(head), line(head.map(() => "---")), ...rest.map(line)].join("\n")}\n\n`;
    })
    .replace(/\n{3,}/g, "\n\n");
}

// The text without its tables, e.g. for counting the words written.
export function withoutTables(text: string) {
  return text.replace(BLOCK, "\n");
}
