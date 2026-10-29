import { describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { guardReadOnly } from "@/engine/sql-guard";
import { createNodeRunner } from "./node-runner";

describe("guardReadOnly", () => {
  it.each([
    "SELECT * FROM orders WHERE amount > 50",
    "select 1;",
    "WITH t AS (SELECT 1 AS x) SELECT * FROM t",
    "SELECT 'drop table; insert' AS s",
    "SELECT replace(name, 'a', 'b') FROM customers",
  ])("allows %s", (sql) => {
    expect(guardReadOnly(sql).ok).toBe(true);
  });

  it.each([
    "DROP TABLE orders",
    "SELECT 1; DROP TABLE orders",
    "INSERT INTO orders VALUES (1)",
    "WITH t AS (SELECT 1) DELETE FROM orders",
    "SELECT 1 /* unclosed",
    "SET enable_external_access = true",
    "",
  ])("rejects %s", (sql) => {
    expect(guardReadOnly(sql).ok).toBe(false);
  });
});

describe("shop dataset", () => {
  it("loads with stable, hidden rowids", async () => {
    const runner = await createNodeRunner(shop);
    const star = await runner.run("SELECT * FROM orders LIMIT 1");
    expect(star.columns).not.toContain("rowid");
    const ids = await runner.run("SELECT rowid, id FROM orders ORDER BY rowid");
    expect(ids.rows.every(([rid, id]) => rid === (id as number) - 1)).toBe(true);
  });

  it("keeps every table at 40 rows or fewer with several amounts of exactly 50", async () => {
    for (const t of shop.tables) expect(t.rows.length).toBeLessThanOrEqual(40);
    const runner = await createNodeRunner(shop);
    const res = await runner.run("SELECT count(*) FROM orders WHERE amount = 50");
    expect(res.rows[0]?.[0]).toBeGreaterThanOrEqual(3);
  });
});
