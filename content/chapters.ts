/**
 * The twelve chapters, exactly as in design/reference/Map.dc.html. Prerequisites
 * are soft: they only change the wording, never block a learner.
 */
export interface Chapter {
  n: number;
  name: string;
  topics: string;
  blurb: string;
  /** "You will type:" example. */
  sample: string;
  /** Chapters that help first (soft). */
  prerequisites: number[];
  /** Red-pen margin note, six words at most (may be empty). */
  note: string;
  /** Lesson ids in order. Empty means the chapter is still being written. */
  lessonIds: string[];
}

export interface ChapterGroup {
  /** First chapter number in the group. */
  from: number;
  label: string;
  note: string;
}

export const chapters: readonly Chapter[] = [
  { n: 1, name: "Foundations", topics: "Tables, rows, columns and data types", blurb: "Before any query, learn what a database actually holds: tables made of rows and columns, and the type of value each column keeps.", sample: "SELECT * FROM orders;", prerequisites: [], note: "new to SQL? begin here", lessonIds: [] },
  { n: 2, name: "Query basics", topics: "SELECT, aliases, DISTINCT, LIMIT", blurb: "Choose the columns you want, rename them, remove duplicates and limit how many rows come back.", sample: "SELECT DISTINCT city FROM customers;", prerequisites: [1], note: "", lessonIds: [] },
  { n: 3, name: "Filtering", topics: "WHERE, AND, OR, NOT, IN, BETWEEN, LIKE, NULL", blurb: "Keep only the rows that pass a test, and learn the traps: boundaries, text matching and the odd behaviour of NULL.", sample: "SELECT * FROM orders WHERE amount > 50;", prerequisites: [2], note: "watch the boundary", lessonIds: ["filter"] },
  { n: 4, name: "Sorting and conditional logic", topics: "ORDER BY, CASE", blurb: "Put results in the order you want, and write if-this-then-that rules inside a query.", sample: "SELECT * FROM orders ORDER BY amount DESC;", prerequisites: [2], note: "", lessonIds: [] },
  { n: 5, name: "Functions", topics: "Text, number and date functions", blurb: "Clean and reshape values: change case, round numbers, pull the month out of a date.", sample: "SELECT UPPER(name) FROM customers;", prerequisites: [2], note: "", lessonIds: [] },
  { n: 6, name: "Aggregation", topics: "COUNT, SUM, AVG, GROUP BY, HAVING", blurb: "Collapse many rows into one answer per group, and learn when to filter before grouping and when after.", sample: "SELECT city, COUNT(*) FROM customers GROUP BY city;", prerequisites: [3], note: "where vs having", lessonIds: [] },
  { n: 7, name: "Joins", topics: "INNER, LEFT, several tables, self-join", blurb: "Combine tables that share a key, and see exactly which rows match, which drop out and which turn into NULL.", sample: "SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id;", prerequisites: [3], note: "the big one", lessonIds: [] },
  { n: 8, name: "Subqueries and set operations", topics: "Subqueries, UNION, INTERSECT, EXCEPT", blurb: "Use one query inside another, and stack results from separate queries.", sample: "SELECT * FROM orders WHERE amount > (SELECT AVG(amount) FROM orders);", prerequisites: [7], note: "", lessonIds: [] },
  { n: 9, name: "CTEs and window functions", topics: "WITH, ROW_NUMBER, RANK, running totals", blurb: "Name a step so a long query reads top to bottom, and calculate across rows without collapsing them.", sample: "SELECT *, ROW_NUMBER() OVER (ORDER BY amount DESC) FROM orders;", prerequisites: [6, 7], note: "analysts use this daily", lessonIds: [] },
  { n: 10, name: "Changing data", topics: "CREATE TABLE, INSERT, UPDATE, DELETE, constraints, transactions", blurb: "Build your own tables in the practice sandbox, change them safely, and protect them with constraints.", sample: "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);", prerequisites: [2], note: "opens the sandbox", lessonIds: [] },
  { n: 11, name: "Database design", topics: "Entities, keys, relationships, normalization, star schema", blurb: "Decide what the tables should be before you build them: remove repeated facts, link tables with keys, and shape data for analysis.", sample: "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id));", prerequisites: [7, 10], note: "design on paper first", lessonIds: [] },
  { n: 12, name: "Real-world SQL", topics: "Indexes, views, reading query plans, capstone project", blurb: "Make queries fast, hide complexity behind views, and finish by designing and analysing a database of your own.", sample: "CREATE INDEX idx_orders_customer ON orders(customer_id);", prerequisites: [9, 11], note: "your capstone lives here", lessonIds: [] },
];

export const chapterGroups: readonly ChapterGroup[] = [
  { from: 1, label: "Getting started", note: "start here if you are new" },
  { from: 6, label: "Answering real questions", note: "know this? test out" },
  { from: 10, label: "Building and designing", note: "the part most courses skip" },
];

export function chapterByNumber(n: number): Chapter | undefined {
  return chapters.find((c) => c.n === n);
}

export function chapterOfLesson(lessonId: string): Chapter | undefined {
  return chapters.find((c) => c.lessonIds.includes(lessonId));
}

export function hasLessons(c: Chapter): boolean {
  return c.lessonIds.length > 0;
}
