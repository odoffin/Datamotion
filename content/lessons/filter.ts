import type { LessonDefinition } from "./types";

export const filterLesson: LessonDefinition = {
  id: "filter",
  concept_id: "filter",
  title: "Filtering rows with WHERE",
  concepts: ["WHERE", "Comparison operators", "Boundaries: > versus >="],
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
  goal: {
    description: "List every order, with all its columns, whose amount is greater than 50.",
    referenceSql: "SELECT * FROM orders WHERE amount > 50",
    compare: "rows-any-order",
  },
  starterSql: "SELECT * FORM orders WHERE amount > 50",
  hints: [
    "Read the slip word by word. Is every keyword spelled right?",
    "Greater than 50 means 50 itself does not count.",
  ],
};
