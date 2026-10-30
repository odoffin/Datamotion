import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { datasetIdentifiers } from "@/content/datasets/types";
import { lessonOrder, lessons } from "@/content/lessons";
import { compareResults } from "@/engine/check";
import { formatSql, sameQuery } from "@/engine/format";
import type { QueryRunner } from "@/engine/query-runner";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});
const ids = datasetIdentifiers(shop);

describe("formatSql", () => {
  it("puts each clause on its own line, keywords and functions in capitals", () => {
    expect(formatSql("select * from orders where amount > 50 order by amount desc limit 5")).toBe(
      "SELECT *\nFROM orders\nWHERE amount > 50\nORDER BY amount DESC\nLIMIT 5;",
    );
    expect(formatSql("select count(*) as n from orders")).toBe("SELECT COUNT(*) AS n\nFROM orders;");
  });

  it("lists three or more columns one per line, and writes AS for table aliases", () => {
    expect(formatSql("SELECT o.id, c.name, o.amount FROM orders o JOIN customers c ON o.customer_id = c.id AND c.city = 'Lagos'")).toBe(
      [
        "SELECT",
        "    o.id,",
        "    c.name,",
        "    o.amount",
        "FROM orders AS o",
        "JOIN customers AS c",
        "    ON o.customer_id = c.id",
        "    AND c.city = 'Lagos';",
      ].join("\n"),
    );
  });

  it("puts extra AND and OR tests on their own lines, but keeps BETWEEN together", () => {
    expect(formatSql("SELECT * FROM products WHERE price BETWEEN 25 AND 50 AND category = 'Home' OR price < 5")).toBe(
      "SELECT *\nFROM products\nWHERE price BETWEEN 25 AND 50\n    AND category = 'Home'\n    OR price < 5;",
    );
  });

  it("lays out CASE, WITH, set operations and statements that change data", () => {
    expect(formatSql("SELECT id, CASE WHEN amount > 100 THEN 'large' ELSE 'small' END AS size FROM orders")).toBe(
      "SELECT\n    id,\n    CASE\n        WHEN amount > 100 THEN 'large'\n        ELSE 'small'\n    END AS size\nFROM orders;",
    );
    expect(formatSql("WITH big AS (SELECT * FROM orders WHERE amount > 100) SELECT * FROM big")).toBe(
      "WITH big AS (\n    SELECT *\n    FROM orders\n    WHERE amount > 100\n)\nSELECT *\nFROM big;",
    );
    expect(formatSql("SELECT city FROM customers UNION SELECT city FROM employees")).toBe(
      "SELECT city\nFROM customers\nUNION\nSELECT city\nFROM employees;",
    );
    expect(formatSql("create table notes (id integer primary key, body varchar not null)")).toBe(
      "CREATE TABLE notes (\n    id INTEGER PRIMARY KEY,\n    body VARCHAR NOT NULL\n);",
    );
    expect(formatSql("INSERT INTO notes VALUES (1, 'a'), (2, 'b'); UPDATE notes SET body = 'c' WHERE id = 1")).toBe(
      "INSERT INTO notes\nVALUES\n    (1, 'a'),\n    (2, 'b');\n\nUPDATE notes\nSET body = 'c'\nWHERE id = 1;",
    );
  });

  it("never fixes a typo, but still gives a misspelt clause its own line", () => {
    expect(formatSql("SELECT * FORM orders WHERE amount > 50", ids)).toBe("SELECT *\nFORM orders\nWHERE amount > 50;");
    expect(formatSql("SELECT name city FROM customers", ids)).toBe("SELECT name city\nFROM customers;");
  });

  it("leaves text with comments, and text it cannot read, as it was", () => {
    const commented = "SELECT * -- every column\nFROM orders";
    expect(formatSql(commented)).toBe(commented);
    expect(formatSql("SELECT 'unclosed")).toBe("SELECT 'unclosed");
    expect(formatSql("")).toBe("");
  });

  it("is stable: tidying a tidy query changes nothing", () => {
    for (const id of lessonOrder) {
      for (const sql of [lessons[id]!.goal.referenceSql, lessons[id]!.starterSql]) {
        const once = formatSql(sql, ids);
        expect(formatSql(once, ids), `${id}: ${sql}`).toBe(once);
      }
    }
  });

  it("never changes what a query means: every lesson's answer returns the same rows tidied", async () => {
    for (const id of lessonOrder) {
      const l = lessons[id]!;
      const tidy = formatSql(l.goal.referenceSql, ids);
      expect(sameQuery(tidy, l.goal.referenceSql), id).toBe(true);
      if (l.sandbox) continue;
      const [a, b] = [await runner.run(l.goal.referenceSql), await runner.run(tidy)];
      expect(b.error, id).toBeUndefined();
      expect(compareResults(tidy, b, a, l).ok, id).toBe(true);
    }
  });
});

describe("sameQuery", () => {
  it("ignores layout, capitals and AS, but not words or numbers", () => {
    expect(sameQuery("select * from orders o", "SELECT *\nFROM orders AS o;")).toBe(true);
    expect(sameQuery("SELECT * FROM orders", "SELECT * FROM orders;")).toBe(true);
    expect(sameQuery("SELECT * FROM orders WHERE amount > 50", "SELECT * FROM orders WHERE amount >= 50")).toBe(false);
    expect(sameQuery("SELECT * FROM orders WHERE city = 'Lagos'", "SELECT * FROM orders WHERE city = 'lagos'")).toBe(false);
  });
});
