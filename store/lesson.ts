import { create } from "zustand";
import { datasets } from "@/content/datasets";
import { datasetIdentifiers } from "@/content/datasets/types";
import type { LessonDefinition } from "@/content/lessons/types";
import { checkAnswer, diagnose, parseCheck, runtimeError, type CheckReason, type Diagnosis } from "@/engine/check";
import type { QueryRunner } from "@/engine/query-runner";
import { asIdle, buildLearnerScene, checkerOffScene, idleScene, type FilterScene } from "@/engine/scenes/filter";
import { friendlyError } from "@/engine/sql-guard";
import { checkerRunner, engineRunner, loadDataset, prepareChecker, type RunQueryResult } from "@/lib/engine/db";
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
  faded: boolean;
  open: (lesson: LessonDefinition) => Promise<void>;
  setSql: (sql: string) => void;
  startOver: () => void;
  run: () => Promise<Outcome>;
  showHint: () => void;
  showAnswer: () => void;
  fade: () => void;
  bringBack: () => void;
}

function sceneOptions(lesson: LessonDefinition, parser: QueryRunner) {
  return {
    parser,
    runner: engineRunner,
    tables: datasets[lesson.datasetId].tables.map((t) => t.name),
    fallbackTable: lesson.table,
  };
}

const OFFLINE_HELP =
  "The database could not start. It downloads from the internet the first time you open a lesson, so check your connection and reload the page.";

export const useLesson = create<LessonState>()((set, get) => ({
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
  faded: false,

  open: async (lesson) => {
    whenProgressReady((p) => p.openLesson(lesson.id));
    if (get().lesson?.id !== lesson.id) {
      set({
        lesson,
        sql: lesson.starterSql,
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
        faded: false,
      });
    }
    const error = await loadDataset(datasets[lesson.datasetId]);
    if (error) {
      set({ status: "error", fatal: OFFLINE_HELP });
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
    if (lesson) set({ sql: lesson.starterSql });
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
      identifiers: datasetIdentifiers(datasets[lesson.datasetId]),
      tables: datasets[lesson.datasetId].tables.map((t) => t.name),
    };
    const fail = (outcome: Outcome, result: RunQueryResult | null = null): Outcome => {
      set((s) => ({ status: "ready", outcome, result, attempt: s.attempt + 1 }));
      return outcome;
    };

    if (sql.trim().replace(/;\s*$/, "").trim() === "") {
      return fail({ kind: "diagnostic", diagnosis: diagnose(sql, { kind: "empty", message: "Write a query on the slip first." }, opts) });
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

    if (!check.ok) return fail({ kind: "wrong", reason: check.reason, hint: check.hint }, check.learner);

    const outcome: Outcome = { kind: "approved" };
    const completion = completionFor(get().answerShown);
    set({ status: "ready", outcome, result: check.learner, completion });
    whenProgressReady((p) => p.recordApproved(lesson.id, completion));
    return outcome;
  },

  // Finishing is the fade: it marks the lesson done. Bringing the code back is
  // for looking again; the lesson stays done.
  fade: () => {
    const lesson = get().lesson;
    set({ faded: true });
    if (lesson) whenProgressReady((p) => p.markDone(lesson.id));
  },
  bringBack: () => set({ faded: false }),
}));
