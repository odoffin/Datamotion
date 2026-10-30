import { beforeAll, describe, expect, it } from "vitest";
import { chapters } from "@/content/chapters";
import { shop } from "@/content/datasets/shop";
import { datasetIdentifiers } from "@/content/datasets/types";
import { getLesson, lessonOrder, lessons } from "@/content/lessons";
import type { LessonDefinition } from "@/content/lessons/types";
import { checkAnswer, diagnose, parseCheck, runtimeError } from "@/engine/check";
import type { QueryRunner } from "@/engine/query-runner";
import { checkSandboxAnswer, runInSandbox } from "@/engine/sandbox";
import { guardReadOnly } from "@/engine/sql-guard";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});

/** Runs a query on a lesson exactly as the lesson page does (read-only or sandbox). */
function check(sql: string, lesson: LessonDefinition) {
  return lesson.sandbox
    ? checkSandboxAnswer(sql, { goal: lesson.goal, hints: lesson.hints, sandbox: lesson.sandbox }, (spec, st) => runInSandbox(runner, spec, st))
    : checkAnswer(sql, lesson, runner);
}

const all = lessonOrder.map((id) => getLesson(id)!);

describe("the course", () => {
  it("has lessons in every chapter, about four each, and nothing is left unlisted", () => {
    for (const c of chapters) expect(c.lessonIds.length, c.name).toBeGreaterThanOrEqual(4);
    expect(lessonOrder.length).toBe(Object.keys(lessons).length);
    expect(new Set(lessonOrder).size).toBe(lessonOrder.length);
  });

  it("leads from the first lesson to the capstone, one next at a time", () => {
    const seen: string[] = [];
    let at: LessonDefinition | undefined = getLesson(lessonOrder[0]!);
    while (at) {
      seen.push(at.id);
      at = at.nextLessonId ? getLesson(at.nextLessonId) : undefined;
    }
    expect(seen).toEqual(lessonOrder);
    expect(seen.at(-1)).toBe("capstone");
  });
});

describe.each(all.map((l) => [l.id, l] as const))("lesson %s", (_id, lesson) => {
  it("its own answer passes", async () => {
    const result = await check(lesson.goal.referenceSql, lesson);
    expect(result.ok, result.ok ? "" : result.hint).toBe(true);
    if (!lesson.sandbox) expect(guardReadOnly(lesson.goal.referenceSql).ok).toBe(true);
  });

  it("its starter query does not pass, so there is something to fix", async () => {
    const result = await check(lesson.starterSql, lesson);
    expect(result.ok).toBe(false);
  });

  it("a starter that errors gets the red pen somewhere useful", async () => {
    if (lesson.sandbox || !lesson.starterSql.trim()) return;
    const parsed = await parseCheck(lesson.starterSql, runner);
    const res = parsed.kind === "ok" ? await runner.run(lesson.starterSql) : null;
    const error = parsed.kind !== "ok" ? parsed : res?.error ? runtimeError(lesson.starterSql, res.error) : null;
    if (!error) return; // runs fine but returns the wrong rows: the checker's hint explains
    const d = diagnose(lesson.starterSql, error, {
      referenceSql: lesson.goal.referenceSql,
      identifiers: datasetIdentifiers(shop),
      tables: shop.tables.map((t) => t.name),
    });
    expect(d.message.length).toBeGreaterThan(0);
    expect(d.hint.length).toBeGreaterThan(0);
  });

  it("has a goal, hints and a table to show", () => {
    expect(lesson.goal.description.length).toBeGreaterThan(20);
    expect(lesson.hints.length).toBeGreaterThanOrEqual(1);
    expect(lesson.table.length).toBeGreaterThan(0);
  });
});
