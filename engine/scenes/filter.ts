import type { QueryRunner } from "../query-runner";
import { quoteIdent, sqlLiteral } from "../sql";
import type { RowId, Step, Trace } from "../trace";

export const FILTER_OPERATORS = [">", ">=", "<", "<=", "=", "!="] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export interface FilterSlots {
  column: string;
  operator: string;
  threshold: string | number;
}

export interface FilterSpec {
  table: string;
  column: string;
  operator: FilterOperator;
  threshold: number;
}

export interface StageRow {
  rid: RowId;
  cells: unknown[];
}

export interface FilterScene {
  spec: FilterSpec;
  trace: Trace;
  /** Every source row, in rowid order, for drawing the stage. */
  table: { columns: string[]; rows: StageRow[] };
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const BATCH_SIZE = 5;

function isOperator(op: string): op is FilterOperator {
  return (FILTER_OPERATORS as readonly string[]).includes(op);
}

/**
 * Validates raw slot input against allowlists. Only the returned spec is ever
 * spliced into SQL, never the raw strings.
 */
export function validateFilterSlots(
  table: string,
  slots: FilterSlots,
  allowedColumns: readonly string[],
): Result<FilterSpec> {
  if (!allowedColumns.includes(slots.column)) {
    return { ok: false, error: `Pick one of: ${allowedColumns.join(", ")}.` };
  }
  if (!isOperator(slots.operator)) {
    return { ok: false, error: `Pick an operator: ${FILTER_OPERATORS.join(" ")}.` };
  }
  const raw = typeof slots.threshold === "number" ? slots.threshold : slots.threshold.trim();
  const threshold = typeof raw === "number" ? raw : raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(threshold)) {
    return { ok: false, error: "The threshold needs to be a number." };
  }
  return { ok: true, value: { table, column: slots.column, operator: slots.operator, threshold } };
}

export function formatNumber(n: number): string {
  return String(n);
}

function predicateSql(spec: FilterSpec): string {
  return `${quoteIdent(spec.column)} ${spec.operator} ${sqlLiteral(spec.threshold)}`;
}

/** The learner-facing query, rebuilt from validated slots. */
export function filterQuerySql(spec: FilterSpec): string {
  return `SELECT * FROM ${spec.table} WHERE ${spec.column} ${spec.operator} ${formatNumber(spec.threshold)}`;
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

function listRows(positions: number[]): string {
  if (positions.length === 1) return `row ${positions[0]}`;
  const head = positions.slice(0, -1).join(", ");
  return `rows ${head} and ${positions[positions.length - 1]}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Builds the Filter trace from the real execution of an instrumented query:
 * DuckDB decides `keep` for every row; this function only narrates it.
 */
export async function buildFilterScene(
  runner: QueryRunner,
  spec: FilterSpec,
): Promise<Result<FilterScene>> {
  const table = quoteIdent(spec.table);
  const instrumented = await runner.run(
    `SELECT rowid AS rid, ${quoteIdent(spec.column)} AS v, (${predicateSql(spec)}) AS keep FROM ${table} ORDER BY rowid`,
  );
  if (instrumented.error) return { ok: false, error: instrumented.error };
  const source = await runner.run(`SELECT rowid AS rid, * FROM ${table} ORDER BY rowid`);
  if (source.error) return { ok: false, error: source.error };

  const checks = instrumented.rows.map(([rid, v, keep]) => ({
    rid: rid as RowId,
    value: v,
    // NULL comparisons are not true, so the row is dropped, exactly like WHERE.
    keep: keep === true,
  }));
  const allIds = checks.map((c) => c.rid);
  const cond = `${spec.column} ${spec.operator} ${formatNumber(spec.threshold)}`;
  const steps: Step[] = [
    { id: "start", narration: `Start with every row in ${spec.table}`, ops: [] },
  ];

  for (let start = 0; start < checks.length; start += BATCH_SIZE) {
    const batch = checks.slice(start, start + BATCH_SIZE);
    const from = start + 1;
    const to = start + batch.length;
    const range = from === to ? `row ${from}` : `rows ${from} to ${to}`;
    const ids = batch.map((c) => c.rid);
    steps.push({
      id: `check-${from}`,
      narration: `Checking ${cond} on ${range}`,
      ops: [{ type: "highlight", rowIds: ids, column: spec.column }],
    });

    const passed = batch.filter((c) => c.keep);
    const failed = batch.filter((c) => !c.keep);
    const pos = (rid: RowId) => allIds.indexOf(rid) + 1;
    const parts: string[] = [];
    if (passed.length) parts.push(`${listRows(passed.map((c) => pos(c.rid)))} ${plural(passed.length, "passes", "pass")}`);
    if (failed.length) parts.push(`${listRows(failed.map((c) => pos(c.rid)))} ${plural(failed.length, "fails", "fail")}`);
    const boundary = batch
      .filter((c) => c.value === spec.threshold)
      .map((c) => `Row ${pos(c.rid)}: ${boundaryNarration(spec.operator, spec.threshold, c.keep)}.`);
    const verdictOps: Step["ops"] = [];
    if (passed.length) {
      verdictOps.push({ type: "highlight", verdict: "pass", rowIds: passed.map((c) => c.rid), column: spec.column });
    }
    if (failed.length) {
      verdictOps.push({ type: "dim", rowIds: failed.map((c) => c.rid), column: spec.column });
    }
    steps.push({
      id: `verdict-${from}`,
      narration: [capitalise(parts.join("; ")) + ".", ...boundary].join(" "),
      ops: verdictOps,
    });
  }

  const keptIds = checks.filter((c) => c.keep).map((c) => c.rid);
  const droppedIds = checks.filter((c) => !c.keep).map((c) => c.rid);
  steps.push({
    id: "remove",
    narration: droppedIds.length
      ? `Drop the ${droppedIds.length} ${plural(droppedIds.length, "row", "rows")} that failed the filter`
      : "No rows failed, so nothing is dropped",
    ops: droppedIds.length ? [{ type: "remove", rowIds: droppedIds }] : [],
  });
  steps.push({
    id: "emit",
    narration: keptIds.length
      ? keptIds.length === 1
        ? "This 1 row passed the filter"
        : `These ${keptIds.length} rows passed the filter`
      : "No rows passed the filter, so the result is empty",
    ops: keptIds.length ? [{ type: "emit", rowIds: keptIds }] : [],
  });

  const columns = source.columns.slice(1);
  return {
    ok: true,
    value: {
      spec,
      trace: { steps, resultColumns: columns, resultRowIds: keptIds },
      table: {
        columns,
        rows: source.rows.map(([rid, ...cells]) => ({ rid: rid as RowId, cells })),
      },
    },
  };
}
