import { compareResults, runtimeError, type CheckResult, type LessonGoal, type SqlError } from "./check";
import type { QueryResult, QueryRunner } from "./query-runner";
import { friendlyError } from "./sql-guard";

/**
 * The scratch sandbox for lessons that change data (CREATE, INSERT, UPDATE,
 * DELETE, views, indexes). Every run happens inside one transaction that is
 * always rolled back, so each attempt starts from a fresh copy of the data and
 * the shared tables never change.
 */
export interface SandboxSpec {
  /** Trusted statements run first in each attempt, e.g. a table to change. */
  setup?: readonly string[];
  /** Trusted query whose result is shown and compared, e.g. the table afterwards. Omit to compare the last statement's result. */
  check?: string;
  /** The column the ledger shows on each row, e.g. the one the statement changes. */
  focus?: string;
}

export interface Statement {
  text: string;
  /** Offset of `text` in the learner's input. */
  start: number;
}

/** Statements a lesson may run. The sandbox owns the transaction, so no BEGIN, COMMIT or ROLLBACK. */
const ALLOWED_START = new Set(["select", "with", "create", "insert", "update", "delete", "alter", "drop", "explain"]);
const FORBIDDEN = new Set([
  "begin", "commit", "rollback", "abort", "savepoint", "transaction", "attach", "detach", "checkpoint",
  "pragma", "install", "load", "copy", "export", "import", "call", "vacuum",
]);

/**
 * Splits on semicolons outside quotes and comments, keeping each statement's
 * offset. Returns null for an unclosed quote or comment.
 */
export function splitStatements(sql: string): Statement[] | null {
  const out: Statement[] = [];
  let start = 0;
  let i = 0;
  const push = (end: number) => {
    const raw = sql.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text) out.push({ text, start: start + lead });
  };
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) return null;
      i = end + 2;
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) return null;
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) j += 2;
          else break;
        } else j++;
      }
      i = j + 1;
    } else if (ch === ";") {
      push(i);
      start = i + 1;
      i++;
    } else i++;
  }
  push(sql.length);
  return out;
}

/** Words outside quotes and comments, lower-cased. */
function words(text: string): string[] {
  const bare = text
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
  return bare.toLowerCase().match(/[a-z_]+/g) ?? [];
}

export type SandboxGuard = { ok: true; statements: Statement[] } | { ok: false; error: string };

export function guardSandbox(sql: string): SandboxGuard {
  const statements = splitStatements(sql);
  if (statements === null) return { ok: false, error: "There's an unclosed quote or comment in your query." };
  if (statements.length === 0) return { ok: false, error: "Write a statement to run." };
  for (const s of statements) {
    const w = words(s.text);
    const first = w[0] ?? "";
    if (!ALLOWED_START.has(first)) {
      return {
        ok: false,
        error: `Statements here start with CREATE, INSERT, UPDATE, DELETE, ALTER, DROP, SELECT or EXPLAIN, not ${first.toUpperCase() || "that"}.`,
      };
    }
    const bad = w.find((x) => FORBIDDEN.has(x));
    if (bad) {
      return { ok: false, error: `"${bad.toUpperCase()}" isn't needed here: every run already starts from a fresh copy of the data.` };
    }
  }
  return { ok: true, statements };
}

export type SandboxRun =
  | { ok: true; result: QueryResult }
  | { ok: false; error: string; statement: Statement };

/** Runs a sandbox attempt; in the browser this holds the connection for the whole transaction. */
export type SandboxExec = (spec: SandboxSpec, statements: readonly Statement[]) => Promise<SandboxRun>;

/** Runs setup, the statements and the check inside a transaction that is always rolled back. */
export async function runInSandbox(
  runner: QueryRunner,
  spec: SandboxSpec,
  statements: readonly Statement[],
): Promise<SandboxRun> {
  await runner.run("ROLLBACK"); // a no-op unless an earlier run was cut short
  const begun = await runner.run("BEGIN TRANSACTION");
  if (begun.error) throw new Error(`The sandbox could not start: ${begun.error}`);
  try {
    for (const s of spec.setup ?? []) {
      const r = await runner.run(s);
      if (r.error) throw new Error(`Sandbox setup failed: ${r.error}`);
    }
    let last: QueryResult = { columns: [], rows: [], ms: 0 };
    for (const s of statements) {
      const r = await runner.run(s.text);
      if (r.error) return { ok: false, error: r.error, statement: s };
      last = r;
    }
    return { ok: true, result: spec.check ? await runner.run(spec.check) : last };
  } finally {
    await runner.run("ROLLBACK");
  }
}

/** A DuckDB error from one statement, with its position mapped back into the learner's whole text. */
export function sandboxError(sql: string, failed: Extract<SandboxRun, { ok: false }>): SqlError {
  const local = runtimeError(failed.statement.text, failed.error);
  return {
    ...local,
    ...(local.position !== undefined ? { position: failed.statement.start + local.position } : {}),
  };
}

const EXPLAIN = /^\s*explain\s+(?:analyze\s+)?/i;

export interface SandboxLesson {
  goal: LessonGoal;
  hints?: readonly string[];
  sandbox: SandboxSpec;
}

export type SandboxCheck = CheckResult & { error?: SqlError };

/**
 * Checks a sandbox lesson by its RESULT: the learner's statements and the
 * reference run on fresh copies and the check query's output is compared.
 * "explain" lessons compare the query being explained and show the plan.
 */
export async function checkSandboxAnswer(sql: string, lesson: SandboxLesson, exec: SandboxExec): Promise<SandboxCheck> {
  const empty: QueryResult = { columns: [], rows: [], ms: 0 };
  const guard = guardSandbox(sql);
  if (!guard.ok) return { ok: false, reason: "error", hint: guard.error, learner: { ...empty, error: guard.error } };
  const reference = guardSandbox(lesson.goal.referenceSql);
  if (!reference.ok) throw new Error(`Reference is not allowed in the sandbox: ${reference.error}`);

  if (lesson.goal.compare === "explain") {
    const [only] = guard.statements;
    if (guard.statements.length !== 1 || !only || !EXPLAIN.test(only.text)) {
      const ran = await exec(lesson.sandbox, guard.statements);
      const learner = ran.ok ? ran.result : { ...empty, error: friendlyError(ran.error) };
      return {
        ok: false,
        reason: "not explained",
        hint: "Put EXPLAIN in front of the query, so DuckDB shows its plan instead of the rows.",
        learner,
        ...(ran.ok ? {} : { error: sandboxError(sql, ran) }),
      };
    }
    const shown = await exec(lesson.sandbox, [only]);
    if (!shown.ok) return failed(sql, shown);
    const inner = (s: Statement): Statement => {
      const cut = s.text.match(EXPLAIN)?.[0].length ?? 0;
      return { text: s.text.slice(cut), start: s.start + cut };
    };
    const theirs = await exec({}, [inner(only)]);
    if (!theirs.ok) return failed(sql, theirs);
    const ours = await exec({}, reference.statements.map(inner));
    if (!ours.ok) throw new Error(`Reference failed in the sandbox: ${ours.error}`);
    const compared = compareResults(sql, theirs.result, ours.result, lesson);
    return { ...compared, learner: shown.result };
  }

  const theirs = await exec(lesson.sandbox, guard.statements);
  if (!theirs.ok) return failed(sql, theirs);
  const ours = await exec(lesson.sandbox, reference.statements);
  if (!ours.ok) throw new Error(`Reference failed in the sandbox: ${ours.error}`);
  if (ours.result.error) throw new Error(`Sandbox check failed: ${ours.result.error}`);
  if (theirs.result.error) {
    // The statements ran, but what the lesson checks is not there (e.g. the table was never created).
    return { ok: false, reason: "error", hint: friendlyError(theirs.result.error), learner: { ...theirs.result, error: friendlyError(theirs.result.error) } };
  }
  return compareResults(sql, theirs.result, ours.result, lesson);
}

function failed(sql: string, run: Extract<SandboxRun, { ok: false }>): SandboxCheck {
  const hint = friendlyError(run.error);
  return { ok: false, reason: "error", hint, learner: { columns: [], rows: [], ms: 0, error: hint }, error: sandboxError(sql, run) };
}
