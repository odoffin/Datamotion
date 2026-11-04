import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { lessonOrder, lessons } from "@/content/lessons";
import { teaching } from "@/content/lessons/teaching";
import { sameQuery } from "@/engine/format";
import type { QueryRunner } from "@/engine/query-runner";
import { runInSandbox, splitStatements } from "@/engine/sandbox";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});

describe("Explained simply", () => {
  it("covers every lesson in the course, and nothing else", () => {
    expect(Object.keys(teaching).sort()).toEqual([...lessonOrder].sort());
    for (const id of lessonOrder) expect(lessons[id]!.teach, id).toBeDefined();
  });

  it("gives every lesson a picture, steps, an example, a watch-out and a line to remember", () => {
    for (const id of lessonOrder) {
      const t = lessons[id]!.teach!;
      expect(t.picture.length, id).toBeGreaterThan(40);
      expect(t.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(t.example.says.length, id).toBeGreaterThan(10);
      expect(t.watchOut.length, id).toBeGreaterThan(20);
      expect(t.remember.length, id).toBeGreaterThan(5);
    }
  });

  it("never hands over the answer: no example is the exercise's own query", () => {
    for (const id of lessonOrder) {
      const l = lessons[id]!;
      expect(sameQuery(l.teach!.example.sql, l.goal.referenceSql), id).toBe(false);
    }
  });

  it("runs every example on the real data, sandbox lessons on a thrown-away copy", async () => {
    for (const id of lessonOrder) {
      const l = lessons[id]!;
      const { sql, check } = l.teach!.example;
      if (l.sandbox) {
        const ran = await runInSandbox(runner, { setup: l.sandbox.setup, ...(check ? { check } : {}) }, splitStatements(sql)!);
        expect(ran.ok, `${id}: ${ran.ok ? "" : ran.error}`).toBe(true);
        if (ran.ok) expect(ran.result.error, id).toBeUndefined();
      } else {
        const res = await runner.run(sql);
        expect(res.error, `${id}: ${sql}`).toBeUndefined();
        expect(res.rows.length, id).toBeGreaterThan(0);
      }
    }
  });
});
