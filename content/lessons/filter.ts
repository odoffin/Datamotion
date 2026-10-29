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
  headline: "Keep only the rows that pass the test.",
  explanation: {
    short:
      "WHERE is a rule the database checks against every row. Rows that pass stay in the result. Rows that fail leave it. The table itself never changes.",
    long: [
      "Read the query in the order the database does. FROM orders picks the table. WHERE amount > 50 is then asked of one row at a time: is this amount greater than 50? Only a yes keeps the row. SELECT * comes last and decides which columns you see.",
      "The boundary matters. The symbol > means strictly greater than, so an amount of exactly 50 is dropped. Swap in >= and it stays. Off by one mistakes like this return the wrong rows without any error message, which is why they are so common.",
      "Watch the ledger as you run the query. Every row gets a verdict, and you can see which rows the rule removed and why.",
    ],
  },
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
