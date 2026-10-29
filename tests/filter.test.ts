import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { rowStatesAt } from "@/engine/playback";
import type { QueryRunner } from "@/engine/query-runner";
import { buildLearnerScene, SIMPLIFIED_LABEL, type FilterScene } from "@/engine/scenes/filter";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});

const tables = shop.tables.map((t) => t.name);
const orders = shop.tables.find((t) => t.name === "orders")!;
type Order = { id: number; customer_id: number; product_id: number; amount: number };
const ordersRows: Order[] = orders.rows.map((r) => ({
  id: r[0] as number,
  customer_id: r[1] as number,
  product_id: r[2] as number,
  amount: r[3] as number,
}));

/** Expected row ids, computed in plain JS from the dataset (rowid = position). */
const idsWhere = (keep: (o: Order) => boolean) =>
  ordersRows.flatMap((o, i) => (keep(o) ? [i] : []));

async function scene(sql: string): Promise<FilterScene> {
  const s = await buildLearnerScene(sql, { parser: runner, runner, tables, fallbackTable: "orders" });
  if (!s.ok) throw new Error(s.error);
  return s.value;
}

/** Row ids that survive the last step of the animation (what the ledger shows as kept). */
function survivingIds(s: FilterScene): number[] {
  const last = s.trace.steps.length - 1;
  const states = rowStatesAt(s.trace, s.table.rows.map((r) => r.rid), last);
  return [...states].filter(([, v]) => v.status === "emitted").map(([rid]) => rid).sort((a, b) => a - b);
}

/** Row ids DuckDB itself returns for the learner's WHERE (independent of the scene). */
async function realIds(where: string): Promise<number[]> {
  const res = await runner.run(`SELECT rowid FROM orders WHERE ${where} ORDER BY rowid`);
  if (res.error) throw new Error(res.error);
  return res.rows.map((r) => r[0] as number);
}

const typed: { label: string; sql: string; where: string; expected: number[] }[] = [
  { label: ">", sql: "SELECT * FROM orders WHERE amount > 50", where: "amount > 50", expected: idsWhere((o) => o.amount > 50) },
  { label: ">=", sql: "SELECT * FROM orders WHERE amount >= 50", where: "amount >= 50", expected: idsWhere((o) => o.amount >= 50) },
  { label: "<", sql: "SELECT * FROM orders WHERE amount < 50", where: "amount < 50", expected: idsWhere((o) => o.amount < 50) },
  { label: "=", sql: "SELECT * FROM orders WHERE amount = 50", where: "amount = 50", expected: idsWhere((o) => o.amount === 50) },
  { label: "reversed 50 < amount", sql: "SELECT * FROM orders WHERE 50 < amount", where: "50 < amount", expected: idsWhere((o) => 50 < o.amount) },
  { label: "extra spaces", sql: "SELECT   *\n   FROM    orders\n  WHERE   amount   >   50  ;", where: "amount > 50", expected: idsWhere((o) => o.amount > 50) },
  { label: "lowercase keywords", sql: "select * from orders where amount > 50", where: "amount > 50", expected: idsWhere((o) => o.amount > 50) },
  { label: "another column", sql: "SELECT id, amount FROM orders WHERE customer_id = 5", where: "customer_id = 5", expected: idsWhere((o) => o.customer_id === 5) },
  // BUILD-PHASE-2.md also asks for BETWEEN, AND, OR and NOT.
  { label: "BETWEEN", sql: "SELECT * FROM orders WHERE amount BETWEEN 20 AND 50", where: "amount BETWEEN 20 AND 50", expected: idsWhere((o) => o.amount >= 20 && o.amount <= 50) },
  { label: "AND", sql: "SELECT * FROM orders WHERE amount > 50 AND customer_id < 6", where: "amount > 50 AND customer_id < 6", expected: idsWhere((o) => o.amount > 50 && o.customer_id < 6) },
  { label: "OR", sql: "SELECT * FROM orders WHERE amount < 10 OR amount > 150", where: "amount < 10 OR amount > 150", expected: idsWhere((o) => o.amount < 10 || o.amount > 150) },
  { label: "NOT", sql: "SELECT * FROM orders WHERE NOT amount <= 50", where: "NOT amount <= 50", expected: idsWhere((o) => !(o.amount <= 50)) },
];

describe("the animation's surviving rows equal the real result's rows", () => {
  it.each(typed)("$label: $sql", async ({ sql, where, expected }) => {
    const s = await scene(sql);
    expect(s.mode).toBe("animated");
    const real = await realIds(where);
    expect(real).toEqual(expected);
    expect(survivingIds(s)).toEqual(expected);
    expect([...s.trace.resultRowIds].sort((a, b) => a - b)).toEqual(expected);
  });

  it("is built from the typed clauses, not the goal", async () => {
    const s = await scene("SELECT * FROM orders WHERE customer_id = 5");
    expect(s.focusColumn).toBe("customer_id");
    expect(s.trace.steps[1]?.narration).toBe("Checking customer_id = 5 on rows 1 to 5");
  });

  it("narrates the boundary for the typed operator, including a reversed comparison", async () => {
    const text = async (sql: string) => (await scene(sql)).trace.steps.map((x) => x.narration).join("\n");
    expect(await text("SELECT * FROM orders WHERE amount > 50")).toContain("50 is not greater than 50, so this row is dropped");
    expect(await text("SELECT * FROM orders WHERE amount >= 50")).toContain("50 is greater than or equal to 50, so this row is kept");
    expect(await text("SELECT * FROM orders WHERE 50 < amount")).toContain("50 is not greater than 50, so this row is dropped");
    expect(await text("SELECT * FROM orders WHERE amount BETWEEN 20 AND 50")).toContain("because BETWEEN includes both ends");
  });

  it("a query with no WHERE keeps every row", async () => {
    const s = await scene("SELECT id FROM orders");
    expect(s.mode).toBe("animated");
    expect(survivingIds(s)).toHaveLength(orders.rows.length);
  });
});

describe("fallback: a simplified view that never disagrees with the result", () => {
  it.each([
    ["LIMIT", "SELECT * FROM orders WHERE amount > 50 ORDER BY amount DESC LIMIT 3"],
    ["subquery in WHERE", "SELECT * FROM orders WHERE amount > (SELECT AVG(amount) FROM orders)"],
  ])("%s: static before/after with the real row ids", async (_label, sql) => {
    const s = await scene(sql);
    const real = await runner.run(sql.replace("SELECT *", "SELECT rowid"));
    const want = real.rows.map((r) => r[0] as number).sort((a, b) => a - b);
    if (s.mode === "animated") {
      // A subquery WHERE can be scanned row by row; it must then still agree.
      expect(survivingIds(s)).toEqual(want);
    } else {
      expect(s.mode).toBe("simplified");
      expect(s.verdicts).toBe(true);
      expect(s.trace.steps).toHaveLength(1);
      expect(s.trace.steps[0]?.narration).toContain(SIMPLIFIED_LABEL);
      expect(survivingIds(s)).toEqual(want);
    }
  });

  it.each([
    ["aggregate", "SELECT COUNT(*) FROM orders WHERE amount > 50"],
    ["GROUP BY", "SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id"],
    ["JOIN", "SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id"],
    ["DISTINCT", "SELECT DISTINCT customer_id FROM orders"],
    ["CTE", "WITH big AS (SELECT * FROM orders WHERE amount > 50) SELECT * FROM big"],
  ])("%s: no row-by-row claim at all", async (_label, sql) => {
    const s = await scene(sql);
    expect(s.mode).toBe("simplified");
    expect(s.verdicts).toBe(false);
    expect(survivingIds(s)).toEqual([]);
    expect(s.trace.steps[0]?.narration).toContain(SIMPLIFIED_LABEL);
  });

  it("LIMIT never animates a scan that would keep more rows than the result", async () => {
    const s = await scene("SELECT * FROM orders WHERE amount > 50 LIMIT 3");
    expect(s.mode).toBe("simplified");
    expect(survivingIds(s)).toHaveLength(3);
  });

  it("errors and non-SELECT statements are refused, not animated", async () => {
    expect((await buildLearnerScene("SELECT * FORM orders", { parser: runner, runner, tables, fallbackTable: "orders" })).ok).toBe(false);
    expect((await buildLearnerScene("DROP TABLE orders", { parser: runner, runner, tables, fallbackTable: "orders" })).ok).toBe(false);
  });
});
