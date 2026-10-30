import { chapters } from "@/content/chapters";
import { datasets } from "@/content/datasets";
import { datasetIdentifiers } from "@/content/datasets/types";
import { getLesson, lessons } from "@/content/lessons";
import { diagnose, type Diagnosis } from "@/engine/check";
import { scanSteps } from "@/engine/scenes/filter";
import { QUESTIONS } from "@/lib/placement";

/**
 * Everything the landing page shows about the product, computed from the
 * product's own content so the page cannot drift from it.
 */

/** The lesson the landing page demonstrates: the first one that is written. */
const firstChapter = chapters.find((c) => c.lessonIds.some((id) => getLesson(id)));
const demoLesson = getLesson(firstChapter?.lessonIds[0] ?? "") ?? Object.values(lessons)[0]!;
const dataset = datasets[demoLesson.datasetId];
const table = dataset.tables.find((t) => t.name === demoLesson.table)!;

/** The demo lesson's goal, `amount > 50`. tests/landing.test.ts checks it against the goal's SQL on DuckDB. */
export const DEMO_RULE = { column: "amount", text: "amount > 50", keeps: (amount: number) => amount > 50 } as const;

const ruleIndex = table.columns.findIndex((c) => c.name === DEMO_RULE.column);
const amounts = table.rows.map((row) => {
  const v = row[ruleIndex];
  return typeof v === "number" ? v : Number(v);
});

export const HERO_ROW_COUNT = 8;

export interface DemoRow {
  /** 1-based, in table order. */
  position: number;
  amount: number;
  kept: boolean;
}

export const demo = {
  lessonId: demoLesson.id,
  chapterName: firstChapter?.name ?? demoLesson.title,
  table: table.name,
  ruleColumn: DEMO_RULE.column,
  /** The query the hero slip types: the lesson's goal. */
  sql: demoLesson.goal.referenceSql,
  /** The query the lesson starts with, mistake included. */
  starterSql: demoLesson.starterSql,
  /** A different way to write the goal; it passes because results are checked, not text. */
  alternativeSql: "SELECT * FROM orders WHERE 50 < amount",
  rows: amounts.slice(0, HERO_ROW_COUNT).map((amount, i): DemoRow => ({ position: i + 1, amount, kept: DEMO_RULE.keeps(amount) })),
  totalRows: amounts.length,
  /** Rows the whole table keeps under the rule: the goal's row count. */
  keptTotal: amounts.filter(DEMO_RULE.keeps).length,
};

export const keptShown = demo.rows.filter((r) => r.kept).length;

/** "first 8 of 40 rows: 3 kept" */
export const heroTally = `first ${demo.rows.length} of ${demo.totalRows} rows: ${keptShown} kept`;

/** Splits a query before WHERE so it can wrap onto two lines on narrow slips. */
export function splitAtWhere(sql: string): [string, string] | [string] {
  const at = sql.search(/\sWHERE\s/i);
  return at < 0 ? [sql] : [sql.slice(0, at), sql.slice(at + 1)];
}

/** The lesson's own playback steps for the demo query, at its first verdict. */
export function playbackExample(): { step: number; total: number; narration: string } {
  const checks = amounts.map((amount, i) => ({ rid: i, keep: DEMO_RULE.keeps(amount) }));
  // Boundary notes ("50 is not greater than 50") stay in the lesson; the example shows the verdict line.
  const steps = scanSteps(table.name, checks, DEMO_RULE.text, () => null);
  const index = Math.max(0, steps.findIndex((s) => s.id.startsWith("verdict-")));
  return { step: index + 1, total: steps.length, narration: steps[index]?.narration ?? "" };
}

/** What the red pen says about the lesson's starter query (the FORM typo). */
export function starterDiagnosis(): Diagnosis {
  return diagnose(
    demo.starterSql,
    { kind: "syntax", message: "" },
    { referenceSql: demoLesson.goal.referenceSql, identifiers: datasetIdentifiers(dataset), tables: dataset.tables.map((t) => t.name) },
  );
}

export interface ChapterLine {
  n: number;
  name: string;
  /** Written lessons that open today. */
  ready: number;
}

export const chapterLines: ChapterLine[] = chapters.map((c) => ({
  n: c.n,
  name: c.name,
  ready: c.lessonIds.filter((id) => getLesson(id)).length,
}));

export const lessonsReady = chapterLines.reduce((sum, c) => sum + c.ready, 0);

export function readyLabel(ready: number): string {
  return ready === 0 ? "being written" : `${ready} ${ready === 1 ? "lesson" : "lessons"} ready`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

/** Small counts as words in running text ("twelve chapters"). */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const chapterCount = chapters.length;
export const quizLength = QUESTIONS.length;
