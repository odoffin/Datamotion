import type { DatasetId } from "@/content/datasets";
import type { LessonGoal } from "@/engine/check";
import type { SandboxSpec } from "@/engine/sandbox";
import type { SceneType } from "@/engine/trace";

/**
 * The lesson taught like a textbook page, in words a young child could follow:
 * an everyday picture, how it works, a worked example, the usual mistake and
 * one line to keep.
 */
export interface Teaching {
  /** An everyday picture of the idea. */
  picture: string;
  /** How it works, one short step per line. */
  steps: string[];
  /**
   * A worked example on other data than the exercise, so it never hands over
   * the answer. It runs live; `check` is the query that shows a sandbox
   * lesson's table afterwards.
   */
  example: { sql: string; says: string; check?: string };
  /** The mistake most beginners make, and how to avoid it. */
  watchOut: string;
  /** One line to keep. */
  remember: string;
}

export interface LessonDefinition {
  id: string;
  concept_id: string;
  title: string;
  /** Short concept tags shown on the lesson and the chapter map, most central first. */
  concepts: string[];
  /** The big serif line at the top of the lesson. */
  headline: string;
  /** Short plain-language explanation first; the long one sits behind a disclosure. */
  explanation: { short: string; long: string[] };
  datasetId: DatasetId;
  scene: SceneType;
  /** The table the scene operates on. */
  table: string;
  /** What the learner's query must return. Checked by result, not by text. */
  goal: LessonGoal;
  /** What the slip starts with (may contain a deliberate mistake). */
  starterSql: string;
  /** "Your turn" line on the slip: what to do with the starter query. Defaults to fixing a typo. */
  task?: string;
  /**
   * Lessons that change data run in the scratch sandbox: each attempt runs on a
   * fresh copy inside a transaction that is rolled back, and `check` is compared.
   */
  sandbox?: SandboxSpec;
  /** Gentle nudges that never give the answer away, mildest first. */
  hints: string[];
  /** Explained simply (content/lessons/teaching.ts). Every lesson has one. */
  teach?: Teaching;
  nextLessonId?: string;
}
