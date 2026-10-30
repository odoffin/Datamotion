import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { lessonOrder, lessons } from "@/content/lessons";
import { inWrittenOrder, puzzleLines, splitClauses } from "@/engine/clauses";
import { explainSql, type Explanation, type MatchFigure, type VerdictFigure } from "@/engine/explain";
import type { QueryRunner } from "@/engine/query-runner";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});

const read = async (sql: string) => explainSql(sql, { runner, tables: shop.tables, result: await runner.run(sql) });
const step = (e: Explanation, start: string) => e.steps.find((s) => s.sql.startsWith(start))!;

describe("splitClauses", () => {
  it("finds the outer clauses only, with JOIN modifiers and subqueries kept whole", () => {
    const kinds = splitClauses(
      "SELECT a FROM t LEFT OUTER JOIN u ON t.id = u.id WHERE a IN (SELECT b FROM v WHERE c > 1) ORDER BY a LIMIT 3",
    ).map((c) => [c.kind, c.text]);
    expect(kinds).toEqual([
      ["select", "SELECT a"],
      ["from", "FROM t"],
      ["join", "LEFT OUTER JOIN u ON t.id = u.id"],
      ["where", "WHERE a IN (SELECT b FROM v WHERE c > 1)"],
      ["order", "ORDER BY a"],
      ["limit", "LIMIT 3"],
    ]);
  });
});

describe("explainSql", () => {
  it("reads a filter in run order, with real counts and both verdicts", async () => {
    const e = await read("SELECT * FROM orders WHERE amount > 50");
    expect(e.steps.map((s) => s.sql)).toEqual(["FROM orders", "WHERE amount > 50", "SELECT *"]);
    expect(e.note).toBe("You write SELECT first, but the database runs it after FROM and WHERE.");
    const where = step(e, "WHERE");
    expect(where.sentence).toBe("Keep a row only if amount is more than 50.");
    expect(where.count).toBe("40 rows in, 17 kept, 23 dropped");
    const figure = where.figure as VerdictFigure;
    expect(figure.rows.some((r) => r.kept)).toBe(true);
    // 50 is not more than 50: the boundary row is dropped.
    expect(figure.rows.find((r) => r.cells[0] === "50")?.kept).toBe(false);
  });

  it("phrases the common tests in plain words", async () => {
    const sentence = async (where: string) => step(await read(`SELECT * FROM products WHERE ${where}`), "WHERE").sentence;
    expect(await sentence("price BETWEEN 25 AND 50")).toBe("Keep a row only if price is between 25 and 50, both included.");
    expect(await sentence("name LIKE 'W%'")).toBe("Keep a row only if name starts with W.");
    expect(await sentence("name NOT LIKE '%Mug%'")).toBe("Keep a row only if name does not contain Mug.");
    expect(await sentence("category IN ('Home', 'Office')")).toBe("Keep a row only if category is one of 'Home' or 'Office'.");
    expect(await sentence("price > 100 OR price < 10")).toBe("Keep a row only if price is more than 100, or price is less than 10.");
    expect(await sentence("price >= 10 AND (category = 'Home' OR category = 'Office')")).toBe(
      "Keep a row only if price is at least 10, and either category is 'Home', or category is 'Office'.",
    );
    expect(step(await read("SELECT * FROM reviews WHERE comment IS NULL"), "WHERE").sentence).toBe(
      "Keep a row only if comment is missing (NULL).",
    );
  });

  it("counts groups, and reads HAVING as a test on each group", async () => {
    const e = await read("SELECT customer_id, COUNT(*) AS orders FROM orders GROUP BY customer_id HAVING COUNT(*) >= 4");
    expect(e.steps.map((s) => s.sql.split(" ")[0])).toEqual(["FROM", "GROUP", "HAVING", "SELECT"]);
    expect(step(e, "GROUP").count).toBe("40 rows in, 12 groups");
    expect(step(e, "HAVING").sentence).toBe("Keep a group only if its number of rows is at least 4.");
    expect(step(e, "SELECT").sentence).toBe("Show customer_id and the number of rows in each group (as orders).");
  });

  it("says when a total turns every row into one", async () => {
    const e = await read("SELECT SUM(amount) AS total FROM orders");
    expect(step(e, "SELECT").sentence).toBe("Turn all the rows into one row, showing the total of amount (as total).");
    expect(step(e, "SELECT").count).toBe("40 rows in, 1 out, 1 column each");
  });

  it("draws a LEFT JOIN as matches: several, one, and none kept with NULL", async () => {
    const e = await read("SELECT products.name, reviews.rating FROM products LEFT JOIN reviews ON reviews.product_id = products.id");
    const join = step(e, "LEFT JOIN");
    expect(join.count).toBe("15 rows in, 17 out");
    const figure = join.figure as MatchFigure;
    expect(figure.keepsUnmatched).toBe(true);
    expect(figure.left).toMatchObject({ name: "products", key: "id", label: "name" });
    expect(figure.right).toMatchObject({ name: "reviews", key: "product_id", label: "rating" });
    expect(figure.rows.some((r) => r.matches.length === 0)).toBe(true);
    expect(figure.rows.some((r) => r.matches.length >= 2)).toBe(true);
  });

  it("follows aliases, including a table joined to itself", async () => {
    const e = await read("SELECT e.name AS employee, m.name AS manager FROM employees e JOIN employees m ON e.manager_id = m.id");
    const join = step(e, "JOIN");
    expect(join.sentence).toContain("Bring in employees a second time, called m");
    const figure = join.figure as MatchFigure;
    expect(figure.keepsUnmatched).toBe(false);
    expect(figure.rows.find((r) => r.key === "NULL")?.matches).toEqual([]);
  });

  it("runs an inner query first and reports its value", async () => {
    const e = await read("SELECT * FROM orders WHERE amount > (SELECT AVG(amount) FROM orders)");
    const inner = step(e, "SELECT AVG");
    expect(inner.count).toMatch(/^It gives one value: \d+(\.\d+)?$/);
    expect(e.steps.indexOf(inner)).toBeLessThan(e.steps.indexOf(step(e, "WHERE")));
  });

  it("explains sorting with directions that fit the values", async () => {
    const e = await read("SELECT customer_id, id, amount FROM orders ORDER BY customer_id, amount DESC");
    expect(step(e, "ORDER").sentence).toBe(
      "Sort the rows by customer_id, smallest first. Rows with the same customer_id are then sorted by amount, largest first.",
    );
    const dates = await read("SELECT * FROM orders ORDER BY order_date DESC LIMIT 1");
    expect(step(dates, "ORDER").sentence).toBe("Sort the rows by order_date, latest first.");
    expect(step(dates, "LIMIT").sentence).toBe("Keep only the first row.");
  });

  it("reads statements that change data in words only", async () => {
    const e = await explainSql("UPDATE products SET price = 30 WHERE id = 5");
    expect(e.steps).toEqual([
      {
        sql: "UPDATE products SET price = 30 WHERE id = 5",
        sentence: "In products, find the rows where id is 5, and set price to 30 in each of them. Every other row stays as it was.",
      },
    ]);
    const two = await explainSql("CREATE TABLE t (id INTEGER PRIMARY KEY); INSERT INTO t VALUES (1), (2)");
    expect(two.steps.map((s) => s.sentence)).toEqual([
      "Make a new, empty table called t with 1 column: id (INTEGER). id must be unique and never empty, so each value names exactly one row.",
      "Add 2 new rows to t: (1) and (2). The rows already there stay as they are.",
    ]);
  });

  it("reads every lesson's answer without guessing: no step falls back to quoting the whole test", async () => {
    for (const id of lessonOrder) {
      const l = lessons[id]!;
      const e = await explainSql(l.goal.referenceSql, { runner: l.sandbox ? null : runner, tables: shop.tables });
      expect(e.steps.length, id).toBeGreaterThan(0);
      for (const s of e.steps) {
        expect(s.sentence, id).not.toMatch(/this is (true|false):|runs as written/);
        if (!l.sandbox) expect(s.count, `${id}: ${s.sql}`).toBeTruthy();
      }
    }
  });

  it("never throws on broken text", async () => {
    for (const sql of ["SELECT * FORM orders", "SELECT (", "", "WHERE", "SELECT * FROM orders WHERE amount >"]) {
      await expect(explainSql(sql, { runner, tables: shop.tables })).resolves.toBeDefined();
    }
  });
});

describe("puzzleLines and inWrittenOrder", () => {
  it("cuts a query into clause lines, and changes of data too", () => {
    expect(puzzleLines("SELECT * FROM orders WHERE amount > 50")).toEqual(["SELECT *", "FROM orders", "WHERE amount > 50"]);
    expect(puzzleLines("UPDATE products SET price = 30 WHERE id = 5")).toEqual(["UPDATE products", "SET price = 30", "WHERE id = 5"]);
    expect(puzzleLines("DELETE FROM orders WHERE amount < 10")).toBeNull();
    expect(puzzleLines("SELECT * FROM products")).toBeNull();
  });

  it("accepts the written order, and joins swapped only when each names tables already there", () => {
    const lines = puzzleLines(
      "SELECT o.id FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id",
    )!;
    expect(lines).toHaveLength(4);
    expect(inWrittenOrder(lines, [0, 1, 2, 3])).toBe(true);
    expect(inWrittenOrder(lines, [0, 1, 3, 2])).toBe(true);
    expect(inWrittenOrder(lines, [1, 0, 2, 3])).toBe(false);
    const chained = puzzleLines("SELECT 1 FROM a JOIN b ON a.id = b.a_id JOIN c ON b.id = c.b_id")!;
    expect(inWrittenOrder(chained, [0, 1, 3, 2])).toBe(false);
  });
});
