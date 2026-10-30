import { create } from "zustand";
import { datasets } from "@/content/datasets";
import { datasetIdentifiers } from "@/content/datasets/types";
import type { LessonDefinition } from "@/content/lessons/types";
import { checkAnswer, diagnose, parseCheck, runtimeError, type CheckReason, type Diagnosis } from "@/engine/check";
import { lex } from "@/engine/lex";
import type { QueryRunner } from "@/engine/query-runner";
import { explainSql, type Explanation } from "@/engine/explain";
import { formatSql } from "@/engine/format";
import { checkSandboxAnswer } from "@/engine/sandbox";
import { asIdle, buildLearnerScene, CHANGED_LABEL, checkerOffScene, idleScene, tableScene, type FilterScene } from "@/engine/scenes/filter";
import { quoteIdent } from "@/engine/sql";
import { friendlyError } from "@/engine/sql-guard";
import { checkerRunner, engineRunner, loadDataset, prepareChecker, readOnlyRunner, sandboxExec, type RunQueryResult } from "@/lib/engine/db";
import { completionFor, nextHintCount, type Completion } from "@/lib/lesson-status";
import { whenProgressReady } from "@/store/progress";

export type Status = "booting" | "preparing-checker" | "ready" | "running" | "error";

export type Outcome =
  | { kind: "idle" }
  | { kind: "diagnostic"; diagnosis: Diagnosis }
  | { kind: "wrong"; reason: CheckReason; hint: string }
  | { kind: "approved" }
  /** Our side failed (e.g. the checker could not run), not the learner's query. */
  | { kind: "system"; message: string };

interface LessonState {
  lesson: LessonDefinition | null;
  sql: string;
  status: Status;
  /** Boot failure only; query problems live in `outcome`. */
  fatal: string | null;
  /**
   * json_serialize_sql loaded. When false (e.g. offline), syntax errors are
   * found by running the query instead; DuckDB's caret still points at them.
   */
  checkerReady: boolean;
  outcome: Outcome;
  /** Counts failed runs, so the shake replays each time. */
  attempt: number;
  /** The text of the last run; differs from `sql` once the learner edits. */
  lastRunSql: string | null;
  /** How many of the lesson's hints the learner has asked for. */
  hintsShown: number;
  /** The learner chose "Show the answer". */
  answerShown: boolean;
  /** Set on approval: mastered, or revealed if the answer had been shown. */
  completion: Completion | null;
  /** The ledger: built from the learner's own last query once one has run. */
  scene: FilterScene | null;
  /** The table before anything ran (also the base for the checker-off view). */
  idle: FilterScene | null;
  /** The learner's own rows from DuckDB, whenever their query ran. */
  result: RunQueryResult | null;
  /** "Read it": the last query that ran, read back in run order. */
  explained: { sql: string; explanation: Explanation } | null;
  open: (lesson: LessonDefinition) => Promise<void>;
  setSql: (sql: string) => void;
  startOver: () => void;
  run: () => Promise<Outcome>;
  showHint: () => void;
  showAnswer: () => void;
  /** Do it again: the starter slip back, the verdicts cleared. The lesson stays done. */
  redo: () => void;
}

function sceneOptions(lesson: LessonDefinition, parser: QueryRunner) {
  return {
    parser,
    runner: engineRunner,
    tables: datasets[lesson.datasetId].tables.map((t) => t.name),
    fallbackTable: lesson.table,
  };
}

/** Names the lesson itself uses (tables it creates, aliases), so the red pen never mistakes them for typos. */
export function lessonIdentifiers(lesson: LessonDefinition): string[] {
  const own = lex(lesson.goal.referenceSql).filter((t) => t.kind === "word").map((t) => t.text);
  return [...datasetIdentifiers(datasets[lesson.datasetId]), ...own];
}

/** Sandbox lessons: the lesson's table on a fresh copy, before any change (or a note that it does not exist yet). */
async function sandboxIdle(lesson: LessonDefinition): Promise<FilterScene> {
  const ran = await sandboxExec({ setup: lesson.sandbox?.setup }, [
    { text: `SELECT * FROM ${quoteIdent(lesson.table)}`, start: 0 },
  ]);
  return ran.ok && !ran.result.error
    ? tableScene(lesson.table, "", ran.result, `The ${lesson.table} table before your change.`, null, lesson.sandbox?.focus)
    : tableScene(lesson.table, "", { columns: [], rows: [] }, `There is no ${lesson.table} table yet: your statement creates it.`, null);
}

/** The slip starts in the house style: one clause per line, keywords in capitals. */
export function starterText(lesson: LessonDefinition): string {
  return formatSql(lesson.starterSql, lessonIdentifiers(lesson));
}

const OFFLINE_HELP =
  "The database could not start. It downloads from the internet the first time you open a lesson, so check your connection and reload the page.";

export const useLesson = create<LessonState>()((set, get) => {
  /** Reads the query back once it has run; a newer run wins. */
  const readBack = async (lesson: LessonDefinition, sql: string, result: RunQueryResult) => {
    const explanation = await explainSql(sql, {
      // Sandbox tables live only inside the sandbox's rolled-back transaction, so words only there.
      runner: lesson.sandbox ? null : readOnlyRunner,
      tables: datasets[lesson.datasetId].tables,
      result,
    });
    if (get().lastRunSql === sql) set({ explained: { sql, explanation } });
  };

  return {
    lesson: null,
    sql: "",
    status: "booting",
    fatal: null,
    checkerReady: false,
    outcome: { kind: "idle" },
    attempt: 0,
    lastRunSql: null,
    hintsShown: 0,
    answerShown: false,
    completion: null,
    scene: null,
    idle: null,
    result: null,
    explained: null,

    open: async (lesson) => {
      whenProgressReady((p) => p.openLesson(lesson.id));
      if (get().lesson?.id !== lesson.id) {
        set({
          lesson,
          sql: starterText(lesson),
          status: "booting",
          fatal: null,
          outcome: { kind: "idle" },
          attempt: 0,
          lastRunSql: null,
          hintsShown: 0,
          answerShown: false,
          completion: null,
          scene: null,
          idle: null,
          result: null,
          explained: null,
        });
      }
      const error = await loadDataset(datasets[lesson.datasetId]);
      if (error) {
        set({ status: "error", fatal: OFFLINE_HELP });
        return;
      }
      // Sandbox lessons check by running on a fresh copy, so they do not wait for the checker.
      if (lesson.sandbox) {
        if (!get().idle) {
          const idle = await sandboxIdle(lesson);
          set({ idle, scene: idle });
        }
        set({ status: "ready", checkerReady: true });
        return;
      }
      // Draw the table straight away; the checker may take up to 12 seconds.
      if (!get().idle) {
        const plain = await idleScene(engineRunner, lesson.table);
        if (!plain.ok) {
          set({ status: "error", fatal: friendlyError(plain.error) });
          return;
        }
        set({ idle: plain.value, scene: plain.value });
      }
      set({ status: "preparing-checker" });
      const loaded = await prepareChecker();
      set({ checkerReady: loaded.ok });
      // With the checker, focus the idle ledger on the column the goal is about.
      if (loaded.ok && get().scene?.mode === "idle") {
        const fromGoal = await buildLearnerScene(lesson.goal.referenceSql, sceneOptions(lesson, loaded.runner));
        if (fromGoal.ok) {
          const idle = asIdle(fromGoal.value);
          set((s) => ({ idle, scene: s.scene?.mode === "idle" ? idle : s.scene }));
        }
      }
      set({ status: "ready" });
    },

    // The last verdict (and the red pen) stays until the next run; the UI marks
    // it as belonging to the previous text once sql !== lastRunSql.
    setSql: (sql) => set({ sql }),

    // Only the text is reset (the editor records it, so it can be undone).
    startOver: () => {
      const lesson = get().lesson;
      if (lesson) set({ sql: starterText(lesson) });
    },

    showHint: () => {
      const { lesson, hintsShown } = get();
      const next = nextHintCount(hintsShown, lesson?.hints.length ?? 0);
      if (!lesson || next === hintsShown) return;
      set({ hintsShown: next });
      whenProgressReady((p) => p.recordHint(lesson.id));
    },

    showAnswer: () => set({ answerShown: true }),

    run: async () => {
      const { lesson, sql, status } = get();
      if (!lesson || status !== "ready") return get().outcome;
      set({ status: "running", lastRunSql: sql });
      whenProgressReady((p) => p.recordAttempt(lesson.id));
      const opts = {
        referenceSql: lesson.goal.referenceSql,
        identifiers: lessonIdentifiers(lesson),
        tables: datasets[lesson.datasetId].tables.map((t) => t.name),
      };
      const fail = (outcome: Outcome, result: RunQueryResult | null = null): Outcome => {
        set((s) => ({ status: "ready", outcome, result, attempt: s.attempt + 1 }));
        return outcome;
      };

      if (sql.trim().replace(/;\s*$/, "").trim() === "") {
        return fail({ kind: "diagnostic", diagnosis: diagnose(sql, { kind: "empty", message: "Write a query on the slip first." }, opts) });
      }
      if (lesson.sandbox) {
        const check = await checkSandboxAnswer(sql, { goal: lesson.goal, hints: lesson.hints, sandbox: lesson.sandbox }, sandboxExec);
        if (!check.ok && check.reason === "error") {
          const error = check.error ?? { kind: "runtime" as const, message: check.hint };
          return fail({ kind: "diagnostic", diagnosis: diagnose(sql, error, opts) });
        }
        void readBack(lesson, sql, check.learner);
        set({
          scene: tableScene(
            lesson.table,
            sql,
            check.learner,
            "Your statement ran on a fresh copy of the data. This is the result afterwards.",
            CHANGED_LABEL,
            lesson.sandbox.focus,
          ),
        });
        if (!check.ok) return fail({ kind: "wrong", reason: check.reason, hint: check.hint }, check.learner);
        const outcome: Outcome = { kind: "approved" };
        const completion = completionFor(get().answerShown);
        set({ status: "ready", outcome, result: check.learner, completion });
        // Approval finishes the lesson; doing it again later never undoes that.
        whenProgressReady((p) => {
          p.recordApproved(lesson.id, completion);
          p.markDone(lesson.id);
        });
        return outcome;
      }

      // Without the checker, skip straight to running: the guard in checkAnswer
      // still blocks anything but one SELECT, and parse errors come back with a caret.
      const parser = get().checkerReady ? await checkerRunner() : null;
      if (parser) {
        const parsed = await parseCheck(sql, parser);
        if (parsed.kind === "runtime") {
          set({ status: "ready", outcome: { kind: "system", message: `The query checker failed: ${parsed.message}` } });
          return get().outcome;
        }
        if (parsed.kind !== "ok") return fail({ kind: "diagnostic", diagnosis: diagnose(sql, parsed, opts) });
      }

      const check = await checkAnswer(sql, lesson, engineRunner);
      if (check.learner.error) {
        const err = runtimeError(sql, check.learner.error);
        return fail({ kind: "diagnostic", diagnosis: diagnose(sql, err, opts) });
      }
      // The query ran: animate the learner's own query, right or wrong.
      const idle = get().idle;
      let scene: FilterScene | null = idle;
      if (parser) {
        const built = await buildLearnerScene(sql, sceneOptions(lesson, parser));
        scene = built.ok ? built.value : idle;
      } else if (idle) {
        scene = checkerOffScene(idle, sql);
      }
      set({ scene });
      void readBack(lesson, sql, check.learner);

      if (!check.ok) return fail({ kind: "wrong", reason: check.reason, hint: check.hint }, check.learner);

      const outcome: Outcome = { kind: "approved" };
      const completion = completionFor(get().answerShown);
      set({ status: "ready", outcome, result: check.learner, completion });
      // Approval finishes the lesson; doing it again later never undoes that.
      whenProgressReady((p) => {
        p.recordApproved(lesson.id, completion);
        p.markDone(lesson.id);
      });
      return outcome;
    },

    redo: () => {
      const { lesson, idle } = get();
      if (!lesson) return;
      set({
        sql: starterText(lesson),
        outcome: { kind: "idle" },
        attempt: 0,
        lastRunSql: null,
        hintsShown: 0,
        answerShown: false,
        scene: idle,
        result: null,
        explained: null,
      });
    },
  };
});
