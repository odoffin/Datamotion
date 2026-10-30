import type { LessonDefinition } from "./types";

type Draft = Omit<LessonDefinition, "concept_id" | "datasetId" | "scene" | "goal" | "nextLessonId"> &
  Partial<Pick<LessonDefinition, "scene">> & {
    goal: Omit<LessonDefinition["goal"], "compare"> & Partial<Pick<LessonDefinition["goal"], "compare">>;
  };

/** Fills the defaults every lesson shares: the shop dataset, unordered rows, its own concept id. */
export function lesson(d: Draft): LessonDefinition {
  return {
    ...d,
    concept_id: d.id,
    datasetId: "shop",
    scene: d.scene ?? "filter",
    goal: { compare: "rows-any-order", ...d.goal },
  };
}
