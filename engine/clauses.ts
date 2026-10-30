import { lex, type Token } from "./lex";

/** The top-level parts of a query, named by the keyword that opens them. */
export type ClauseKind =
  | "with" | "select" | "from" | "join" | "where" | "group" | "having" | "qualify" | "order" | "limit" | "offset"
  /** UNION, EXCEPT or INTERSECT, with ALL or DISTINCT. */
  | "set";

export interface Clause {
  kind: ClauseKind;
  /** The clause as the learner wrote it, keyword included. */
  text: string;
  /** Its tokens, keyword included, with offsets into the whole query. */
  tokens: Token[];
}

const JOIN_MODIFIERS = new Set(["left", "right", "full", "inner", "outer", "cross", "natural"]);

export const isWord = (t: Token | undefined, word: string) =>
  !!t && (t.kind === "keyword" || t.kind === "word") && t.text.toLowerCase() === word;
export const isPunct = (t: Token | undefined, ch: string) => !!t && t.kind === "punct" && t.text === ch;

/** The SQL text a run of tokens covers, spacing kept. */
export const textOf = (sql: string, ts: readonly Token[]) => (ts.length ? sql.slice(ts[0]!.start, ts[ts.length - 1]!.end) : "");

/** Bracket depth before each token. */
export function depths(ts: readonly Token[]): number[] {
  let depth = 0;
  return ts.map((t) => {
    if (isPunct(t, ")")) depth = Math.max(0, depth - 1);
    const here = depth;
    if (isPunct(t, "(")) depth++;
    return here;
  });
}

/** Splits tokens wherever `isSep` matches outside brackets; separators are dropped. */
export function splitTop(ts: readonly Token[], isSep: (t: Token, i: number) => boolean): Token[][] {
  const d = depths(ts);
  const parts: Token[][] = [[]];
  ts.forEach((t, i) => {
    if (d[i] === 0 && isSep(t, i)) parts.push([]);
    else parts[parts.length - 1]!.push(t);
  });
  return parts.filter((p) => p.length > 0);
}

/** Index of the bracket that closes the one at `open`, or -1. */
export function closingBracket(ts: readonly Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < ts.length; i++) {
    if (isPunct(ts[i], "(")) depth++;
    else if (isPunct(ts[i], ")") && --depth === 0) return i;
  }
  return -1;
}

/** Drops brackets that wrap the whole run: "(a > 1)" becomes "a > 1". */
export function unwrap(ts: Token[]): Token[] {
  while (ts.length >= 2 && isPunct(ts[0], "(") && closingBracket(ts, 0) === ts.length - 1) ts = ts.slice(1, -1);
  return ts;
}

function clauseKind(ts: readonly Token[], i: number): ClauseKind | null {
  const t = ts[i]!;
  if (t.kind !== "keyword" && t.kind !== "word") return null;
  const next = ts[i + 1];
  switch (t.text.toLowerCase()) {
    case "with": return i === 0 ? "with" : null;
    case "select": return "select";
    case "from": return "from";
    case "join": return "join";
    case "where": return "where";
    case "group": return isWord(next, "by") ? "group" : null;
    case "having": return "having";
    case "qualify": return "qualify";
    case "order": return isWord(next, "by") ? "order" : null;
    case "limit": return "limit";
    case "offset": return "offset";
    case "union": case "except": case "intersect": return "set";
    default: return null;
  }
}

/**
 * The top-level clauses of one SELECT (or WITH … SELECT) statement, in the
 * order they are written. Brackets hide subqueries and window definitions, so
 * only the outer query's clauses are found. Never throws.
 */
export function splitClauses(sql: string): Clause[] {
  const ts = lex(sql).filter((t) => !isPunct(t, ";"));
  const d = depths(ts);
  const starts: { at: number; kind: ClauseKind }[] = [];
  ts.forEach((_, i) => {
    if (d[i] !== 0) return;
    const kind = clauseKind(ts, i);
    if (!kind) return;
    let at = i;
    // LEFT OUTER JOIN starts at LEFT.
    if (kind === "join") while (at > 0 && d[at - 1] === 0 && JOIN_MODIFIERS.has(ts[at - 1]!.text.toLowerCase())) at--;
    if (starts.length && starts[starts.length - 1]!.at >= at) return;
    starts.push({ at, kind });
  });
  return starts.map(({ at, kind }, k) => {
    const tokens = ts.slice(at, starts[k + 1]?.at ?? ts.length);
    return { kind, tokens, text: textOf(sql, tokens) };
  });
}

export interface Cte {
  name: string;
  /** "big AS (SELECT …)" as written. */
  text: string;
  /** The query inside the brackets. */
  body: string;
}

/** The named steps of a WITH clause. */
export function parseWith(sql: string, clause: Clause): Cte[] {
  const ts = clause.tokens.slice(isWord(clause.tokens[1], "recursive") ? 2 : 1);
  const out: Cte[] = [];
  for (const part of splitTop(ts, (t) => isPunct(t, ","))) {
    const name = part[0];
    const open = part.findIndex((t) => isPunct(t, "("));
    if (!name || open < 0 || !part.slice(0, open).some((t) => isWord(t, "as"))) continue;
    const close = closingBracket(part, open);
    if (close < 0) continue;
    out.push({
      name: name.kind === "ident" ? name.text.slice(1, -1) : name.text,
      text: textOf(sql, part.slice(0, close + 1)),
      body: textOf(sql, part.slice(open + 1, close)),
    });
  }
  return out;
}

const LINE_START = new Set(["select", "from", "join", "where", "group", "having", "qualify", "order", "limit", "offset", "set", "values"]);

/**
 * A statement cut into the lines a Parsons puzzle shuffles: one per clause
 * (JOIN … ON stays one line). Works for SELECT and for the statements that
 * change data. Fewer than three lines is not worth a puzzle: returns null.
 */
export function puzzleLines(sql: string): string[] | null {
  const ts = lex(sql).filter((t) => !isPunct(t, ";"));
  const d = depths(ts);
  const cuts: number[] = [0];
  ts.forEach((t, i) => {
    if (i === 0 || d[i] !== 0) return;
    const w = t.kind === "keyword" || t.kind === "word" ? t.text.toLowerCase() : "";
    const prev = ts[i - 1]!.text.toLowerCase();
    let at = -1;
    if (w === "join") {
      at = i;
      while (at > 1 && JOIN_MODIFIERS.has(ts[at - 1]!.text.toLowerCase())) at--;
    } else if (w === "union" || w === "except" || w === "intersect") at = i;
    else if (LINE_START.has(w) && clauseKind(ts, i) !== null) at = i;
    else if (w === "set" || w === "values") at = i;
    // DELETE FROM and INSERT INTO stay on one line; so does "AS SELECT" after CREATE … AS.
    if (w === "from" && prev === "delete") at = -1;
    if (at > cuts[cuts.length - 1]!) cuts.push(at);
  });
  const lines = cuts.map((at, k) => textOf(sql, ts.slice(at, cuts[k + 1] ?? ts.length)).trim()).filter(Boolean);
  return lines.length >= 3 && new Set(lines).size === lines.length ? lines : null;
}

const isJoinLine = (line: string) => /^\s*((left|right|full|inner|outer|cross|natural)\s+)*join\b/i.test(line);

/**
 * Whether a puzzle answer is a right way to write the statement: the written
 * order, or that order with JOIN lines swapped where each join only names
 * tables brought in before it. `order` lists line indices as placed.
 */
export function inWrittenOrder(lines: readonly string[], order: readonly number[]): boolean {
  if (order.length !== lines.length) return false;
  if (order.every((li, i) => li === i)) return true;
  // Only JOIN lines may move, and only among themselves.
  if (order.some((li, i) => isJoinLine(lines[li]!) !== isJoinLine(lines[i]!) || (!isJoinLine(lines[i]!) && li !== i))) return false;
  const known = new Set<string>();
  for (const li of order) {
    const ts = lex(lines[li]!);
    const at = ts.findIndex((t) => isWord(t, "from") || isWord(t, "join"));
    if (at < 0) continue;
    const own = [ts[at + 1], ts[at + 2]?.kind === "word" ? ts[at + 2] : undefined].flatMap((t) => (t ? [t.text.toLowerCase()] : []));
    const named = ts.flatMap((t, i) => (isPunct(ts[i + 1], ".") && (t.kind === "word" || t.kind === "ident") ? [t.text.toLowerCase()] : []));
    if (isJoinLine(lines[li]!) && named.some((n) => !known.has(n) && !own.includes(n))) return false;
    own.forEach((n) => known.add(n));
  }
  return true;
}
