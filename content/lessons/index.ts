import { chapters } from "@/content/chapters";
import { foundations, queryBasics } from "./ch01-02-basics";
import { filtering, sorting } from "./ch03-04-filter-sort";
import { aggregation, functions } from "./ch05-06-functions-aggregates";
import { joins, subqueries, windows } from "./ch07-09-joins-windows";
import { changingData, design, realWorld } from "./ch10-12-sandbox";
import type { LessonDefinition } from "./types";

const all: readonly LessonDefinition[] = [
  ...foundations, ...queryBasics, ...filtering, ...sorting, ...functions, ...aggregation,
  ...joins, ...subqueries, ...windows, ...changingData, ...design, ...realWorld,
];
const byId = new Map(all.map((l) => [l.id, l]));

/** The course order: chapter by chapter, lessons in the order content/chapters.ts lists them. */
export const lessonOrder: readonly string[] = chapters.flatMap((c) => c.lessonIds).filter((id) => byId.has(id));

/** Every lesson, each pointing at the one after it in the course. */
export const lessons: Readonly<Record<string, LessonDefinition>> = Object.fromEntries(
  lessonOrder.map((id, i) => {
    const next = lessonOrder[i + 1];
    return [id, { ...byId.get(id)!, ...(next ? { nextLessonId: next } : {}) }];
  }),
);

export function getLesson(id: string): LessonDefinition | undefined {
  return Object.hasOwn(lessons, id) ? lessons[id] : undefined;
}
