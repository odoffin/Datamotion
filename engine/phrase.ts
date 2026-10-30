import { closingBracket, depths, isPunct, isWord, splitTop, textOf, unwrap } from "./clauses";
import type { Token } from "./lex";

/**
 * Plain-English readings of SQL fragments, built from the learner's own tokens.
 * Anything the rules below do not recognise is quoted as written, never guessed.
 */

/** "a, b and c" */
export const andList = (items: readonly string[], last = "and") =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items[items.length - 1]}`;

export type ValueKind = "number" | "date" | "text";

export interface PhraseContext {
  sql: string;
  /** HAVING and grouped SELECT lists talk about groups, not rows. */
  grouped?: boolean;
  /** What a column holds, from the real result, so sort directions read naturally. */
  kindOf?: (expr: string) => ValueKind | null;
}

const COMPARE: Record<string, string> = {
  ">": "is more than",
  ">=": "is at least",
  "<": "is less than",
  "<=": "is at most",
  "=": "is",
  "==": "is",
  "!=": "is not",
  "<>": "is not",
};

const AGGREGATES = new Set(["count", "sum", "avg", "min", "max"]);

/** A function call that spans the whole run: name ( … ), optionally followed by OVER ( … ). */
function call(ts: readonly Token[]): { name: string; args: Token[]; over: Token[] | null } | null {
  const name = ts[0];
  if (!name || (name.kind !== "word" && name.kind !== "keyword") || !isPunct(ts[1], "(")) return null;
  const close = closingBracket(ts, 1);
  if (close < 0) return null;
  const args = ts.slice(2, close);
  if (close === ts.length - 1) return { name: name.text.toLowerCase(), args, over: null };
  if (isWord(ts[close + 1], "over") && isPunct(ts[close + 2], "(") && closingBracket(ts, close + 2) === ts.length - 1) {
    return { name: name.text.toLowerCase(), args, over: ts.slice(close + 3, -1) };
  }
  return null;
}

const isColumnRef = (ts: readonly Token[]) =>
  ts.length > 0 &&
  ts.every((t, i) => (i % 2 === 0 ? t.kind === "word" || t.kind === "ident" : isPunct(t, "."))) &&
  ts.length % 2 === 1;

/** "COUNT(*)" as "number of rows", "SUM(amount)" as "total of amount". */
export function aggregatePhrase(ctx: PhraseContext, name: string, args: Token[]): string | null {
  const distinct = isWord(args[0], "distinct");
  const arg = textOf(ctx.sql, distinct ? args.slice(1) : args);
  switch (name) {
    case "count":
      if (arg === "*" || arg === "") return "number of rows";
      return distinct ? `number of different ${arg} values` : `number of ${arg} values that are not NULL`;
    case "sum": return `total of ${arg}`;
    case "avg": return `average of ${arg}`;
    case "min": return `smallest ${arg}`;
    case "max": return `largest ${arg}`;
    default: return null;
  }
}

/** A SELECT list that totals up rows (COUNT, SUM …) outside a window turns them all into one row. */
export function hasAggregate(ts: readonly Token[]): boolean {
  return ts.some((t, i) => {
    if (!AGGREGATES.has(t.text.toLowerCase()) || !isPunct(ts[i + 1], "(")) return false;
    const close = closingBracket(ts, i + 1);
    return close > 0 && !isWord(ts[close + 1], "over");
  });
}

/** "a" or "an", by the sound of the first letter. */
export const article = (word: string) => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);

/** One side of a comparison: quoted as written, except subqueries and (in groups) aggregates. */
function operand(ctx: PhraseContext, ts: Token[]): string {
  ts = unwrap(ts);
  if (isWord(ts[0], "select") || isWord(ts[0], "with")) return "the inner query's answer";
  const c = call(ts);
  if (c && !c.over && AGGREGATES.has(c.name)) {
    const agg = aggregatePhrase(ctx, c.name, c.args);
    if (agg) return ctx.grouped ? `its ${agg}` : `the ${agg}`;
  }
  return textOf(ctx.sql, ts);
}

function likePhrase(pattern: string, insensitive: boolean, negated: boolean): string {
  const inner = pattern.slice(1, -1).replaceAll("''", "'");
  const core = inner.replace(/^%|%$/g, "");
  const plain = core !== "" && !/[%_]/.test(core);
  // [what passes, what fails], each followed by the object.
  const [yes, no, object] =
    plain && inner.startsWith("%") && inner.endsWith("%") ? ["contains", "does not contain", core]
    : plain && inner.endsWith("%") ? ["starts with", "does not start with", core]
    : plain && inner.startsWith("%") ? ["ends with", "does not end with", core]
    : !/[%_]/.test(inner) ? ["is exactly", "is not", pattern]
    : ["matches the pattern", "does not match the pattern", `${pattern} (% stands for any run of characters, _ for any one character)`];
  const phrase = `${negated ? no : yes} ${object}`;
  return insensitive ? `${phrase}, ignoring capitals` : phrase;
}

/** One test with no AND or OR at its top level. */
function atom(ctx: PhraseContext, ts: Token[]): string {
  ts = unwrap(ts);
  const d = depths(ts);
  const top = (word: string) => ts.findIndex((t, i) => d[i] === 0 && isWord(t, word));
  const text = textOf(ctx.sql, ts);

  if (isWord(ts[0], "not") && isWord(ts[1], "exists")) return "the inner query finds no rows";
  if (isWord(ts[0], "exists")) return "the inner query finds at least one row";
  if (isWord(ts[0], "not")) return `this is false: ${textOf(ctx.sql, ts.slice(1))}`;

  const is = top("is");
  if (is > 0) {
    const not = isWord(ts[is + 1], "not");
    const what = ts.slice(is + (not ? 2 : 1));
    if (what.length === 1 && isWord(what[0], "null")) {
      return `${operand(ctx, ts.slice(0, is))} ${not ? "has a value (is not NULL)" : "is missing (NULL)"}`;
    }
  }

  const between = top("between");
  if (between > 0) {
    const not = isWord(ts[between - 1], "not");
    const rest = ts.slice(between + 1);
    const and = rest.findIndex((t, i) => depths(rest)[i] === 0 && isWord(t, "and"));
    if (and > 0) {
      const lhs = operand(ctx, ts.slice(0, not ? between - 1 : between));
      const low = textOf(ctx.sql, rest.slice(0, and));
      const high = textOf(ctx.sql, rest.slice(and + 1));
      return not ? `${lhs} is below ${low} or above ${high}` : `${lhs} is between ${low} and ${high}, both included`;
    }
  }

  for (const word of ["like", "ilike"]) {
    const at = top(word);
    const pattern = ts[at + 1];
    if (at > 0 && pattern?.kind === "string" && at + 2 === ts.length) {
      const not = isWord(ts[at - 1], "not");
      return `${operand(ctx, ts.slice(0, not ? at - 1 : at))} ${likePhrase(pattern.text, word === "ilike", not)}`;
    }
  }

  const inAt = top("in");
  if (inAt > 0 && isPunct(ts[inAt + 1], "(") && closingBracket(ts, inAt + 1) === ts.length - 1) {
    const not = isWord(ts[inAt - 1], "not");
    const lhs = operand(ctx, ts.slice(0, not ? inAt - 1 : inAt));
    const inside = ts.slice(inAt + 2, -1);
    if (isWord(inside[0], "select") || isWord(inside[0], "with")) {
      return `${lhs} ${not ? "is not" : "is"} in the list the inner query gives`;
    }
    const items = splitTop(inside, (t) => isPunct(t, ",")).map((p) => textOf(ctx.sql, p));
    return `${lhs} is ${not ? "none" : "one"} of ${andList(items, not ? "and" : "or")}`;
  }

  const op = ts.findIndex((t, i) => d[i] === 0 && t.kind === "op" && t.text in COMPARE);
  if (op > 0 && op < ts.length - 1) {
    const left = ts.slice(0, op);
    const right = ts.slice(op + 1);
    const sym = ts[op]!.text;
    if ((sym === "=" || sym === "==") && isColumnRef(left) && isColumnRef(right)) {
      return `${textOf(ctx.sql, left)} matches ${textOf(ctx.sql, right)}`;
    }
    return `${operand(ctx, left)} ${COMPARE[sym]} ${operand(ctx, right)}`;
  }

  return `this is true: ${text}`;
}

/** The AND that closes BETWEEN is part of the test, not a join between two tests. */
function splitAnd(ts: Token[]): Token[][] {
  let pendingBetween = 0;
  return splitTop(ts, (t) => {
    if (isWord(t, "between")) pendingBetween++;
    if (!isWord(t, "and")) return false;
    if (pendingBetween > 0) {
      pendingBetween--;
      return false;
    }
    return true;
  });
}

/** A WHERE, HAVING or ON condition in words: "amount is more than 50, and city is 'Lagos'". */
export function conditionPhrase(ctx: PhraseContext, ts: Token[]): string {
  ts = unwrap(ts);
  const ors = splitTop(ts, (t) => isWord(t, "or"));
  if (ors.length > 1) return ors.map((p) => conditionPhrase(ctx, p)).join(", or ");
  const ands = splitAnd(ts);
  if (ands.length > 1) {
    return ands
      .map((p) => {
        const inner = unwrap(p);
        const either = splitTop(inner, (t) => isWord(t, "or")).length > 1;
        return either ? `either ${conditionPhrase(ctx, inner)}` : conditionPhrase(ctx, inner);
      })
      .join(", and ");
  }
  return atom(ctx, ts);
}

const DIRECTION: Record<ValueKind | "unknown", [string, string]> = {
  number: ["smallest first", "largest first"],
  date: ["earliest first", "latest first"],
  text: ["A to Z", "Z to A"],
  unknown: ["lowest first", "highest first"],
};

/** "price, largest first" for each ORDER BY item (also used inside OVER). */
export function sortItems(ctx: PhraseContext, ts: Token[]): { expr: string; phrase: string }[] {
  return splitTop(ts, (t) => isPunct(t, ",")).map((item) => {
    let end = item.length;
    if (isWord(item[end - 2], "nulls")) end -= 2;
    const desc = isWord(item[end - 1], "desc");
    if (desc || isWord(item[end - 1], "asc")) end--;
    const expr = textOf(ctx.sql, item.slice(0, end));
    const words = DIRECTION[ctx.kindOf?.(expr) ?? "unknown"];
    return { expr, phrase: `${expr}, ${words[desc ? 1 : 0]}` };
  });
}

function windowPhrase(ctx: PhraseContext, name: string, args: Token[], over: Token[]): string {
  const d = depths(over);
  const at = (word: string) => over.findIndex((t, i) => d[i] === 0 && isWord(t, word) && isWord(over[i + 1], "by"));
  const partitionAt = at("partition");
  const orderAt = at("order");
  const partition =
    partitionAt >= 0 ? over.slice(partitionAt + 2, orderAt > partitionAt ? orderAt : over.length) : [];
  const order = orderAt >= 0 ? over.slice(orderAt + 2) : [];
  const arg = textOf(ctx.sql, args);
  const ordered = order.length > 0;
  let what: string;
  switch (name) {
    case "row_number": what = "a row number (1, 2, 3 and so on)"; break;
    case "rank": what = "a rank, where ties share a place"; break;
    case "dense_rank": what = "a rank with no gaps after ties"; break;
    case "sum": what = ordered ? `a running total of ${arg}` : `the total of ${arg}`; break;
    case "avg": what = ordered ? `a running average of ${arg}` : `the average of ${arg}`; break;
    case "count": what = ordered ? "a running count" : "the number of rows"; break;
    default: what = `${textOf(ctx.sql, args) ? `${name}(${arg})` : `${name}()`}, worked out over a window of rows`;
  }
  const parts = [what];
  if (partition.length) {
    const keys = splitTop(partition, (t) => isPunct(t, ",")).map((p) => textOf(ctx.sql, p));
    parts.push(`inside each ${andList(keys)} group`);
  }
  if (ordered) parts.push(`in order of ${andList(sortItems(ctx, order).map((s) => s.phrase), "then")}`);
  return `${parts.join(", ")}, without merging rows`;
}

function casePhrase(ctx: PhraseContext, ts: Token[]): string | null {
  // Searched CASE only: CASE WHEN … THEN … [ELSE …] END.
  if (!isWord(ts[0], "case") || !isWord(ts[1], "when") || !isWord(ts[ts.length - 1], "end")) return null;
  const body = ts.slice(1, -1);
  const d = depths(body);
  const marks = body.flatMap((t, i) => (d[i] === 0 && ["when", "then", "else"].some((w) => isWord(t, w)) ? [i] : []));
  const rules: string[] = [];
  let otherwise = "NULL";
  marks.forEach((m, k) => {
    const next = marks[k + 1] ?? body.length;
    const word = body[m]!.text.toLowerCase();
    const part = body.slice(m + 1, next);
    if (word === "when") {
      const then = marks[k + 1];
      const value = then !== undefined ? textOf(ctx.sql, body.slice(then + 1, marks[k + 2] ?? body.length)) : "";
      rules.push(`${value} when ${conditionPhrase(ctx, part)}`);
    } else if (word === "else") otherwise = textOf(ctx.sql, part);
  });
  return rules.length ? `a label: ${rules.join("; ")}; otherwise ${otherwise}` : null;
}

/** One expression of a SELECT list, without its alias. */
function expressionPhrase(ctx: PhraseContext, ts: Token[]): string {
  const text = textOf(ctx.sql, ts);
  if (text === "*") return "every column";
  if (ts.length === 3 && isPunct(ts[1], ".") && ts[2]?.text === "*") return `every column of ${ts[0]!.text}`;
  const c = call(ts);
  if (c?.over) return windowPhrase(ctx, c.name, c.args, c.over);
  if (c && AGGREGATES.has(c.name)) {
    const agg = aggregatePhrase(ctx, c.name, c.args);
    if (agg) return `the ${agg}${ctx.grouped ? " in each group" : ""}`;
  }
  if (c) {
    const args = splitTop(c.args, (t) => isPunct(t, ",")).map((p) => textOf(ctx.sql, p));
    switch (c.name) {
      case "upper": return `${args[0]} in capital letters`;
      case "lower": return `${args[0]} in small letters`;
      case "length": return `the number of characters in ${args[0]}`;
      case "month": return `the month number of ${args[0]}`;
      case "year": return `the year of ${args[0]}`;
      case "coalesce": return `${args[0]}, or ${andList(args.slice(1), "or")} where ${args[0]} is NULL`;
      case "round":
        return args[1] === undefined || args[1] === "0"
          ? `${args[0]} rounded to a whole number`
          : `${args[0]} rounded to ${args[1]} decimal place${args[1] === "1" ? "" : "s"}`;
    }
  }
  const label = casePhrase(ctx, ts);
  if (label) return label;
  const glued = splitTop(ts, (t) => t.kind === "op" && t.text === "||");
  if (glued.length > 1) return `${andList(glued.map((p) => textOf(ctx.sql, p)))} joined into one piece of text`;
  return text;
}

/** One item of a SELECT list, e.g. "the number of rows in each group (as orders)". */
export function selectItemPhrase(ctx: PhraseContext, ts: Token[]): string {
  const n = ts.length;
  const aliased = n >= 3 && isWord(ts[n - 2], "as");
  const expr = aliased ? ts.slice(0, -2) : ts;
  const alias = aliased ? ts[n - 1]!.text.replace(/^"|"$/g, "") : null;
  const phrase = expressionPhrase(ctx, expr);
  if (!alias) return phrase;
  return isColumnRef(expr) ? `${phrase} (renamed ${alias})` : `${phrase} (as ${alias})`;
}

/** The column references a condition reads ("amount", "o.amount"), outside subqueries, at most three. */
export function columnRefs(ts: readonly Token[], sql: string): string[] {
  const out = new Map<string, string>();
  let skipUntil = -1;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]!;
    if (i <= skipUntil) continue;
    if (isPunct(t, "(") && (isWord(ts[i + 1], "select") || isWord(ts[i + 1], "with"))) {
      skipUntil = closingBracket(ts, i);
      if (skipUntil < 0) break;
      continue;
    }
    if (t.kind !== "word" && t.kind !== "ident") continue;
    if (isPunct(ts[i - 1], ".")) continue;
    let j = i;
    while (isPunct(ts[j + 1], ".") && (ts[j + 2]?.kind === "word" || ts[j + 2]?.kind === "ident")) j += 2;
    if (isPunct(ts[j + 1], "(")) continue; // a function name
    const ref = textOf(sql, ts.slice(i, j + 1));
    if (!out.has(ref.toLowerCase())) out.set(ref.toLowerCase(), ref);
    i = j;
  }
  return [...out.values()].slice(0, 3);
}
