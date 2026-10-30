import type { QueryRunner } from "../query-runner";
import { quoteIdent } from "../sql";
import { guardReadOnly } from "../sql-guard";
import type { RowId, Step, Trace } from "../trace";

export const FILTER_OPERATORS = [">", ">=", "<", "<=", "=", "!="] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const SIMPLIFIED_LABEL = "Simplified view: this query is more than the animation can follow yet";

export interface StageRow {
  rid: RowId;
  cells: unknown[];
}

/**
 * animated: a step-by-step scan built from the learner's own WHERE.
 * simplified: a static before/after (verdicts only when the real row ids are known).
 * idle: the table before anything has run.
 */
export type SceneMode = "animated" | "simplified" | "idle";

export interface FilterScene {
  mode: SceneMode;
  /** The learner's text this scene was built from ("" when idle). */
  sql: string;
  table: { name: string; columns: string[]; rows: StageRow[] };
  trace: Trace;
  /** The column the condition looks at, shown on every ledger line. */
  focusColumn: string | null;
  /** Numbers the condition compares against; rows equal to one get a margin note. */
  boundaryValues: number[];
  /** Simplified only: kept and dropped verdicts are known from real row ids. */
  verdicts: boolean;
  /** Shown above the ledger when it is not a full animation. */
  banner: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// The AST, as produced by DuckDB's json_serialize_sql
// ---------------------------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObject = (v: Json | undefined): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);
const clone = <T extends Json>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function sqlString(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

async function serialize(parser: QueryRunner, sql: string): Promise<JsonObject | null> {
  const res = await parser.run(`SELECT json_serialize_sql(${sqlString(sql)})`);
  if (res.error) return null;
  try {
    const parsed = JSON.parse(String(res.rows[0]?.[0] ?? "null")) as Json;
    return isObject(parsed) && parsed.error === false ? parsed : null;
  } catch {
    return null;
  }
}

/** AST back to SQL. The only way instrumented SQL is ever produced. */
async function deserialize(parser: QueryRunner, ast: JsonObject): Promise<string | null> {
  const res = await parser.run(`SELECT json_deserialize_sql(${sqlString(JSON.stringify(ast))})`);
  const text = res.rows[0]?.[0];
  return res.error || typeof text !== "string" ? null : text;
}

function selectNode(ast: JsonObject): JsonObject | null {
  const statements = ast.statements;
  if (!Array.isArray(statements) || statements.length !== 1) return null;
  const first = statements[0];
  const node = isObject(first) ? first.node : null;
  return isObject(node) && node.type === "SELECT_NODE" ? node : null;
}

/** Wraps a modified SELECT node back into a full serialized document. */
function withNode(ast: JsonObject, node: JsonObject): JsonObject {
  const copy = clone(ast);
  const statements = copy.statements;
  if (Array.isArray(statements) && isObject(statements[0])) statements[0].node = node;
  return copy;
}

function walk(v: Json | undefined, visit: (o: JsonObject) => void): void {
  if (Array.isArray(v)) v.forEach((x) => walk(x, visit));
  else if (isObject(v)) {
    visit(v);
    Object.values(v).forEach((x) => walk(x, visit));
  }
}

function columnName(expr: Json | undefined): string | null {
  if (!isObject(expr) || expr.class !== "COLUMN_REF" || !Array.isArray(expr.column_names)) return null;
  const last = expr.column_names[expr.column_names.length - 1];
  return typeof last === "string" ? last : null;
}

function numberConstant(expr: Json | undefined): number | null {
  if (!isObject(expr) || expr.class !== "CONSTANT" || !isObject(expr.literal)) return null;
  const n = Number(expr.literal.text);
  return typeof expr.literal.text === "string" && Number.isFinite(n) ? n : null;
}

const COMPARISONS: Record<string, FilterOperator> = {
  COMPARE_GREATERTHAN: ">",
  COMPARE_GREATERTHANOREQUALTO: ">=",
  COMPARE_LESSTHAN: "<",
  COMPARE_LESSTHANOREQUALTO: "<=",
  COMPARE_EQUAL: "=",
  COMPARE_NOTEQUAL: "!=",
};
const FLIPPED: Record<FilterOperator, FilterOperator> = { ">": "<", ">=": "<=", "<": ">", "<=": ">=", "=": "=", "!=": "!=" };

/** A simple test the narration can explain at its boundary, column on the left. */
type SimpleTest =
  | { kind: "compare"; column: string; op: FilterOperator; value: number }
  | { kind: "between"; column: string; low: number; high: number };

function simpleTest(expr: Json | undefined): SimpleTest | null {
  if (!isObject(expr)) return null;
  if (expr.class === "COMPARISON" && typeof expr.type === "string" && COMPARISONS[expr.type]) {
    const op = COMPARISONS[expr.type]!;
    const lc = columnName(expr.left);
    const rv = numberConstant(expr.right);
    if (lc && rv !== null) return { kind: "compare", column: lc, op, value: rv };
    // Reversed, e.g. 50 < amount: read it as amount > 50.
    const rc = columnName(expr.right);
    const lv = numberConstant(expr.left);
    if (rc && lv !== null) return { kind: "compare", column: rc, op: FLIPPED[op], value: lv };
  }
  if (expr.class === "BETWEEN") {
    const column = columnName(expr.input);
    const low = numberConstant(expr.lower);
    const high = numberConstant(expr.upper);
    if (column && low !== null && high !== null) return { kind: "between", column, low, high };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

export function formatNumber(n: number): string {
  return String(n);
}

const OPERATOR_PHRASE: Record<FilterOperator, { yes: string; no: string }> = {
  ">": { yes: "is greater than", no: "is not greater than" },
  ">=": { yes: "is greater than or equal to", no: "is not greater than or equal to" },
  "<": { yes: "is less than", no: "is not less than" },
  "<=": { yes: "is less than or equal to", no: "is not less than or equal to" },
  "=": { yes: "equals", no: "does not equal" },
  "!=": { yes: "is not equal to", no: "is equal to" },
};

/** e.g. "50 is not greater than 50, so this row is dropped". */
export function boundaryNarration(op: FilterOperator, value: number, kept: boolean): string {
  const phrase = OPERATOR_PHRASE[op][kept ? "yes" : "no"];
  const v = formatNumber(value);
  return `${v} ${phrase} ${v}, so this row is ${kept ? "kept" : "dropped"}`;
}

function boundaryLine(test: SimpleTest, value: unknown, kept: boolean): string | null {
  if (typeof value !== "number") return null;
  if (test.kind === "compare") return value === test.value ? boundaryNarration(test.op, value, kept) : null;
  if (value !== test.low && value !== test.high) return null;
  return kept
    ? `${formatNumber(value)} counts as between ${formatNumber(test.low)} and ${formatNumber(test.high)}, because BETWEEN includes both ends, so this row is kept`
    : `${formatNumber(value)} is at the edge of BETWEEN ${formatNumber(test.low)} AND ${formatNumber(test.high)}, but the whole condition is false, so this row is dropped`;
}

function listRows(positions: number[]): string {
  if (positions.length === 1) return `row ${positions[0]}`;
  return `rows ${positions.slice(0, -1).join(", ")} and ${positions[positions.length - 1]}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export interface Check {
  rid: RowId;
  keep: boolean;
}

/** The step-by-step scan of a WHERE, in batches. Pure; the landing page reuses it for its example. */
export function scanSteps(
  table: string,
  checks: Check[],
  condition: string | null,
  boundary: (rid: RowId, kept: boolean) => string | null,
): Step[] {
  const steps: Step[] = [{ id: "start", narration: `Start with every row in ${table}`, ops: [] }];
  const position = new Map(checks.map((c, i) => [c.rid, i + 1]));
  const pos = (rid: RowId) => position.get(rid) ?? 0;

  if (condition === null) {
    steps.push({
      id: "no-where",
      narration: "There is no WHERE, so there is nothing to check: every row stays",
      ops: [{ type: "highlight", verdict: "pass", rowIds: checks.map((c) => c.rid) }],
    });
  } else {
    for (let start = 0; start < checks.length; start += BATCH_SIZE) {
      const batch = checks.slice(start, start + BATCH_SIZE);
      const from = start + 1;
      const to = start + batch.length;
      steps.push({
        id: `check-${from}`,
        narration: `Checking ${condition} on ${from === to ? `row ${from}` : `rows ${from} to ${to}`}`,
        ops: [{ type: "highlight", rowIds: batch.map((c) => c.rid) }],
      });
      const passed = batch.filter((c) => c.keep);
      const failed = batch.filter((c) => !c.keep);
      const parts: string[] = [];
      if (passed.length) parts.push(`${listRows(passed.map((c) => pos(c.rid)))} ${plural(passed.length, "passes", "pass")}`);
      if (failed.length) parts.push(`${listRows(failed.map((c) => pos(c.rid)))} ${plural(failed.length, "fails", "fail")}`);
      const notes = batch.flatMap((c) => {
        const line = boundary(c.rid, c.keep);
        return line ? [`Row ${pos(c.rid)}: ${line}.`] : [];
      });
      const ops: Step["ops"] = [];
      if (passed.length) ops.push({ type: "highlight", verdict: "pass", rowIds: passed.map((c) => c.rid) });
      if (failed.length) ops.push({ type: "dim", rowIds: failed.map((c) => c.rid) });
      steps.push({ id: `verdict-${from}`, narration: [capitalise(parts.join("; ")) + ".", ...notes].join(" "), ops });
    }
  }

  const kept = checks.filter((c) => c.keep).map((c) => c.rid);
  const dropped = checks.filter((c) => !c.keep).map((c) => c.rid);
  steps.push({
    id: "remove",
    narration: dropped.length
      ? `Drop the ${dropped.length} ${plural(dropped.length, "row", "rows")} that failed the test`
      : "No rows failed, so nothing is dropped",
    ops: dropped.length ? [{ type: "remove", rowIds: dropped }] : [],
  });
  steps.push({
    id: "emit",
    narration: kept.length
      ? kept.length === 1
        ? "This 1 row passed the test"
        : `These ${kept.length} rows passed the test`
      : "No rows passed, so the result is empty",
    ops: kept.length ? [{ type: "emit", rowIds: kept }] : [],
  });
  return steps;
}

// ---------------------------------------------------------------------------
// Building scenes
// ---------------------------------------------------------------------------

function normCell(v: unknown): string {
  if (typeof v === "number") return `n:${Math.round(v * 1e9) / 1e9}`;
  if (v === null || v === undefined) return "null";
  return `s:${String(v)}`;
}
const rowKey = (row: unknown[]) => JSON.stringify(row.map(normCell));

function sameRows(a: unknown[][], b: unknown[][]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(rowKey).sort();
  const right = b.map(rowKey).sort();
  return left.every((k, i) => k === right[i]);
}

async function sourceTable(runner: QueryRunner, name: string): Promise<Result<FilterScene["table"]>> {
  const res = await runner.run(`SELECT rowid AS rid, * FROM ${quoteIdent(name)} ORDER BY rowid`);
  if (res.error) return { ok: false, error: res.error };
  return {
    ok: true,
    value: {
      name,
      columns: res.columns.slice(1),
      rows: res.rows.map(([rid, ...cells]) => ({ rid: rid as RowId, cells })),
    },
  };
}

function matchColumn(columns: string[], name: string | null): string | null {
  if (!name) return null;
  return columns.find((c) => c.toLowerCase() === name.toLowerCase()) ?? null;
}

/** The table before anything has run. */
export async function idleScene(
  runner: QueryRunner,
  tableName: string,
  focusColumn: string | null = null,
): Promise<Result<FilterScene>> {
  const table = await sourceTable(runner, tableName);
  if (!table.ok) return table;
  return {
    ok: true,
    value: {
      mode: "idle",
      sql: "",
      table: table.value,
      trace: { steps: [{ id: "start", narration: `Start with every row in ${tableName}`, ops: [] }], resultColumns: table.value.columns, resultRowIds: [] },
      focusColumn: matchColumn(table.value.columns, focusColumn),
      boundaryValues: [],
      verdicts: false,
      banner: null,
    },
  };
}

/** Sandbox lessons: the ledger shows a table as it is (before a run, or afterwards), with no verdicts. */
export const CHANGED_LABEL = "This statement changes data, so the ledger shows the table afterwards, not a step-by-step animation";

export function tableScene(
  name: string,
  sql: string,
  result: { columns: string[]; rows: unknown[][] },
  narration: string,
  banner: string | null,
  focus: string | null = null,
): FilterScene {
  return {
    mode: sql ? "simplified" : "idle",
    sql,
    table: { name, columns: result.columns, rows: result.rows.map((cells, i) => ({ rid: i, cells })) },
    trace: { steps: [{ id: "table", narration, ops: [] }], resultColumns: result.columns, resultRowIds: [] },
    focusColumn: focus && result.columns.includes(focus) ? focus : null,
    boundaryValues: [],
    verdicts: false,
    banner,
  };
}

/** Before any query has run: the same table, no verdicts, focus kept. */
export function asIdle(scene: FilterScene): FilterScene {
  return {
    ...scene,
    mode: "idle",
    sql: "",
    trace: { steps: [{ id: "start", narration: `Start with every row in ${scene.table.name}`, ops: [] }], resultColumns: scene.table.columns, resultRowIds: [] },
    boundaryValues: [],
    verdicts: false,
    banner: null,
  };
}

/** The checker did not load, so the learner's query cannot be read: say so. */
export const CHECKER_OFF_LABEL = "Simplified view: the checker did not load, so the animation is off";

export function checkerOffScene(idle: FilterScene, sql: string): FilterScene {
  return {
    ...asIdle(idle),
    mode: "simplified",
    sql,
    trace: { steps: [{ id: "simplified", narration: `${CHECKER_OFF_LABEL}. Your real result is below the ledger.`, ops: [] }], resultColumns: [], resultRowIds: [] },
    banner: CHECKER_OFF_LABEL,
  };
}

function simplified(
  sql: string,
  table: FilterScene["table"],
  focusColumn: string | null,
  boundaryValues: number[],
  ids: RowId[] | null,
  resultColumns: string[],
): FilterScene {
  const kept = new Set(ids ?? []);
  const step: Step = ids
    ? {
        id: "simplified",
        narration: `${SIMPLIFIED_LABEL}. ${kept.size} of ${table.rows.length} rows are in your result.`,
        ops: [
          ...(kept.size ? [{ type: "emit" as const, rowIds: [...kept] }] : []),
          { type: "dim" as const, rowIds: table.rows.map((r) => r.rid).filter((rid) => !kept.has(rid)) },
        ],
      }
    : { id: "simplified", narration: `${SIMPLIFIED_LABEL}. Your real result is below the ledger.`, ops: [] };
  return {
    mode: "simplified",
    sql,
    table,
    trace: { steps: [step], resultColumns, resultRowIds: ids ? [...kept].sort((a, b) => a - b) : [] },
    focusColumn,
    boundaryValues,
    verdicts: ids !== null,
    banner: SIMPLIFIED_LABEL,
  };
}

export interface LearnerSceneOptions {
  /** Runs json_serialize_sql and json_deserialize_sql (the checker). */
  parser: QueryRunner;
  /** The sandboxed database the learner's data lives in. */
  runner: QueryRunner;
  /** Tables the scene may show (the dataset's). */
  tables: readonly string[];
  /** Table to show when the query has no single base table. */
  fallbackTable: string;
}

/**
 * Builds the ledger from the learner's own SQL. The AST is read with
 * json_serialize_sql and modified (never string-concatenated), then turned
 * back into SQL with json_deserialize_sql:
 *
 *  - projection: SELECT rowid AS _rid, <their select list> ... (their WHERE,
 *    ORDER BY and LIMIT kept). Its rows must equal their real result, which
 *    proves the ids are the real result's row ids.
 *  - scan: SELECT rowid AS _rid, (<their WHERE>) AS keep FROM <their table>.
 *    Its kept ids must equal the projection's ids, or the animation would
 *    disagree with the result, so the simplified view is shown instead.
 */
export async function buildLearnerScene(sql: string, opts: LearnerSceneOptions): Promise<Result<FilterScene>> {
  const { parser, runner } = opts;
  const guard = guardReadOnly(sql);
  if (!guard.ok) return { ok: false, error: guard.error };
  const real = await runner.run(guard.sql);
  if (real.error) return { ok: false, error: real.error };

  const ast = await serialize(parser, sql);
  const node = ast ? selectNode(ast) : null;
  const from = node?.from_table;
  const baseName = isObject(from) && from.type === "BASE_TABLE" && typeof from.table_name === "string" ? from.table_name : null;
  const known = opts.tables.find((t) => t.toLowerCase() === baseName?.toLowerCase()) ?? null;

  // Pick the table to draw: theirs if it is a single known table.
  const table = await sourceTable(runner, known ?? opts.fallbackTable);
  if (!table.ok) return table;
  const columns = table.value.columns;

  const where = node?.where_clause ?? null;
  const test = simpleTest(where ?? undefined);
  let focusName: string | null = test?.column ?? null;
  const boundaryValues: number[] = [];
  walk(where ?? undefined, (o) => {
    const t = simpleTest(o);
    if (!t) return;
    focusName ??= t.column;
    if (t.column.toLowerCase() === focusName.toLowerCase()) {
      boundaryValues.push(...(t.kind === "compare" ? [t.value] : [t.low, t.high]));
    }
  });
  if (!focusName) walk(where ?? undefined, (o) => (focusName ??= columnName(o)));
  const focusColumn = matchColumn(columns, focusName);
  const cteMap = node?.cte_map;
  const hasCtes = isObject(cteMap) && Array.isArray(cteMap.map) && cteMap.map.length > 0;

  if (!ast || !node || !known || hasCtes) {
    return { ok: true, value: simplified(sql, table.value, focusColumn, boundaryValues, null, real.columns) };
  }

  // Templates for "rowid AS _rid" and "TRUE AS keep", taken from DuckDB itself.
  const template = await serialize(parser, "SELECT rowid AS _rid, TRUE AS keep");
  const templateList = template ? selectNode(template)?.select_list : null;
  if (!Array.isArray(templateList) || !isObject(templateList[0]) || !isObject(templateList[1])) {
    return { ok: true, value: simplified(sql, table.value, focusColumn, boundaryValues, null, real.columns) };
  }
  const ridExpr = templateList[0];
  const trueExpr = templateList[1];

  // Projection: the real result's row ids.
  const projection = clone(node);
  const selectList = Array.isArray(node.select_list) ? node.select_list : [];
  projection.select_list = [ridExpr, ...selectList];
  const projectionSql = await deserialize(parser, withNode(ast, projection));
  const projected = projectionSql ? await runner.run(projectionSql) : null;
  if (!projected || projected.error || !sameRows(projected.rows.map((r) => r.slice(1)), real.rows)) {
    return { ok: true, value: simplified(sql, table.value, focusColumn, boundaryValues, null, real.columns) };
  }
  const ids = projected.rows.map((r) => r[0] as RowId);
  if (new Set(ids).size !== ids.length) {
    return { ok: true, value: simplified(sql, table.value, focusColumn, boundaryValues, null, real.columns) };
  }

  // Scan: every row of the table with its verdict.
  const scan = clone(node);
  const keepExpr = isObject(where) ? { ...clone(where), alias: "keep" } : trueExpr;
  scan.select_list = [ridExpr, keepExpr];
  scan.where_clause = null;
  scan.modifiers = [];
  const scanSql = await deserialize(parser, withNode(ast, scan));
  const scanned = scanSql ? await runner.run(scanSql) : null;
  const realIds = new Set(ids);
  const checks: Check[] = (scanned?.rows ?? [])
    .map(([rid, keep]) => ({ rid: rid as RowId, keep: keep === true }))
    .sort((a, b) => a.rid - b.rid);
  const scanIds = checks.filter((c) => c.keep).map((c) => c.rid);
  const agrees =
    !!scanned && !scanned.error && checks.length === table.value.rows.length &&
    scanIds.length === realIds.size && scanIds.every((rid) => realIds.has(rid));
  if (!agrees) {
    // e.g. LIMIT or DISTINCT: the real ids are known, but a row-by-row scan
    // of WHERE would not explain them.
    return { ok: true, value: simplified(sql, table.value, focusColumn, boundaryValues, ids, real.columns) };
  }

  // The condition in DuckDB's own words, for "Checking amount > 50 on rows 1 to 5".
  let condition: string | null = null;
  if (isObject(where)) {
    const display = clone(node);
    display.select_list = [{ ...clone(where), alias: "__cond__" }];
    display.where_clause = null;
    display.modifiers = [];
    const text = await deserialize(parser, withNode(ast, display));
    const m = text ? /^SELECT (.*) AS __cond__ FROM /s.exec(text) : null;
    condition = m?.[1] ? stripOuterParens(m[1]) : "the WHERE condition";
  }

  const values = new Map(table.value.rows.map((r) => [r.rid, r.cells]));
  const focusIndex = focusColumn ? columns.indexOf(focusColumn) : -1;
  const boundary = (rid: RowId, kept: boolean) =>
    test && focusIndex >= 0 && test.column.toLowerCase() === focusColumn?.toLowerCase()
      ? boundaryLine(test, values.get(rid)?.[focusIndex], kept)
      : null;

  return {
    ok: true,
    value: {
      mode: "animated",
      sql,
      table: table.value,
      trace: {
        steps: scanSteps(table.value.name, checks, condition, boundary),
        resultColumns: real.columns,
        resultRowIds: scanIds,
      },
      focusColumn,
      boundaryValues,
      verdicts: true,
      banner: null,
    },
  };
}

function stripOuterParens(s: string): string {
  const t = s.trim();
  if (!t.startsWith("(") || !t.endsWith(")")) return t;
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "(") depth++;
    else if (t[i] === ")") depth--;
    if (depth === 0 && i < t.length - 1) return t; // the first paren closes early
  }
  return t.slice(1, -1).trim();
}
