import { beforeAll, describe, expect, it } from "vitest";
import { datasets } from "@/content/datasets";
import { getLesson } from "@/content/lessons";
import { checkAnswer } from "@/engine/check";
import type { QueryRunner } from "@/engine/query-runner";
import {
  DEMO_RULE,
  chapterLines,
  countWord,
  demo,
  heroTally,
  playbackExample,
  readyLabel,
  splitAtWhere,
  starterDiagnosis,
} from "@/lib/landing";
import { createNodeRunner } from "./node-runner";

describe("landing page demo", () => {
  let runner: QueryRunner;
  let keptIds: number[];
  beforeAll(async () => {
    const lesson = getLesson(demo.lessonId)!;
    runner = await createNodeRunner(datasets[lesson.datasetId]);
    const res = await runner.run(`SELECT id FROM (${lesson.goal.referenceSql}) ORDER BY id`);
    expect(res.error).toBeUndefined();
    keptIds = res.rows.map((r) => Number(r[0]));
  });

  it("keeps exactly the rows the lesson's goal returns on DuckDB", async () => {
    const res = await runner.run(`SELECT id, ${DEMO_RULE.column} FROM ${demo.table} ORDER BY rowid`);
    const jsKept = res.rows.filter((r) => DEMO_RULE.keeps(Number(r[1]))).map((r) => Number(r[0]));
    expect(jsKept).toEqual(keptIds);
    expect(demo.keptTotal).toBe(keptIds.length);
  });

  it("shows an alternative query that the checker approves", async () => {
    const result = await checkAnswer(demo.alternativeSql, getLesson(demo.lessonId)!, runner);
    expect(result.ok).toBe(true);
  });

  it("shows the first eight rows with their real verdicts", async () => {
    const res = await runner.run(`SELECT id, ${DEMO_RULE.column} FROM ${demo.table} ORDER BY rowid LIMIT 8`);
    expect(demo.rows.map((r) => r.amount)).toEqual(res.rows.map((r) => Number(r[1])));
    expect(demo.rows.map((r) => r.kept)).toEqual(res.rows.map((r) => keptIds.includes(Number(r[0]))));
    expect(heroTally).toBe(`first 8 of ${demo.totalRows} rows: ${demo.rows.filter((r) => r.kept).length} kept`);
  });

  it("uses the lesson's own playback steps and red-pen diagnosis", () => {
    const step = playbackExample();
    expect(step.step).toBe(3);
    expect(step.total).toBeGreaterThan(step.step);
    expect(step.narration).toMatch(/^Rows? .* (pass|fail)/);
    const d = starterDiagnosis();
    expect(d.tokens[d.index]?.text).toBe("FORM");
    expect(d.note).toBe("expected FROM");
  });

  it("labels chapters from the content, never locked", () => {
    expect(chapterLines.some((c) => c.ready > 0)).toBe(true);
    expect(readyLabel(0)).toBe("being written");
    expect(readyLabel(1)).toBe("1 lesson ready");
    expect(readyLabel(3)).toBe("3 lessons ready");
  });

  it("splits a query before WHERE and spells small counts", () => {
    expect(splitAtWhere("SELECT * FROM orders WHERE amount > 50")).toEqual(["SELECT * FROM orders", "WHERE amount > 50"]);
    expect(splitAtWhere("SELECT * FROM orders")).toEqual(["SELECT * FROM orders"]);
    expect(countWord(12)).toBe("twelve");
    expect(countWord(42)).toBe("42");
  });
});
