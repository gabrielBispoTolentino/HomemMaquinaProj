import { imagesToText } from "./blocks";
import { tablesToText } from "./sheets";

// Dice for the game master's table: "2d6+3", "d20", "4d6-1d4".

export type DiceRoll = {
  expression: string;
  total: number;
  // Each part as rolled, e.g. "2d6 [4, 1]" or "+3".
  parts: string[];
};

// Unbiased 1..sides, from the browser's cryptographic random source.
function die(sides: number) {
  const limit = Math.floor(0x100000000 / sides) * sides;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0]! >= limit);
  return (buffer[0]! % sides) + 1;
}

// null when the expression isn't dice notation (or asks for absurd amounts).
export function rollDice(input: string): DiceRoll | null {
  const expression = input.replace(/\s+/g, "").toLowerCase();
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(expression)) return null;

  let total = 0;
  const parts: string[] = [];
  for (const [, sign, count, sides, flat] of expression.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/g)) {
    const factor = sign === "-" ? -1 : 1;
    if (flat !== undefined) {
      total += factor * Number(flat);
      parts.push(`${sign || (parts.length ? "+" : "")}${flat}`);
      continue;
    }
    const n = count ? Number(count) : 1;
    const s = Number(sides);
    if (n < 1 || n > 100 || s < 2 || s > 1000) return null;
    const rolls = Array.from({ length: n }, () => die(s));
    total += factor * rolls.reduce((sum, value) => sum + value, 0);
    parts.push(`${sign || (parts.length ? "+" : "")}${n}d${s} [${rolls.join(", ")}]`);
  }
  return { expression, total, parts };
}

// The options in a table note: one per line, ignoring blank lines, a leading "- " or "1. ", and the game
// master's [segredo] markers. A table in the note gives one option per row.
export function tableOptions(text: string) {
  return tablesToText(imagesToText(text, () => ""), "tsv")
    .split("\n")
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(line => line && !/^\[\/?segredo\]$/i.test(line));
}

export function pickRandom<T>(items: T[]) {
  return items.length ? items[die(items.length) - 1]! : null;
}
