import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { explainSql } from "@/engine/explain";
import { inPlainWords, piecesOf } from "@/engine/pieces";
import type { QueryRunner } from "@/engine/query-runner";
import { createNodeRunner } from "./node-runner";

const meaning = (sql: string, text: string) =>
  piecesOf(sql, { tables: shop.tables })
    .flatMap((l) => l.pieces)
    .find((p) => p.text === text)?.meaning;

describe("piecesOf", () => {
  it("explains every word and mark, line by line, in plain words", () => {
    const sql = "SELECT *\nFROM customers\nWHERE city = 'Lagos';";
    const lines = piecesOf(sql, { tables: shop.tables });
    expect(lines.map((l) => l.code)).toEqual(["SELECT *", "FROM customers", "WHERE city = 'Lagos';"]);
    expect(meaning(sql, "*")).toBe("every column");
    expect(meaning(sql, "customers")).toBe("the customers table");
    expect(meaning(sql, "city")).toBe("the city column");
    expect(meaning(sql, ";")).toMatch(/full stop/);
    expect(meaning(sql, "'Lagos'")).toMatch(/quote marks show where the text starts and stops/);
  });

  it("tells tables, short names, new names and columns apart", () => {
    const sql = "SELECT o.id, COUNT(*) AS orders\nFROM orders AS o\nGROUP BY o.id;";
    expect(meaning(sql, "o.id")).toBe("the id column of the table called o");
    expect(meaning(sql, "orders")).toBe("a new name for this column: orders");
    expect(meaning(sql, "o")).toBe("a short name for the orders table");
    expect(meaning(sql, "COUNT")).toBe("count");
    expect(meaning(sql, "GROUP BY")).toMatch(/same group/);
  });

  it("never throws on broken text", () => {
    for (const sql of ["", "SELECT (", "'unclosed", "SELECT * FORM orders;"]) expect(() => piecesOf(sql)).not.toThrow();
  });
});

describe("inPlainWords", () => {
  it("joins the first sentence of each step into one", () => {
    expect(inPlainWords(["Start with the orders table.", "Keep a row only if amount is more than 50.", "Show every column."])).toBe(
      "Start with the orders table, then keep a row only if amount is more than 50, then show every column.",
    );
  });
});

describe("SELECT keeps", () => {
  let runner: QueryRunner;
  beforeAll(async () => {
    runner = await createNodeRunner(shop);
  });
  const keeps = async (sql: string) => (await explainSql(sql, { runner, tables: shop.tables })).steps.find((s) => s.label?.startsWith("SELECT"))?.keeps;

  it("lists the columns a plain SELECT keeps, and nothing for totals or DISTINCT", async () => {
    expect(await keeps("SELECT name, city FROM customers")).toEqual(["name", "city"]);
    expect(await keeps("SELECT * FROM orders")).toEqual(["*"]);
    expect(await keeps("SELECT o.id, c.name AS customer FROM orders o JOIN customers c ON o.customer_id = c.id")).toEqual(["o.id", "c.name"]);
    expect(await keeps("SELECT COUNT(*) FROM orders")).toBeUndefined();
    expect(await keeps("SELECT DISTINCT city FROM customers")).toBeUndefined();
  });
});
