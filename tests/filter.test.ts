import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { numericColumns } from "@/content/datasets/types";
import type { QueryRunner } from "@/engine/query-runner";
import { rowStatesAt } from "@/engine/playback";
import {
  buildFilterScene,
  filterQuerySql,
  validateFilterSlots,
  type FilterOperator,
  type FilterSpec,
} from "@/engine/scenes/filter";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});

const allowed = numericColumns(shop, "orders");

function spec(column: string, operator: FilterOperator, threshold: number): FilterSpec {
  const v = validateFilterSlots("orders", { column, operator, threshold }, allowed);
  if (!v.ok) throw new Error(v.error);
  return v.value;
}

/** Row ids the real learner query returns, via the same WHERE clause. */
async function realRowIds(s: FilterSpec): Promise<number[]> {
  const sql = filterQuerySql(s).replace("SELECT *", "SELECT rowid");
  const res = await runner.run(sql);
  if (res.error) throw new Error(res.error);
  return res.rows.map((r) => r[0] as number);
}

const cases: [string, FilterOperator, number][] = [
  ["amount", ">", 50],
  ["amount", ">=", 50],
  ["amount", "<", 50],
  ["amount", "<=", 50],
  ["amount", "=", 50],
  ["amount", "!=", 50],
  ["amount", ">", 199],
  ["amount", ">=", 199],
  ["amount", "<", 4.99],
  ["amount", "<=", 4.99],
  ["amount", ">", 1000],
  ["customer_id", "=", 5],
  ["product_id", "<=", 3],
  ["id", ">", -1],
];

describe("filter trace matches real execution", () => {
  it.each(cases)("%s %s %s", async (column, op, threshold) => {
    const s = spec(column, op, threshold);
    const scene = await buildFilterScene(runner, s);
    if (!scene.ok) throw new Error(scene.error);
    const expected = await realRowIds(s);
    expect([...scene.value.trace.resultRowIds].sort((a, b) => a - b)).toEqual(
      [...expected].sort((a, b) => a - b),
    );

    // The final animated state shows exactly the result rows as emitted.
    const { trace, table } = scene.value;
    const final = rowStatesAt(trace, table.rows.map((r) => r.rid), trace.steps.length - 1);
    const emitted = [...final].filter(([, v]) => v.status === "emitted").map(([id]) => id);
    expect(emitted.sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b));

    // The result table cells match the real SELECT * row for row.
    const real = await runner.run(filterQuerySql(s));
    const animated = table.rows.filter((r) => trace.resultRowIds.includes(r.rid)).map((r) => r.cells);
    expect(animated).toEqual(real.rows);
    expect(trace.resultColumns).toEqual(real.columns);
  });
});

describe("narration", () => {
  it("explains the boundary for > and >=", async () => {
    const gt = await buildFilterScene(runner, spec("amount", ">", 50));
    const ge = await buildFilterScene(runner, spec("amount", ">=", 50));
    if (!gt.ok || !ge.ok) throw new Error("scene failed");
    const text = (s: typeof gt.value) => s.trace.steps.map((x) => x.narration).join("\n");
    expect(text(gt.value)).toContain("50 is not greater than 50, so this row is dropped");
    expect(text(ge.value)).toContain("50 is greater than or equal to 50, so this row is kept");
    expect(gt.value.trace.steps[0]?.narration).toBe("Start with every row in orders");
    expect(gt.value.trace.steps.at(-1)?.narration).toBe("These 17 rows passed the filter");
    expect(gt.value.trace.steps[1]?.narration).toBe("Checking amount > 50 on rows 1 to 5");
  });
});

describe("slot validation", () => {
  it.each([
    [{ column: "amount; DROP TABLE orders", operator: ">", threshold: 1 }],
    [{ column: "amount", operator: "> 0 OR 1=1 --", threshold: 1 }],
    [{ column: "amount", operator: ">", threshold: "50 OR 1=1" }],
    [{ column: "amount", operator: ">", threshold: "" }],
    [{ column: "amount", operator: ">", threshold: Infinity }],
  ])("rejects %j", (slots) => {
    expect(validateFilterSlots("orders", slots, allowed).ok).toBe(false);
  });
});
