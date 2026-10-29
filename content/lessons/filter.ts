import { shop } from "@/content/datasets/shop";
import { numericColumns } from "@/content/datasets/types";
import { FILTER_OPERATORS } from "@/engine/scenes/filter";
import type { LessonDefinition, NumberSlot, SelectSlot } from "./types";

type FilterLessonSlots = {
  column: SelectSlot;
  operator: SelectSlot<(typeof FILTER_OPERATORS)[number]>;
  threshold: NumberSlot;
};

export const filterLesson: LessonDefinition<FilterLessonSlots> = {
  id: "filter-where-basics",
  concept_id: "filter",
  title: "Filtering rows with WHERE",
  explanation:
    "WHERE checks a condition on every row, one at a time. Rows where the condition is true stay. Rows where it is false (or unknown) are dropped. Nothing else about the row changes.",
  datasetId: "shop",
  scene: "filter",
  table: "orders",
  queryTemplate: "SELECT * FROM orders WHERE {column} {operator} {threshold}",
  editableSlots: {
    column: {
      kind: "select",
      label: "Column",
      options: numericColumns(shop, "orders"),
      default: "amount",
    },
    operator: {
      kind: "select",
      label: "Operator",
      options: FILTER_OPERATORS,
      default: ">",
    },
    threshold: { kind: "number", label: "Threshold", default: 50, step: 1 },
  },
};
