import type { DatasetId } from "@/content/datasets";
import type { LessonGoal } from "@/engine/check";
import type { FilterOperator } from "@/engine/scenes/filter";
import type { SceneType } from "@/engine/trace";

export interface LessonDefinition {
  id: string;
  concept_id: string;
  title: string;
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
  /** Gentle nudges that never give the answer away, mildest first. */
  hints: string[];
  nextLessonId?: string;
  /**
   * The filter the ledger animates once the learner's result is approved.
   * TODO(step 6): derive this from the learner's own query instead.
   */
  animation: { column: string; operator: FilterOperator; threshold: number };
}
