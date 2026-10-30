import { closingBracket, depths, isPunct, isWord, splitTop } from "./clauses";
import { keywordTypo, lex, normToken, type Token } from "./lex";
import { splitStatements } from "./sandbox";

/**
 * The house style for every query in Datapen, after the common professional
 * SQL style guides: a ; at the end of every statement, keywords in capitals,
 * each clause on its own line at the
 * left margin, four-space indents, one column per line once there are three
 * or more, extra AND / OR tests on their own lines, ON under its JOIN, and AS
 * written out for table aliases.
 *
 * Only layout and capitals change; the learner's words stay as written, so a
 * typo is never quietly fixed. Text with comments is left alone.
 */

const INDENT = "    ";
/** A SELECT list longer than this goes one column per line, even with one or two columns. */
const INLINE_WIDTH = 60;

const FUNCTIONS = new Set([
  "count", "sum", "avg", "min", "max", "round", "upper", "lower", "length", "coalesce", "nullif", "abs",
  "month", "year", "day", "date_trunc", "extract", "cast", "concat", "substr", "substring", "trim", "replace",
  "row_number", "rank", "dense_rank", "ntile", "lag", "lead", "first_value", "last_value", "now", "current_date",
]);
const TYPES = new Set(["integer", "int", "bigint", "varchar", "text", "double", "real", "float", "decimal", "numeric", "date", "timestamp", "boolean"]);
const JOIN_MODIFIERS = new Set(["left", "right", "full", "inner", "outer", "cross", "natural"]);
/** Words that start a clause of a SELECT. */
const CLAUSE_WORDS = new Set(["select", "from", "where", "group", "having", "qualify", "order", "limit", "offset", "union", "except", "intersect"]);
/** After these, a name and its bracket keep a space: INSERT INTO notes (id, body). */
/** After these comes a name, never a clause. */
const NAME_AFTER = new Set(["from", "join", "into", "update", "table", "by", "as", "on", "select", ",", "."]);
const NAME_BEFORE_BRACKET = new Set(["into", "table", "on", "references", "view", "index", "with"]);

interface Style {
  /** Names the lesson uses, so a column called "form" is never read as a misspelt FROM. */
  identifiers: ReadonlySet<string>;
  /** In CREATE and ALTER, type names go in capitals too. */
  types: boolean;
}

const lower = (t: Token | undefined) => t?.text.toLowerCase() ?? "";

function cased(ts: readonly Token[], i: number, style: Style): string {
  const t = ts[i]!;
  if (t.kind === "keyword") return t.text.toUpperCase();
  if (t.kind === "word") {
    const w = t.text.toLowerCase();
    if (FUNCTIONS.has(w) && isPunct(ts[i + 1], "(")) return t.text.toUpperCase();
    if (style.types && TYPES.has(w)) return t.text.toUpperCase();
  }
  return t.text;
}

/** Tokens back to one line of text, spaced the standard way: COUNT(*), a.b, x, y, (1, 2). */
function inline(ts: readonly Token[], style: Style): string {
  let out = "";
  ts.forEach((t, i) => {
    const prev = ts[i - 1];
    const before = ts[i - 2];
    let space = i > 0;
    if (isPunct(t, ",") || isPunct(t, ")") || isPunct(t, ".") || isPunct(t, ";")) space = false;
    if (prev && (isPunct(prev, "(") || isPunct(prev, "."))) space = false;
    if (isPunct(t, "(") && prev && (prev.kind === "word" || prev.kind === "ident") && !NAME_BEFORE_BRACKET.has(lower(before))) space = false;
    if ((t.kind === "op" && t.text === "::") || (prev?.kind === "op" && prev.text === "::")) space = false;
    // A minus sign that starts a number: -5, (-5), x = -5.
    if (t.kind === "number" && prev?.kind === "op" && prev.text === "-" && (!before || before.kind === "op" || before.kind === "keyword" || isPunct(before, "(") || isPunct(before, ","))) space = false;
    out += (space ? " " : "") + cased(ts, i, style);
  });
  return out;
}

const indent = (text: string, by = INDENT) => text.split("\n").map((l) => (l ? by + l : l)).join("\n");

/** A condition with its extra AND / OR tests on their own indented lines. BETWEEN's AND stays put. */
function conditionLines(ts: readonly Token[], style: Style): string {
  const d = depths(ts);
  let between = 0;
  const cuts: number[] = [];
  ts.forEach((t, i) => {
    if (d[i] !== 0) return;
    if (isWord(t, "between")) between++;
    else if (isWord(t, "and") && between > 0) between--;
    else if ((isWord(t, "and") || isWord(t, "or")) && i > 0) cuts.push(i);
  });
  const parts = [0, ...cuts].map((at, k) => ts.slice(at, cuts[k] ?? ts.length));
  return parts.map((p, k) => (k === 0 ? inline(p, style) : `\n${INDENT}${inline(p, style)}`)).join("");
}

/** CASE … END laid out as a block: each WHEN and the ELSE on its own line. */
function caseBlock(ts: readonly Token[], style: Style): string | null {
  const at = ts.findIndex((t) => isWord(t, "case"));
  const end = ts.findLastIndex((t) => isWord(t, "end"));
  if (at < 0 || end < at) return null;
  const body = ts.slice(at + 1, end);
  const d = depths(body);
  const marks = body.flatMap((t, i) => (d[i] === 0 && (isWord(t, "when") || isWord(t, "else")) ? [i] : []));
  if (!marks.length || marks[0] !== 0) return null;
  const lines = marks.map((m, k) => INDENT + inline(body.slice(m, marks[k + 1] ?? body.length), style));
  const head = inline(ts.slice(0, at + 1), style);
  const tail = inline(ts.slice(end), style);
  return [head, ...lines, tail].join("\n");
}

/** One SELECT item: a CASE becomes a block, anything else stays on one line. */
function selectItem(ts: readonly Token[], style: Style): string {
  return caseBlock(ts, style) ?? inline(ts, style);
}

/** FROM orders o  becomes  FROM orders AS o. */
function withAs(ts: readonly Token[]): Token[] {
  const table = ts[0];
  const alias = ts[1];
  const rest = ts[2];
  if (table && alias && (table.kind === "word" || table.kind === "ident") && alias.kind === "word" && (!rest || isWord(rest, "on") || isWord(rest, "using"))) {
    return [table, { text: "AS", kind: "keyword", start: alias.start, end: alias.start }, ...ts.slice(1)];
  }
  return [...ts];
}

function clauseKind(ts: readonly Token[], i: number, style: Style): string | null {
  const t = ts[i]!;
  if (t.kind !== "keyword" && t.kind !== "word") return null;
  const w = t.text.toLowerCase();
  if (CLAUSE_WORDS.has(w)) return w;
  if (w === "join") return "join";
  // A misspelt clause keyword still gets its own line, so the layout never hints at the typo.
  // A word right after FROM, JOIN and the like is a name (orders is not a misspelt ORDER).
  if (NAME_AFTER.has(lower(ts[i - 1])) || isPunct(ts[i + 1], ".") || isPunct(ts[i + 1], "(")) return null;
  const typo = keywordTypo(t, style.identifiers)?.toLowerCase();
  return typo && (CLAUSE_WORDS.has(typo) || typo === "join") ? typo : null;
}

/** A SELECT (or WITH … SELECT) laid out clause by clause. */
function formatQuery(ts: Token[], style: Style): string {
  if (!ts.length) return "";
  const d = depths(ts);
  const starts: { at: number; kind: string }[] = [];
  ts.forEach((_, i) => {
    if (d[i] !== 0) return;
    if (i === 0 && isWord(ts[0], "with")) {
      starts.push({ at: 0, kind: "with" });
      return;
    }
    const kind = clauseKind(ts, i, style);
    if (!kind) return;
    let at = i;
    if (kind === "join") while (at > 0 && d[at - 1] === 0 && JOIN_MODIFIERS.has(lower(ts[at - 1]))) at--;
    if (starts.length && starts[starts.length - 1]!.at >= at) return;
    starts.push({ at, kind });
  });
  if (!starts.length || starts[0]!.at > 0) starts.unshift({ at: 0, kind: "other" });
  return starts
    .map(({ at, kind }, k) => {
      const part = ts.slice(at, starts[k + 1]?.at ?? ts.length);
      return formatClause(kind, part, style);
    })
    .join("\n");
}

function formatClause(kind: string, part: Token[], style: Style): string {
  switch (kind) {
    case "with":
      return formatWith(part, style);
    case "select": {
      const distinct = isWord(part[1], "distinct");
      const head = inline(part.slice(0, distinct ? 2 : 1), style);
      const items = splitTop(part.slice(distinct ? 2 : 1), (t) => isPunct(t, ","));
      const flat = items.map((p) => inline(p, style)).join(", ");
      const hasCase = items.some((p) => p.some((t) => isWord(t, "case")));
      if (items.length < 3 && !hasCase && head.length + flat.length < INLINE_WIDTH) return `${head} ${flat}`.trimEnd();
      return `${head}\n${items.map((p) => indent(selectItem(p, style))).join(",\n")}`;
    }
    case "from":
      return inline([part[0]!, ...withAs(part.slice(1))], style);
    case "join": {
      const at = part.findIndex((t) => isWord(t, "join"));
      const d = depths(part);
      const on = part.findIndex((t, i) => d[i] === 0 && isWord(t, "on"));
      const target = withAs(part.slice(at + 1, on < 0 ? part.length : on));
      const head = inline([...part.slice(0, at + 1), ...target], style);
      return on < 0 ? head : `${head}\n${INDENT}ON ${conditionLines(part.slice(on + 1), style)}`;
    }
    case "where":
    case "having":
    case "qualify":
      return `${inline(part.slice(0, 1), style)} ${conditionLines(part.slice(1), style)}`.trimEnd();
    default:
      return inline(part, style);
  }
}

/** WITH name AS ( … ): each named step's query indented inside its brackets. */
function formatWith(part: Token[], style: Style): string {
  const ctes = splitTop(part.slice(1), (t) => isPunct(t, ","));
  const blocks: string[] = [];
  for (const cte of ctes) {
    const open = cte.findIndex((t) => isPunct(t, "("));
    const close = open >= 0 ? closingBracket(cte, open) : -1;
    if (open < 0 || close !== cte.length - 1 || !cte.slice(0, open).some((t) => isWord(t, "as"))) return inline(part, style);
    blocks.push(`${inline(cte.slice(0, open), style)} (\n${indent(formatQuery(cte.slice(open + 1, close), style))}\n)`);
  }
  return `WITH ${blocks.join(",\n")}`;
}

/** WHERE with its tests, the tail of UPDATE and DELETE. */
function whereLines(ts: Token[], style: Style): string {
  return ts.length ? `\n${formatClause("where", ts, style)}` : "";
}

function formatStatement(ts: Token[], style: Style): string {
  const d = depths(ts);
  const first = lower(ts[0]);
  const top = (word: string, from = 0) => ts.findIndex((t, i) => i >= from && d[i] === 0 && isWord(t, word));

  if (first === "select" || first === "with") return formatQuery(ts, style);
  if (first === "explain") {
    const rest = isWord(ts[1], "analyze") ? 2 : 1;
    return `${inline(ts.slice(0, rest), style)}\n${formatStatement(ts.slice(rest), style)}`;
  }
  if (first === "create") {
    const as = top("as");
    if (as > 0 && (isWord(ts[as + 1], "select") || isWord(ts[as + 1], "with"))) {
      return `${inline(ts.slice(0, as + 1), style)}\n${formatQuery(ts.slice(as + 1), style)}`;
    }
    // A view written without AS still puts its query on the lines below.
    const select = top("select");
    if (select > 0) return `${inline(ts.slice(0, select), style)}\n${formatQuery(ts.slice(select), style)}`;
    const kind = lower(ts[1]) === "table" || keywordTypo(ts[1], style.identifiers) === "TABLE";
    const open = ts.findIndex((t, i) => d[i] === 0 && isPunct(t, "("));
    const close = open >= 0 ? closingBracket(ts, open) : -1;
    if (kind && open > 0 && close > open) {
      const defs = splitTop(ts.slice(open + 1, close), (t) => isPunct(t, ","));
      const tail = ts.slice(close + 1);
      return `${inline(ts.slice(0, open), style)} (\n${defs.map((p) => INDENT + inline(p, style)).join(",\n")}\n)${tail.length ? ` ${inline(tail, style)}` : ""}`;
    }
    return inline(ts, style);
  }
  if (first === "insert") {
    const values = top("values");
    if (values > 0) {
      const tuples = splitTop(ts.slice(values + 1), (t) => isPunct(t, ","));
      return `${inline(ts.slice(0, values), style)}\nVALUES\n${tuples.map((p) => INDENT + inline(p, style)).join(",\n")}`;
    }
    const select = top("select") >= 0 ? top("select") : top("with");
    if (select > 0) return `${inline(ts.slice(0, select), style)}\n${formatQuery(ts.slice(select), style)}`;
    return inline(ts, style);
  }
  if (first === "update") {
    const set = top("set");
    const where = top("where");
    if (set < 0) return inline(ts, style);
    const end = where < 0 ? ts.length : where;
    const assigns = splitTop(ts.slice(set + 1, end), (t) => isPunct(t, ","));
    const setText =
      assigns.length < 2 ? `SET ${inline(ts.slice(set + 1, end), style)}` : `SET\n${assigns.map((p) => INDENT + inline(p, style)).join(",\n")}`;
    return `${inline(ts.slice(0, set), style)}\n${setText}${whereLines(where < 0 ? [] : ts.slice(where), style)}`;
  }
  if (first === "delete") {
    const where = top("where");
    return `${inline(ts.slice(0, where < 0 ? ts.length : where), style)}${whereLines(where < 0 ? [] : ts.slice(where), style)}`;
  }
  return inline(ts, style);
}

/** Comments would be lost when the text is rebuilt from tokens, so text with them is left as it is. */
function hasComment(sql: string): boolean {
  return /--|\/\*/.test(sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"/g, "''"));
}

/** The query in the house style. Never throws; text it cannot read is returned as it was. */
export function formatSql(sql: string, identifiers: Iterable<string> = []): string {
  try {
    if (!sql.trim() || hasComment(sql)) return sql;
    const statements = splitStatements(sql);
    if (!statements) return sql;
    const ids = new Set([...identifiers].map((s) => s.toLowerCase()));
    const out = statements.map((s) => {
      const ts = lex(s.text).filter((t) => !isPunct(t, ";"));
      const style: Style = { identifiers: ids, types: ["create", "alter"].includes(lower(ts[0])) };
      return formatStatement(ts, style);
    });
    // Every statement ends with ; like a sentence ends with a full stop.
    return out.map((s) => `${s};`).join("\n\n");
  } catch {
    return sql;
  }
}

/** Whether two texts are the same query, whatever their layout, capitals and optional AS. */
export function sameQuery(a: string, b: string): boolean {
  const norm = (s: string) =>
    lex(s)
      .filter((t) => !isPunct(t, ";") && !isWord(t, "as"))
      .map(normToken)
      .join(" ");
  return norm(a) === norm(b);
}
