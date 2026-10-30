import { closingBracket, depths, isPunct, isWord, parseWith, splitClauses, splitTop, textOf, unwrap, type Clause } from "./clauses";
import { lex, type Token } from "./lex";
import { andList, article, columnRefs, conditionPhrase, hasAggregate, selectItemPhrase, sortItems, type PhraseContext, type ValueKind } from "./phrase";
import type { QueryResult, QueryRunner } from "./query-runner";
import { splitStatements } from "./sandbox";
import { quoteIdent } from "./sql";

/**
 * "Read it": the learner's own query, clause by clause, in the order the
 * database runs it, each step in plain words with the rows going in and out.
 * Counts and figures come from running pieces of the learner's own text; the
 * words come from its tokens. Nothing is invented: what the rules cannot read
 * is quoted as written.
 */

/** A few real rows from the scan, each with the condition's verdict. */
export interface VerdictFigure {
  kind: "verdicts";
  columns: string[];
  rows: { n: number; cells: string[]; kept: boolean; unknown: boolean }[];
}

/** Rows of the left table and the rows each one matches on the right (a join drawn as matches, not circles). */
export interface MatchFigure {
  kind: "matches";
  left: { name: string; key: string; label: string | null };
  right: { name: string; key: string; label: string | null };
  /** LEFT and FULL joins keep a row that matches nothing. */
  keepsUnmatched: boolean;
  rows: { label: string | null; key: string; matches: string[] }[];
}

export type Figure = VerdictFigure | MatchFigure;

export interface ExplainStep {
  /** The clause this step is about, as the learner wrote it. */
  sql: string;
  /** What it does, in plain words. */
  sentence: string;
  /** Rows in and out, when the database could count them. */
  count?: string;
  figure?: Figure;
}

export interface Explanation {
  steps: ExplainStep[];
  /** Said once, when the run order differs from the written order. */
  note: string | null;
}

export interface ExplainOptions {
  /** Counts and figures run pieces of the query. Without a runner, words only. */
  runner?: QueryRunner | null;
  /** The dataset's tables, so join figures can name real columns. */
  tables?: readonly { name: string; columns: readonly { name: string }[] }[];
  /** The query's real result, so sort directions match the values. */
  result?: QueryResult | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const rows = (n: number) => plural(n, "row");
const unquote = (s: string) => s.replace(/^"(.*)"$/, "$1");

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return String(v);
}

function kinds(result: QueryResult | null | undefined) {
  return (expr: string): ValueKind | null => {
    if (!result) return null;
    const want = unquote(expr.trim().replace(/^.*\./, "")).toLowerCase();
    const col = result.columns.findIndex((c) => c.toLowerCase() === want);
    if (col < 0) return null;
    const v = result.rows.map((r) => r[col]).find((x) => x !== null && x !== undefined);
    if (typeof v === "number" || typeof v === "bigint") return "number";
    if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}/.test(v) ? "date" : "text";
    return null;
  };
}

async function countOf(runner: QueryRunner | null, sql: string): Promise<number | null> {
  if (!runner) return null;
  const res = await runner.run(sql);
  const v = res.error ? null : res.rows[0]?.[0];
  return typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null;
}

/** First run of tokens spanning `clauses`, as text. */
const span = (sql: string, clauses: readonly Clause[]) =>
  clauses.length ? sql.slice(clauses[0]!.tokens[0]!.start, clauses[clauses.length - 1]!.tokens.at(-1)!.end) : "";

interface TableRef {
  name: string;
  alias: string | null;
}

function tableRef(sql: string, ts: readonly Token[]): TableRef {
  let i = 0;
  while (isPunct(ts[i + 1], ".")) i += 2;
  const name = unquote(textOf(sql, ts.slice(0, i + 1)));
  let rest = ts.slice(i + 1);
  if (isWord(rest[0], "as")) rest = rest.slice(1);
  const a = rest[0];
  return { name, alias: a && (a.kind === "word" || a.kind === "ident") ? unquote(a.text) : null };
}

interface ParsedJoin extends TableRef {
  kind: "inner" | "left" | "right" | "full" | "cross" | "natural";
  on: Token[] | null;
  using: string[] | null;
}

function parseJoin(sql: string, clause: Clause): ParsedJoin {
  const ts = clause.tokens;
  const at = ts.findIndex((t) => isWord(t, "join"));
  const mods = ts.slice(0, at).map((t) => t.text.toLowerCase());
  const kind = (["cross", "natural", "left", "right", "full"] as const).find((k) => mods.includes(k)) ?? "inner";
  const rest = ts.slice(at + 1);
  const d = depths(rest);
  const onAt = rest.findIndex((t, i) => d[i] === 0 && isWord(t, "on"));
  const usingAt = rest.findIndex((t, i) => d[i] === 0 && isWord(t, "using"));
  const end = [onAt, usingAt].filter((i) => i >= 0)[0] ?? rest.length;
  const using =
    usingAt >= 0 ? splitTop(unwrap(rest.slice(usingAt + 1)), (t) => isPunct(t, ",")).map((p) => textOf(sql, p)) : null;
  return { ...tableRef(sql, rest.slice(0, end)), kind, on: onAt >= 0 ? rest.slice(onAt + 1) : null, using };
}

function joinSentence(ctx: PhraseContext, j: ParsedJoin, seen: ReadonlySet<string>): string {
  const target = j.alias ?? j.name;
  const intro = `${seen.has(j.name.toLowerCase()) ? `Bring in ${j.name} a second time` : `Bring in the ${j.name} table`}${j.alias ? `, called ${j.alias}` : ""}`;
  if (j.kind === "cross") return `${intro}, and pair every row with every ${target} row.`;
  const match = j.on
    ? `where ${conditionPhrase(ctx, j.on)}`
    : j.using
      ? `where ${andList(j.using)} ${j.using.length > 1 ? "are" : "is"} the same on both sides`
      : "that share a column name";
  const rule = {
    inner: "Rows with no match are left out.",
    natural: "Rows with no match are left out.",
    left: `Rows with no match stay, with NULL in the ${target} columns.`,
    right: `${target} rows with no match stay too, with NULL in the other columns.`,
    full: "Rows with no match on either side stay, with NULL where the other side is missing.",
  }[j.kind];
  return `${intro}, and put each row next to the ${target} rows ${match}. ${rule}`;
}

/** Qualified column references in a clause: o.amount as { q: "o", col: "amount" }. */
function qualifiedRefs(ts: readonly Token[]): { q: string; col: string }[] {
  const out: { q: string; col: string }[] = [];
  ts.forEach((t, i) => {
    const col = ts[i + 2];
    if ((t.kind === "word" || t.kind === "ident") && isPunct(ts[i + 1], ".") && col && (col.kind === "word" || col.kind === "ident")) {
      out.push({ q: unquote(t.text).toLowerCase(), col: unquote(col.text).toLowerCase() });
    }
  });
  return out;
}

interface MatchInput {
  join: ParsedJoin;
  /** Alias or table name (lower case) to table name, for tables already in FROM. */
  aliases: ReadonlyMap<string, string>;
  selectRefs: { q: string; col: string }[];
}

async function matchFigure(runner: QueryRunner, opts: ExplainOptions, m: MatchInput): Promise<MatchFigure | undefined> {
  const on = m.join.on ? unwrap(m.join.on) : null;
  if (!on || !opts.tables) return;
  const d = depths(on);
  const eq = on.findIndex((t, i) => d[i] === 0 && t.kind === "op" && (t.text === "=" || t.text === "=="));
  const sides = [on.slice(0, eq), on.slice(eq + 1)].map((s) => (s.length === 3 ? qualifiedRefs(s)[0] : undefined));
  const rightQ = (m.join.alias ?? m.join.name).toLowerCase();
  const right = sides.find((s) => s?.q === rightQ);
  const left = sides.find((s) => s && s !== right && m.aliases.has(s.q));
  if (eq < 0 || !right || !left) return;
  const def = (name: string) => opts.tables!.find((t) => t.name.toLowerCase() === name.toLowerCase());
  const leftDef = def(m.aliases.get(left.q)!);
  const rightDef = def(m.join.name);
  const col = (t: typeof leftDef, c: string) => t?.columns.find((x) => x.name.toLowerCase() === c)?.name;
  const lk = col(leftDef, left.col);
  const rk = col(rightDef, right.col);
  if (!leftDef || !rightDef || !lk || !rk) return;
  const label = (q: string, t: NonNullable<typeof leftDef>, key: string) =>
    col(t, m.selectRefs.find((r) => r.q === q && r.col !== key.toLowerCase() && col(t, r.col))?.col ?? "") ??
    ["name", "id"].map((c) => (c !== key.toLowerCase() ? col(t, c) : undefined)).find(Boolean) ??
    null;
  const ll = label(left.q, leftDef, lk);
  const rl = label(right.q, rightDef, rk);
  const q = quoteIdent;
  const pairs = `${q(leftDef.name)} AS l LEFT JOIN ${q(rightDef.name)} AS r ON l.${q(lk)} = r.${q(rk)}`;

  const counted = await runner.run(`SELECT l.rowid AS id, count(r.${q(rk)}) AS n FROM ${pairs} GROUP BY l.rowid ORDER BY l.rowid LIMIT 500`);
  if (counted.error || !counted.rows.length) return;
  const all = counted.rows.map((r) => ({ id: Number(r[0]), n: Number(r[1]) }));
  // A few rows from the top, plus one that matches nothing and one that matches several, if any do.
  const pick = new Set(all.slice(0, 3).map((r) => r.id));
  for (const extra of [all.find((r) => r.n === 0), all.find((r) => r.n >= 2)]) if (extra) pick.add(extra.id);
  const ids = [...pick].sort((a, b) => a - b).slice(0, 5);

  const detail = await runner.run(
    `SELECT l.rowid, l.${q(lk)}, ${ll ? `l.${q(ll)}` : "NULL"}, r.${q(rk)}, ${rl ? `r.${q(rl)}` : "NULL"} FROM ${pairs} ` +
      `WHERE l.rowid IN (${ids.join(", ")}) ORDER BY l.rowid, r.rowid`,
  );
  if (detail.error) return;
  const byRow = new Map<number, MatchFigure["rows"][number]>();
  for (const [id, key, lab, rkey, rlab] of detail.rows) {
    const row = byRow.get(Number(id)) ?? { label: ll ? cellText(lab) : null, key: cellText(key), matches: [] };
    if (rkey !== null && rkey !== undefined) row.matches.push(cellText(rl ? rlab : rkey));
    byRow.set(Number(id), row);
  }
  return {
    kind: "matches",
    left: { name: left.q === leftDef.name.toLowerCase() ? leftDef.name : left.q, key: lk, label: ll },
    right: { name: m.join.alias ?? rightDef.name, key: rk, label: rl },
    keepsUnmatched: m.join.kind === "left" || m.join.kind === "full",
    rows: [...byRow.values()],
  };
}

async function verdictFigure(runner: QueryRunner, prefix: string, from: string, where: Clause, sql: string): Promise<VerdictFigure | undefined> {
  const cond = textOf(sql, where.tokens.slice(1));
  const refs = columnRefs(where.tokens.slice(1), sql);
  if (!refs.length || !from) return;
  const res = await runner.run(`${prefix}SELECT (${cond}) AS __keep, ${refs.join(", ")} ${from} LIMIT 60`);
  if (res.error || !res.rows.length) return;
  const all = res.rows.map((r, i) => ({ n: i + 1, keep: r[0], cells: r.slice(1).map(cellText) }));
  const pick = all.slice(0, 4);
  // Show both verdicts when the scan has both.
  for (const kept of [true, false]) {
    if (!pick.some((r) => (r.keep === true) === kept)) {
      const extra = all.find((r) => (r.keep === true) === kept);
      if (extra) pick.push(extra);
    }
  }
  return {
    kind: "verdicts",
    columns: refs,
    rows: pick.sort((a, b) => a.n - b.n).map((r) => ({ n: r.n, cells: r.cells, kept: r.keep === true, unknown: r.keep === null })),
  };
}

/** Subqueries in brackets inside a clause, each as written. */
function subqueries(sql: string, ts: readonly Token[]): string[] {
  const out: string[] = [];
  ts.forEach((t, i) => {
    if (!isPunct(t, "(") || !(isWord(ts[i + 1], "select") || isWord(ts[i + 1], "with"))) return;
    const close = closingBracket(ts, i);
    if (close > i && !out.length) out.push(textOf(sql, ts.slice(i + 1, close)));
  });
  return out;
}

async function subquerySteps(sql: string, clause: Clause, runner: QueryRunner | null, prefix: string, tester: string): Promise<ExplainStep[]> {
  const steps: ExplainStep[] = [];
  for (const inner of subqueries(sql, clause.tokens)) {
    const res = runner ? await runner.run(`${/^\s*with\b/i.test(inner) ? "" : prefix}${inner}`) : null;
    const ok = res && !res.error && res.columns.length === 1;
    steps.push({
      sql: inner,
      sentence: ok
        ? `Before ${tester} tests anything, the inner query in brackets runs on its own.`
        : `The inner query in brackets gives ${tester} something to compare with.`,
      count: !ok ? undefined : res.rows.length === 1 ? `It gives one value: ${cellText(res.rows[0]![0])}` : `It gives a list of ${plural(res.rows.length, "value")}`,
    });
  }
  return steps;
}

const RUNS_BEFORE_SELECT: Partial<Record<Clause["kind"], string>> = {
  from: "FROM", join: "JOIN", where: "WHERE", group: "GROUP BY", having: "HAVING",
};

async function explainQuery(sql: string, opts: ExplainOptions): Promise<Explanation> {
  const clauses = splitClauses(sql);
  const withClause = clauses[0]?.kind === "with" ? clauses[0] : null;
  const body = withClause ? clauses.slice(1) : clauses;
  const prefix = withClause ? `${withClause.text} ` : "";
  const ctes = withClause ? parseWith(sql, withClause) : [];
  const runner = opts.runner ?? null;
  const count = (q: string) => countOf(runner, q);
  const ctx: PhraseContext = { sql, kindOf: kinds(opts.result) };
  const steps: ExplainStep[] = [];

  for (const cte of ctes) {
    const n = await count(`${prefix}SELECT count(*) FROM ${quoteIdent(cte.name)}`);
    steps.push({
      sql: cte.text,
      sentence: `Work out ${cte.name} first. Its own query runs, and the steps below can read ${cte.name} like a table.`,
      count: n === null ? undefined : `${rows(n)} in ${cte.name}`,
    });
  }

  const tail = (from: number) => {
    let i = body.length;
    while (i > from && ["order", "limit", "offset"].includes(body[i - 1]!.kind)) i--;
    return i;
  };
  const setAt = body.flatMap((c, i) => (c.kind === "set" ? [i] : []));

  if (setAt.length) {
    const end = tail(setAt[setAt.length - 1]! + 1);
    const bounds = [-1, ...setAt, end];
    const ordinal = ["first", "second", "third"];
    for (let k = 0; k + 1 < bounds.length; k++) {
      const side = body.slice(bounds[k]! + 1, bounds[k + 1]);
      const n = await count(`${prefix}SELECT count(*) FROM (${span(sql, side)})`);
      steps.push({
        sql: span(sql, side),
        sentence: `Run the ${ordinal[k] ?? `next`} query on its own.`,
        count: n === null ? undefined : rows(n),
      });
      if (k === 0) continue;
      const op = body[bounds[k]!]!;
      const words = op.tokens.map((t) => t.text.toLowerCase());
      const all = words.includes("all");
      const sentence = words[0] === "union"
        ? all ? "Put the two lists one under the other, keeping repeated rows." : "Put the two lists one under the other, then remove repeated rows, so each row appears once."
        : words[0] === "except" ? "Keep the rows of the first list that are not in the second."
        : "Keep only the rows that are in both lists.";
      const together = await count(`${prefix}SELECT count(*) FROM (${span(sql, body.slice(0, bounds[k + 1]))})`);
      steps.push({ sql: op.text, sentence, count: together === null ? undefined : `${rows(together)} out` });
    }
    steps.push(...(await orderAndLimit(sql, body.slice(end), ctx, prefix, span(sql, body), runner, await count(`${prefix}SELECT count(*) FROM (${span(sql, body.slice(0, end))})`))));
    return { steps, note: null };
  }

  const of = (kind: Clause["kind"]) => body.filter((c) => c.kind === kind);
  const select = of("select")[0];
  const from = of("from")[0];
  const joins = of("join");
  const where = of("where")[0];
  const group = of("group")[0];
  const having = of("having")[0];
  const fromText = from ? span(sql, [from, ...joins]) : "";
  let before: number | null = null;

  const aliases = new Map<string, string>();
  const seen = new Set<string>();
  if (from) {
    const items = splitTop(from.tokens.slice(1), (t) => isPunct(t, ","));
    let sentence: string;
    if (isPunct(from.tokens[1], "(")) sentence = "Start with the rows the inner query in brackets returns.";
    else if (items.length > 1) sentence = `Start with every pairing of rows from ${andList(items.map((i) => tableRef(sql, i).name))}.`;
    else {
      const t = tableRef(sql, from.tokens.slice(1));
      const isCte = ctes.some((c) => c.name.toLowerCase() === t.name.toLowerCase());
      sentence = `${isCte ? `Start with ${t.name}, worked out above` : `Start with the ${t.name} table`}${t.alias ? `, called ${t.alias} for short` : ""}.`;
    }
    for (const item of items) {
      const t = tableRef(sql, item);
      aliases.set(t.name.toLowerCase(), t.name);
      if (t.alias) aliases.set(t.alias.toLowerCase(), t.name);
      seen.add(t.name.toLowerCase());
    }
    before = await count(`${prefix}SELECT count(*) ${from.text}`);
    steps.push({ sql: from.text, sentence, count: before === null ? undefined : rows(before) });
  }

  const selectRefs = select ? qualifiedRefs(select.tokens) : [];
  for (const [k, clause] of joins.entries()) {
    const j = parseJoin(sql, clause);
    const n = await count(`${prefix}SELECT count(*) ${span(sql, [from!, ...joins.slice(0, k + 1)])}`);
    const figure = runner ? await matchFigure(runner, opts, { join: j, aliases, selectRefs }) : undefined;
    steps.push({
      sql: clause.text,
      sentence: joinSentence(ctx, j, seen),
      count: n === null ? undefined : before === null ? rows(n) : `${rows(before)} in, ${n} out`,
      ...(figure ? { figure } : {}),
    });
    aliases.set(j.name.toLowerCase(), j.name);
    if (j.alias) aliases.set(j.alias.toLowerCase(), j.name);
    seen.add(j.name.toLowerCase());
    before = n;
  }

  if (where) {
    steps.push(...(await subquerySteps(sql, where, runner, prefix, "WHERE")));
    const n = await count(`${prefix}SELECT count(*) ${fromText} ${where.text}`);
    const figure = runner ? await verdictFigure(runner, prefix, fromText, where, sql) : undefined;
    steps.push({
      sql: where.text,
      sentence: `Keep a row only if ${conditionPhrase(ctx, where.tokens.slice(1))}.`,
      count: n === null ? undefined : before === null ? `${rows(n)} kept` : `${rows(before)} in, ${n} kept, ${before - n} dropped`,
      ...(figure ? { figure } : {}),
    });
    before = n;
  }

  let groups: number | null = null;
  if (group) {
    const keys = splitTop(group.tokens.slice(2), (t) => isPunct(t, ",")).map((p) => textOf(sql, p));
    groups = await count(`${prefix}SELECT count(*) FROM (SELECT 1 ${fromText} ${where?.text ?? ""} ${group.text})`);
    steps.push({
      sql: group.text,
      sentence:
        keys.length === 1
          ? `Gather the rows into groups, one for each different ${keys[0]}.`
          : `Gather the rows into groups, one for each different combination of ${andList(keys)}.`,
      count: groups === null ? undefined : `${before === null ? "" : `${rows(before)} in, `}${plural(groups, "group")}`,
    });
  }

  if (having) {
    steps.push(...(await subquerySteps(sql, having, runner, prefix, "HAVING")));
    const n = await count(`${prefix}SELECT count(*) FROM (SELECT 1 ${fromText} ${where?.text ?? ""} ${group?.text ?? ""} ${having.text})`);
    steps.push({
      sql: having.text,
      sentence: `Keep a group only if ${conditionPhrase({ ...ctx, grouped: true }, having.tokens.slice(1))}.`,
      count: n === null || groups === null ? undefined : `${plural(groups, "group")} in, ${n} kept`,
    });
    groups = n;
  }

  const coreEnd = tail(0);
  const core = span(sql, body.slice(0, coreEnd));
  const out = await count(`${prefix}SELECT count(*) FROM (${core})`);
  if (select) {
    const items = select.tokens.slice(1);
    const distinct = isWord(items[0], "distinct");
    const parts = splitTop(distinct ? items.slice(1) : items, (t) => isPunct(t, ",")).map((p) =>
      selectItemPhrase({ ...ctx, grouped: !!group }, p),
    );
    const sentence = distinct
      ? parts.length === 1 ? `Show each different ${parts[0]} once.` : `Show each different combination of ${andList(parts)} once.`
      : !group && hasAggregate(items) ? `Turn all the rows into one row, showing ${andList(parts)}.`
      : `Show ${andList(parts)}.`;
    const cols = opts.result && !opts.result.error ? `, ${plural(opts.result.columns.length, "column")} each` : "";
    const counted =
      out === null ? undefined
      : group ? `${rows(out)} out, one for each group${cols}`
      : before !== null && before !== out ? `${rows(before)} in, ${out} out${cols}`
      : `${rows(out)} out${cols}`;
    steps.push({ sql: select.text, sentence, count: counted });
  }

  for (const q of of("qualify")) {
    steps.push({ sql: q.text, sentence: `Keep a row only if ${conditionPhrase(ctx, q.tokens.slice(1))}, now that the window columns are worked out.` });
  }

  steps.push(...(await orderAndLimit(sql, body.slice(coreEnd), ctx, prefix, span(sql, body), runner, out)));

  const earlier = body.flatMap((c) => (RUNS_BEFORE_SELECT[c.kind] ? [RUNS_BEFORE_SELECT[c.kind]!] : []));
  const ranFirst = [...new Set(earlier)];
  return {
    steps,
    note: select && ranFirst.length ? `You write SELECT first, but the database runs it after ${andList(ranFirst)}.` : null,
  };
}

async function orderAndLimit(
  sql: string,
  clauses: readonly Clause[],
  ctx: PhraseContext,
  prefix: string,
  whole: string,
  runner: QueryRunner | null,
  before: number | null,
): Promise<ExplainStep[]> {
  const steps: ExplainStep[] = [];
  const order = clauses.find((c) => c.kind === "order");
  if (order) {
    const items = sortItems(ctx, order.tokens.slice(2));
    const first = items[0]!;
    steps.push({
      sql: order.text,
      sentence:
        items.length === 1
          ? `Sort the rows by ${first.phrase}.`
          : `Sort the rows by ${first.phrase}. Rows with the same ${first.expr} are then sorted by ${andList(items.slice(1).map((i) => i.phrase), "then")}.`,
      count: before === null ? undefined : `The same ${rows(before)}, now in order`,
    });
  }
  const cut = clauses.filter((c) => c.kind === "limit" || c.kind === "offset");
  if (cut.length) {
    const value = (kind: Clause["kind"]) => {
      const c = cut.find((x) => x.kind === kind);
      return c ? textOf(sql, c.tokens.slice(1)) : null;
    };
    const limit = value("limit");
    const offset = value("offset");
    const keep = limit === "1" ? "the next row" : `the next ${limit} rows`;
    const n = await countOf(runner, `${prefix}SELECT count(*) FROM (${whole})`);
    steps.push({
      sql: span(sql, cut),
      sentence: offset
        ? `Skip the first ${offset} rows${limit ? `, then keep ${keep}` : ""}.`
        : limit === "1" ? "Keep only the first row." : `Keep only the first ${limit} rows.`,
      count: n === null ? undefined : before === null ? `${rows(n)} kept` : `${rows(before)} in, ${n} kept`,
    });
  }
  return steps;
}

const CONSTRAINT_WORDS = new Set(["primary", "not", "null", "unique", "references", "default", "check", "constraint"]);

function columnDefs(ctx: PhraseContext, ts: Token[]): string[] {
  const sentences: string[] = [];
  const cols: string[] = [];
  for (const def of splitTop(ts, (t) => isPunct(t, ","))) {
    const name = def[0];
    if (!name || ["primary", "foreign", "unique", "check", "constraint"].some((w) => isWord(name, w))) {
      sentences.push(`The table also has a rule: ${textOf(ctx.sql, def)}.`);
      continue;
    }
    const col = unquote(name.text);
    const ruleAt = def.findIndex((t, i) => i > 0 && CONSTRAINT_WORDS.has(t.text.toLowerCase()));
    const type = textOf(ctx.sql, def.slice(1, ruleAt < 0 ? def.length : ruleAt));
    cols.push(type ? `${col} (${type})` : col);
    const rules = ruleAt < 0 ? [] : def.slice(ruleAt);
    const has = (w: string) => rules.some((t) => isWord(t, w));
    if (has("primary")) sentences.push(`${col} must be unique and never empty, so each value names exactly one row.`);
    else if (has("not") && has("null")) sentences.push(`${col} can never be empty.`);
    if (has("unique") && !has("primary")) sentences.push(`No two rows may share a ${col}.`);
    const ref = rules.findIndex((t) => isWord(t, "references"));
    if (ref >= 0) {
      const target = rules[ref + 1]?.text ?? "";
      const open = rules.findIndex((t, i) => i > ref && isPunct(t, "("));
      const key = open > 0 ? textOf(ctx.sql, rules.slice(open + 1, closingBracket(rules, open))) : "its key";
      sentences.push(`Every ${col} must match ${article(key)} that exists in ${target}.`);
    }
    const dflt = rules.findIndex((t) => isWord(t, "default"));
    if (dflt >= 0 && rules[dflt + 1]) sentences.push(`${col} is ${rules[dflt + 1]!.text} when you leave it out.`);
    const check = rules.findIndex((t) => isWord(t, "check"));
    if (check >= 0 && isPunct(rules[check + 1], "(")) {
      const close = closingBracket(rules, check + 1);
      sentences.push(`Every row must pass this test: ${conditionPhrase(ctx, rules.slice(check + 2, close))}.`);
    }
  }
  return [`with ${plural(cols.length, "column")}: ${andList(cols)}.`, ...sentences];
}

/** Statements that change data or describe a query: words only, in written order. */
function explainStatement(sql: string): ExplainStep {
  const ts = lex(sql).filter((t) => !isPunct(t, ";"));
  const ctx: PhraseContext = { sql };
  const d = depths(ts);
  const w = (i: number) => ts[i]?.text.toLowerCase() ?? "";
  const top = (word: string, from = 0) => ts.findIndex((t, i) => i >= from && d[i] === 0 && isWord(t, word));
  const step = (sentence: string): ExplainStep => ({ sql, sentence });
  const cond = (at: number) => conditionPhrase(ctx, ts.slice(at + 1));

  if (w(0) === "explain") {
    return step("Ask DuckDB how it would run the query that follows, without running it. Your result shows its plan instead of rows.");
  }
  if (w(0) === "create") {
    const kindAt = ts.findIndex((t) => ["table", "view", "index"].includes(t.text.toLowerCase()));
    const kind = w(kindAt);
    const name = ts[kindAt + 1] ? unquote(ts[kindAt + 1]!.text) : "";
    const asAt = top("as", kindAt);
    if (kind === "view") {
      return step(`Save the query after AS under the name ${name}. Reading ${name} later runs that query again, so it always shows the current rows.`);
    }
    if (kind === "index") {
      const onAt = top("on");
      const table = ts[onAt + 1]?.text ?? "";
      const open = ts.findIndex((t, i) => i > onAt && isPunct(t, "("));
      const cols = open > 0 ? textOf(sql, ts.slice(open + 1, closingBracket(ts, open))) : "";
      return step(`Build a lookup called ${name} for the ${cols} column of ${table}, so finding ${article(cols)} value does not mean reading every row. The rows themselves do not change.`);
    }
    if (kind === "table" && asAt > 0) {
      return step(`Make a new table called ${name}, filled with the rows the query after AS returns.`);
    }
    if (kind === "table") {
      const open = ts.findIndex((t, i) => i > kindAt && isPunct(t, "("));
      const close = open > 0 ? closingBracket(ts, open) : -1;
      if (close > open) {
        const [first, ...rules] = columnDefs(ctx, ts.slice(open + 1, close));
        return step([`Make a new, empty table called ${name} ${first}`, ...rules].join(" "));
      }
    }
  }
  if (w(0) === "insert") {
    const table = ts[top("into") + 1]?.text ?? "";
    const valuesAt = top("values");
    if (valuesAt < 0) return step(`Add the rows the query returns to ${table}.`);
    const tuples = splitTop(ts.slice(valuesAt + 1), (t) => isPunct(t, ",")).map((p) => textOf(sql, p));
    const shown = tuples.length <= 3 ? `: ${andList(tuples)}` : "";
    return step(`Add ${plural(tuples.length, "new row")} to ${table}${shown}. The rows already there stay as they are.`);
  }
  if (w(0) === "update") {
    const table = ts[1]?.text ?? "";
    const setAt = top("set");
    const whereAt = top("where");
    const assigns = splitTop(ts.slice(setAt + 1, whereAt < 0 ? ts.length : whereAt), (t) => isPunct(t, ",")).map((p) => {
      const eq = p.findIndex((t) => t.kind === "op" && t.text === "=");
      return eq > 0 ? `${textOf(sql, p.slice(0, eq))} to ${textOf(sql, p.slice(eq + 1))}` : textOf(sql, p);
    });
    return step(
      whereAt < 0
        ? `Set ${andList(assigns)} in every row of ${table}. With no WHERE, no row is left out.`
        : `In ${table}, find the rows where ${cond(whereAt)}, and set ${andList(assigns)} in each of them. Every other row stays as it was.`,
    );
  }
  if (w(0) === "delete") {
    const table = ts[top("from") + 1]?.text ?? "";
    const whereAt = top("where");
    return step(
      whereAt < 0
        ? `Remove every row of ${table}. With no WHERE, nothing is left out.`
        : `Remove the rows of ${table} where ${cond(whereAt)}. The other rows stay.`,
    );
  }
  if (w(0) === "drop") return step(`Remove the ${w(1)} ${ts[2]?.text ?? ""} for good.`);
  if (w(0) === "alter") return step(`Change the shape of the ${ts[2]?.text ?? ""} table: ${textOf(sql, ts.slice(3))}.`);
  return step("This statement runs as written.");
}

const isQuery = (sql: string) => /^\s*(\(\s*)*(select|with)\b/i.test(sql);

/** Reads the learner's text back in run order. Never throws: anything unreadable gives no steps. */
export async function explainSql(sql: string, opts: ExplainOptions = {}): Promise<Explanation> {
  try {
    const statements = splitStatements(sql) ?? [{ text: sql.trim(), start: 0 }];
    const only = statements.length === 1 ? statements[0]! : null;
    if (only && isQuery(only.text)) return await explainQuery(only.text, opts);
    const steps: ExplainStep[] = [];
    for (const s of statements) {
      if (isQuery(s.text)) steps.push(...(await explainQuery(s.text, { ...opts, runner: null })).steps);
      else steps.push(explainStatement(s.text));
    }
    return { steps, note: null };
  } catch {
    return { steps: [], note: null };
  }
}
