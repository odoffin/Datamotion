import type { DatasetId } from "@/content/datasets";
import type { SceneType } from "@/engine/trace";

export interface SelectSlot<T extends string = string> {
  kind: "select";
  label: string;
  options: readonly T[];
  default: T;
}

export interface NumberSlot {
  kind: "number";
  label: string;
  default: number;
  step?: number;
}

export type Slot = SelectSlot | NumberSlot;

export interface LessonDefinition<S extends Record<string, Slot> = Record<string, Slot>> {
  id: string;
  concept_id: string;
  title: string;
  /** Short plain-language explanation shown before running. */
  explanation: string;
  datasetId: DatasetId;
  scene: SceneType;
  /** The table the scene operates on. */
  table: string;
  /** Uses {slotName} placeholders, e.g. "WHERE {column} {operator} {threshold}". */
  queryTemplate: string;
  editableSlots: S;
}
