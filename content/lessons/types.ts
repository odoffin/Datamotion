import type { DatasetId } from "@/content/datasets";
import type { LessonGoal } from "@/engine/check";
import type { SandboxSpec } from "@/engine/sandbox";
import type { SceneType } from "@/engine/trace";

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
  nextLessonId?: string;
}
