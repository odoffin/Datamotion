import { create } from "zustand";
import { datasets } from "@/content/datasets";
import { datasetIdentifiers } from "@/content/datasets/types";
import type { LessonDefinition } from "@/content/lessons/types";
import { checkAnswer, diagnose, parseCheck, runtimeError, type CheckReason, type Diagnosis } from "@/engine/check";
import { buildFilterScene, type FilterScene } from "@/engine/scenes/filter";
import { friendlyError } from "@/engine/sql-guard";
import { checkerRunner, engineRunner, loadDataset, prepareChecker, type RunQueryResult } from "@/lib/engine/db";

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
  /** The ledger for the lesson's table; plays once the answer is approved. */
  scene: FilterScene | null;
  /** The learner's own rows from DuckDB, whenever their query ran. */
  result: RunQueryResult | null;
  faded: boolean;
  open: (lesson: LessonDefinition) => Promise<void>;
  setSql: (sql: string) => void;
  startOver: () => void;
  run: () => Promise<Outcome>;
  fade: () => void;
  bringBack: () => void;
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
  scene: null,
  result: null,
  faded: false,

  open: async (lesson) => {
    if (get().lesson?.id !== lesson.id) {
      set({
        lesson,
        sql: lesson.starterSql,
        status: "booting",
        fatal: null,
        outcome: { kind: "idle" },
        attempt: 0,
        scene: null,
        result: null,
        faded: false,
      });
    }
    const error = await loadDataset(datasets[lesson.datasetId]);
    if (error) {
      set({ status: "error", fatal: OFFLINE_HELP });
      return;
    }
    set({ status: "preparing-checker" });
    const loaded = await prepareChecker();
    set({ checkerReady: loaded.ok });
    if (!get().scene) {
      const { column, operator, threshold } = lesson.animation;
      const scene = await buildFilterScene(engineRunner, { table: lesson.table, column, operator, threshold });
      if (!scene.ok) {
        set({ status: "error", fatal: friendlyError(scene.error) });
        return;
      }
      set({ scene: scene.value });
    }
    set({ status: "ready" });
  },

  // Typing clears the last verdict, like picking up the pen again.
  setSql: (sql) => set((s) => ({ sql, outcome: s.outcome.kind === "idle" ? s.outcome : { kind: "idle" } })),

  startOver: () => {
    const lesson = get().lesson;
    if (lesson) set({ sql: lesson.starterSql, outcome: { kind: "idle" }, result: null });
  },

  run: async () => {
    const { lesson, sql, status } = get();
    if (!lesson || status !== "ready") return get().outcome;
    set({ status: "running" });
    const opts = {
      referenceSql: lesson.goal.referenceSql,
      identifiers: datasetIdentifiers(datasets[lesson.datasetId]),
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
    if (!check.ok) return fail({ kind: "wrong", reason: check.reason, hint: check.hint }, check.learner);

    const outcome: Outcome = { kind: "approved" };
    set({ status: "ready", outcome, result: check.learner });
    return outcome;
  },

  fade: () => set({ faded: true }),
  bringBack: () => set({ faded: false }),
}));
