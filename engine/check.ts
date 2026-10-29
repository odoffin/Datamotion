import { align, keywordTypo, lex, normToken, type AlignOp, type Alignment, type Token } from "./lex";
import type { QueryResult, QueryRunner } from "./query-runner";
import { friendlyError, guardReadOnly } from "./sql-guard";

export type CompareMode = "rows-any-order" | "rows-ordered";

export interface LessonGoal {
  description: string;
  referenceSql: string;
  compare: CompareMode;
}

/** A DuckDB error with the character offset it points at, when known. */
export interface SqlError {
  kind: "syntax" | "runtime" | "blocked" | "empty";
  message: string;
  position?: number;
  /** DuckDB's full text, which may carry "Candidate bindings" or "Did you mean". */
  raw?: string;
}

export type ParseResult = { kind: "ok"; ast: unknown } | SqlError;

function sqlString(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

/** DuckDB reports byte offsets; convert to a JS string index. */
function byteToCharIndex(sql: string, byte: number): number {
  const bytes = new TextEncoder().encode(sql);
  if (bytes.length === sql.length) return byte;
  return new TextDecoder().decode(bytes.slice(0, byte)).length;
}

function stripErrorPrefix(msg: string): string {
  return (msg.split("\n")[0] ?? msg).replace(/^[A-Za-z ]+Error:\s*/, "").trim();
}

/**
 * Parses without executing, via DuckDB's json_serialize_sql. Syntax errors
 * come back with a position. A parsed query must still pass the read-only
 * guard (one SELECT or WITH statement) before anything runs.
 */
export async function parseCheck(sql: string, runner: QueryRunner): Promise<ParseResult> {
  if (sql.trim().replace(/;\s*$/, "").trim() === "") {
    return { kind: "empty", message: "Write a query on the slip first." };
  }
  const res = await runner.run(`SELECT json_serialize_sql(${sqlString(sql)})`);
  if (res.error) return { kind: "runtime", message: stripErrorPrefix(res.error) };
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(res.rows[0]?.[0] ?? "null"));
  } catch {
    return { kind: "runtime", message: "DuckDB returned something unexpected." };
  }
  const p = parsed as { error?: boolean; error_type?: string; error_message?: string; position?: string };
  if (p.error && p.error_type !== "parser") {
    // json_serialize_sql only serialises SELECT; anything else is not allowed here.
    const guard = guardReadOnly(sql);
    return { kind: "blocked", message: guard.ok ? "Only a single SELECT query can run here." : guard.error };
  }
  if (p.error) {
    const pos = p.position === undefined ? undefined : Number(p.position);
    return {
      kind: "syntax",
      message: p.error_message ?? "syntax error",
      ...(pos !== undefined && Number.isFinite(pos) ? { position: byteToCharIndex(sql, pos) } : {}),
    };
  }
  const guard = guardReadOnly(sql);
  if (!guard.ok) return { kind: "blocked", message: guard.error };
  return { kind: "ok", ast: parsed };
}

/**
 * Turns a runtime (binder, catalog, conversion) error into an SqlError. DuckDB
 * echoes the offending line with carets under it; that gives the position.
 */
export function runtimeError(sql: string, raw: string): SqlError {
  const message = stripErrorPrefix(raw);
  const echo = /LINE (\d+): (.*)\n( *)\^/.exec(raw);
  if (echo) {
    const lineNo = Number(echo[1]);
    const echoed = echo[2] ?? "";
    const lines = sql.split("\n");
    // Only trust the caret when DuckDB echoed the whole line unchanged.
    if (lines[lineNo - 1] === echoed) {
      const col = (echo[3] ?? "").length - `LINE ${lineNo}: `.length;
      const lineStart = lines.slice(0, lineNo - 1).reduce((n, l) => n + l.length + 1, 0);
      return { kind: "runtime", message, position: lineStart + col, raw };
    }
  }
  return { kind: "runtime", message, raw };
}

function tokenAt(tokens: Token[], position: number): number {
  const inside = tokens.findIndex((t) => position >= t.start && position < t.end);
  if (inside >= 0) return inside;
  const after = tokens.findIndex((t) => t.start >= position);
  return after >= 0 ? after : tokens.length;
}

type Edit = Exclude<AlignOp, { type: "match" }>;
const isEdit = (o: AlignOp): o is Edit => o.type !== "match";

function singleEdit(a: Alignment): Edit | undefined {
  return a.cost === 1 ? a.ops.find(isEdit) : undefined;
}

export interface LocateOptions {
  referenceSql?: string;
  /** Table and column names, so `orders` is never mistaken for ORDER. */
  identifiers?: readonly string[];
  /** Tables that exist, listed when the learner names one that does not. */
  tables?: readonly string[];
}

/**
 * Picks the token to circle. Returns an index into lex(sql); tokens.length
 * means "something is missing at the end"; -1 means "the whole statement".
 *
 * Order:
 *  0. an unterminated quote (unambiguous, and the guard can reject it before
 *     DuckDB reports any position);
 *  1. a query one edit away from the reference (unambiguous, and DuckDB's
 *     parser often flags the word after the mistake);
 *  a. the token at DuckDB's position, nudged back onto a misspelt keyword
 *     (table and column names are never treated as keyword typos);
 *  b. a quoted name in the error message;
 *  c. the first token that differs from the reference;
 *  d. none: -1, the whole statement.
 */
export function locateErrorToken(sql: string, error: SqlError, opts: LocateOptions = {}): number {
  const tokens = lex(sql);
  const open = tokens.findIndex((t) => t.unterminated);
  if (open >= 0) return open;
  const ids = new Set((opts.identifiers ?? []).map((s) => s.toLowerCase()));
  const alignment = opts.referenceSql ? align(tokens, lex(opts.referenceSql)) : null;

  const edit = alignment ? singleEdit(alignment) : undefined;
  if (edit) return edit.li;

  if (error.position !== undefined) {
    const p = tokenAt(tokens, error.position);
    if (keywordTypo(tokens[p - 1], ids)) return p - 1;
    if (keywordTypo(tokens[p], ids)) return p;
    return p;
  }

  const quoted = /"([^"]+)"/.exec(error.message)?.[1];
  if (quoted) {
    const i = tokens.findIndex((t) => normToken(t) === quoted.toLowerCase());
    if (i >= 0) return i;
  }

  const firstDiff = alignment?.ops.find(isEdit);
  if (firstDiff) return firstDiff.li;
  return -1;
}

function candidate(error: SqlError): string | null {
  const text = error.raw ?? error.message;
  return (
    /Candidate bindings: "([^"]+)"/.exec(text)?.[1] ??
    /Did you mean "([^"]+)"/i.exec(text)?.[1] ??
    null
  );
}

/**
 * The short red-pen note under the circled token (six words at most), e.g.
 * "expected FROM". Uses the reference only when the learner is a single edit
 * away from it; otherwise DuckDB's own message, in friendly words.
 */
export function expectedHint(
  sql: string,
  referenceSql: string | undefined,
  tokenIndex: number,
  error?: SqlError,
  identifiers: readonly string[] = [],
): string {
  const tokens = lex(sql);
  const tok = tokens[tokenIndex];
  if (tok?.unterminated) return "close this quote";
  if (referenceSql) {
    const ref = lex(referenceSql);
    const edit = singleEdit(align(tokens, ref));
    if (edit && edit.li === tokenIndex) {
      if (edit.type === "del") return "nothing more needed here";
      const want = ref[edit.ri]?.text ?? "";
      if (edit.type === "sub") return `expected ${want}`;
      return tokenIndex >= tokens.length ? `expected ${want} next` : `${want} goes before this`;
    }
  }
  const kw = keywordTypo(tok, new Set(identifiers.map((s) => s.toLowerCase())));
  if (kw) return `expected ${kw}`;
  const cand = error ? candidate(error) : null;
  if (cand) return `did you mean ${cand}?`;
  if (tokenIndex >= tokens.length) return "something is missing here";
  return "check this word";
}

export interface Diagnosis {
  tokens: Token[];
  /** See locateErrorToken. */
  index: number;
  note: string;
  message: string;
  /** What to do about it. Every diagnosis names a fix. */
  hint: string;
}

function quote(t: Token | undefined): string {
  return t ? `"${t.text}"` : "it";
}

const isWordLike = (t: Token) => t.kind !== "op" && t.kind !== "punct";

/** 1-based position among words only, so symbols like * are not counted. */
export function wordNumber(tokens: Token[], index: number): number {
  return tokens.slice(0, index + 1).filter(isWordLike).length;
}

function listWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const COMPARE_HINT =
  "Compare it with the goal, clause by clause: which columns (SELECT), which table (FROM), which rule (WHERE).";

/** Everything the diagnostic strip shows for one failed run. */
export function diagnose(sql: string, error: SqlError, opts: LocateOptions = {}): Diagnosis {
  const tokens = lex(sql);
  if (error.kind === "empty") {
    return { tokens, index: -1, note: "write a query here", message: error.message, hint: "Start with SELECT, then FROM and the table name." };
  }
  if (error.kind === "blocked") {
    return { tokens, index: -1, note: "one SELECT only", message: error.message, hint: "Keep a single query that starts with SELECT and delete the rest." };
  }
  const index = locateErrorToken(sql, error, opts);
  const note = expectedHint(sql, opts.referenceSql, index, error, opts.identifiers);
  const tok = tokens[index];
  const ids = new Set((opts.identifiers ?? []).map((s) => s.toLowerCase()));
  const kw = keywordTypo(tok, ids);
  const cand = candidate(error);
  const missingCol = /Referenced column "([^"]+)" not found/i.exec(error.message)?.[1];
  const missingTable = /Table with name (\S+) does not exist/i.exec(error.message)?.[1];

  let message: string;
  let hint: string;
  if (tok?.unterminated) {
    message = "This text starts with a quote but never closes it.";
    hint = "Add the closing quote, so text values look like 'Lagos'.";
  } else if (note.startsWith("expected ") && tok && !note.endsWith(" next")) {
    const want = note.slice(9);
    message = isWordLike(tok)
      ? `Word ${wordNumber(tokens, index)} should be "${want}", but you typed ${quote(tok)}.`
      : `The symbol ${quote(tok)} should be "${want}".`;
    hint = kw
      ? "Check the spelling letter by letter."
      : "Change it to match the table and column names beside the slip, then run again.";
  } else if (note.endsWith(" next")) {
    message = `The query stops early. It needs "${note.slice(9, -5)}" next.`;
    hint = "Every comparison needs a value on both sides.";
  } else if (note.endsWith(" goes before this")) {
    message = `"${note.slice(0, -17)}" is missing before ${quote(tok)}.`;
    hint = "Read the query aloud: SELECT what, FROM which table, WHERE what rule.";
  } else if (note === "nothing more needed here") {
    message = `There is extra text DuckDB cannot use: ${quote(tok)}.`;
    hint = "Delete it and run again.";
  } else if (missingCol) {
    message = `There is no column called ${missingCol}.${cand ? ` Did you mean ${cand}?` : ""}`;
    hint = "Use one of the column names listed beside the slip.";
  } else if (missingTable) {
    const tables = opts.tables ?? [];
    message = `There is no table called ${missingTable}.${cand ? ` Did you mean ${cand}?` : ""}`;
    hint = tables.length
      ? `The tables that exist are ${listWords(tables)}.`
      : "Use the table name shown beside the slip.";
  } else if (index >= tokens.length) {
    message = "The query stops before it is finished.";
    hint = COMPARE_HINT;
  } else {
    message = friendlyError(error.message);
    hint = COMPARE_HINT;
  }
  return { tokens, index, note, message, hint };
}

export type CheckReason =
  | "error"
  | "missing column"
  | "extra column"
  | "wrong row count"
  | "rows differ"
  | "wrong order";

export type CheckResult =
  | { ok: true; learner: QueryResult }
  | { ok: false; reason: CheckReason; hint: string; learner: QueryResult };

/** Comparable form of a cell: numbers rounded so 50 and 50.0 agree. */
function normCell(v: unknown): string {
  if (typeof v === "number") return `n:${Math.round(v * 1e9) / 1e9}`;
  if (typeof v === "bigint") return `n:${Number(v)}`;
  if (v === null || v === undefined) return "null";
  return `s:${String(v)}`;
}

function rowKey(row: unknown[]): string {
  return JSON.stringify(row.map(normCell));
}

function countKeys(rows: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of rows) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/** Rows in `a` that are not matched in `b` (multiset difference). */
function difference(a: unknown[][], b: unknown[][]): unknown[][] {
  const left = countKeys(b.map(rowKey));
  return a.filter((r) => {
    const k = rowKey(r);
    const n = left.get(k) ?? 0;
    if (n > 0) {
      left.set(k, n - 1);
      return false;
    }
    return true;
  });
}

/**
 * When every row that differs shares one value in a column, and that value is
 * a number the learner typed, the mistake is almost certainly the boundary.
 */
function boundaryHint(sql: string, columns: string[], differing: unknown[][]): string | null {
  if (differing.length === 0) return null;
  const typed = new Set(lex(sql).filter((t) => t.kind === "number").map((t) => Number(t.text)));
  for (let c = 0; c < columns.length; c++) {
    const first = differing[0]?.[c];
    if (typeof first !== "number" || !typed.has(first)) continue;
    if (differing.every((r) => r[c] === first)) {
      return `Look at the rows where ${columns[c]} is exactly ${first}. Should they be in the result?`;
    }
  }
  return null;
}

/**
 * Checks the learner's RESULT against the reference query's result, not the
 * text. Any query that returns the same columns and rows passes.
 */
export async function checkAnswer(
  sql: string,
  lesson: { goal: LessonGoal; hints?: readonly string[] },
  runner: QueryRunner,
): Promise<CheckResult> {
  const empty: QueryResult = { columns: [], rows: [], ms: 0 };
  const guard = guardReadOnly(sql);
  if (!guard.ok) return { ok: false, reason: "error", hint: guard.error, learner: { ...empty, error: guard.error } };
  const learner = await runner.run(guard.sql);
  if (learner.error) {
    return { ok: false, reason: "error", hint: friendlyError(learner.error), learner };
  }
  const reference = await runner.run(lesson.goal.referenceSql);
  if (reference.error) throw new Error(`Reference query failed: ${reference.error}`);

  const lc = learner.columns.map((c) => c.toLowerCase());
  const rc = reference.columns.map((c) => c.toLowerCase());
  const missing = rc.filter((c) => !lc.includes(c));
  if (missing.length) {
    return {
      ok: false,
      reason: "missing column",
      hint: `Your result is missing ${missing.length === 1 ? "a column" : `${missing.length} columns`}: ${missing.join(", ")}.`,
      learner,
    };
  }
  const extra = lc.filter((c) => !rc.includes(c));
  if (extra.length) {
    return {
      ok: false,
      reason: "extra column",
      hint: `Your result has ${extra.length === 1 ? "a column" : "columns"} the goal does not ask for: ${extra.join(", ")}.`,
      learner,
    };
  }

  // Same columns, possibly in another order: line them up with the reference.
  const order = rc.map((c) => lc.indexOf(c));
  const rows = learner.rows.map((r) => order.map((i) => r[i]));
  const extraRows = difference(rows, reference.rows);
  const missingRows = difference(reference.rows, rows);
  const boundary = boundaryHint(sql, reference.columns, [...extraRows, ...missingRows]);
  const fallback = lesson.hints?.[lesson.hints.length - 1] ?? "Compare your rule with the goal once more.";

  if (rows.length !== reference.rows.length) {
    const n = rows.length;
    return {
      ok: false,
      reason: "wrong row count",
      hint: `Your query returned ${n} ${n === 1 ? "row" : "rows"}, but the goal needs ${reference.rows.length}. ${boundary ?? fallback}`,
      learner,
    };
  }
  if (extraRows.length) {
    return { ok: false, reason: "rows differ", hint: `The right number of rows, but not the right rows. ${boundary ?? fallback}`, learner };
  }
  if (lesson.goal.compare === "rows-ordered" && rows.map(rowKey).join() !== reference.rows.map(rowKey).join()) {
    return { ok: false, reason: "wrong order", hint: "The rows are right, but the order is not. Check how they are sorted.", learner };
  }
  return { ok: true, learner };
}
