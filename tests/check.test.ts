import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import { datasetIdentifiers } from "@/content/datasets/types";
import { filterLesson } from "@/content/lessons/filter";
import {
  checkAnswer,
  diagnose,
  expectedHint,
  locateErrorToken,
  parseCheck,
  runtimeError,
  type SqlError,
} from "@/engine/check";
import { lex } from "@/engine/lex";
import type { QueryRunner } from "@/engine/query-runner";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});

const ref = filterLesson.goal.referenceSql;
const identifiers = datasetIdentifiers(shop);

/** Parse, then run, exactly as the lesson does; returns the first error. */
async function errorFor(sql: string): Promise<SqlError | null> {
  const parsed = await parseCheck(sql, runner);
  if (parsed.kind !== "ok") return parsed;
  const res = await runner.run(sql);
  return res.error ? runtimeError(sql, res.error) : null;
}

async function pointAt(sql: string, withReference = true) {
  const error = await errorFor(sql);
  if (!error) throw new Error(`expected an error for: ${sql}`);
  const d = diagnose(sql, error, { identifiers, ...(withReference ? { referenceSql: ref } : {}) });
  const word = d.index >= 0 && d.index < d.tokens.length ? d.tokens[d.index]?.text : d.index === -1 ? "<all>" : "<end>";
  return { ...d, word, error };
}

describe("lex", () => {
  it("keeps offsets, strings and operators", () => {
    const t = lex("SELECT * FROM orders WHERE amount >= 50.5 AND name = 'O''Brien'");
    expect(t.map((x) => x.text)).toEqual([
      "SELECT", "*", "FROM", "orders", "WHERE", "amount", ">=", "50.5", "AND", "name", "=", "'O''Brien'",
    ]);
    expect(t[3]).toMatchObject({ start: 14, end: 20, kind: "word" });
    expect(lex("SELECT 'oops")[1]).toMatchObject({ kind: "string", unterminated: true });
  });
});

describe("parseCheck", () => {
  it("returns the AST for valid SQL, escaping quotes", async () => {
    expect((await parseCheck("SELECT * FROM customers WHERE name = 'Liam O''Brien'", runner)).kind).toBe("ok");
  });
  it("reports DuckDB's syntax error position", async () => {
    const r = await parseCheck("SELECT * FORM orders WHERE amount > 50", runner);
    expect(r).toMatchObject({ kind: "syntax", position: 14 });
  });
  it("blocks anything that is not a single SELECT", async () => {
    expect((await parseCheck("DROP TABLE orders", runner)).kind).toBe("blocked");
    expect((await parseCheck("SELECT 1; SELECT 2", runner)).kind).toBe("blocked");
  });
  it("treats an empty slip as empty", async () => {
    expect((await parseCheck("   ;  ", runner)).kind).toBe("empty");
  });
});

describe("error pointing", () => {
  it("keyword typo: circles FORM, not the word DuckDB flagged", async () => {
    const d = await pointAt("SELECT * FORM orders WHERE amount > 50");
    expect(d.word).toBe("FORM");
    expect(d.note).toBe("expected FROM");
  });

  it("keyword typo with a different-but-valid query still finds the typo", async () => {
    const d = await pointAt("select * form orders where 50 < amount");
    expect(d.word).toBe("form");
    expect(d.note).toBe("expected FROM");
  });

  it("keyword typo at the very start", async () => {
    const d = await pointAt("SELEC * FROM orders WHERE amount > 50");
    expect(d.word).toBe("SELEC");
    expect(d.note).toBe("expected SELECT");
  });

  it("missing keyword: FROM left out", async () => {
    const d = await pointAt("SELECT * orders WHERE amount > 50");
    expect(d.word).toBe("orders");
    expect(d.note).toBe("FROM goes before this");
  });

  it("unknown column: circles it and offers DuckDB's candidate", async () => {
    const d = await pointAt("SELECT * FROM orders WHERE amout > 50");
    expect(d.word).toBe("amout");
    expect(d.note).toBe("expected amount");
    const free = await pointAt("SELECT id FROM orders WHERE amout >= 10", false);
    expect(free.word).toBe("amout");
    expect(free.note).toBe("did you mean amount?");
    expect(free.message).toContain("no column called amout");
  });

  it("unknown table", async () => {
    const d = await pointAt("SELECT * FROM ordrs WHERE amount > 50");
    expect(d.word).toBe("ordrs");
    expect(d.note).toBe("expected orders");
  });

  it("missing operand: points past the end", async () => {
    const d = await pointAt("SELECT * FROM orders WHERE amount >");
    expect(d.word).toBe("<end>");
    expect(d.note).toBe("expected 50 next");
  });

  it("extra text after the query", async () => {
    const d = await pointAt("SELECT * FROM orders WHERE amount > 50 lol");
    expect(d.word).toBe("lol");
    expect(d.note).toBe("nothing more needed here");
  });

  it("unbalanced quote", async () => {
    const d = await pointAt("SELECT * FROM customers WHERE city = 'Lagos");
    expect(d.word).toBe("'Lagos");
    expect(d.note).toBe("close this quote");
  });

  it("falls back to the whole statement when nothing points anywhere", () => {
    const sql = "SELECT 1";
    const err: SqlError = { kind: "runtime", message: "something odd" };
    expect(locateErrorToken(sql, err)).toBe(-1);
    expect(expectedHint(sql, undefined, -1, err)).toBe("check this word");
  });

  it("reads the caret position from binder errors", () => {
    const raw = 'Binder Error: Referenced column "amout" not found in FROM clause!\n\nLINE 1: SELECT amout FROM orders\n               ^^^^^';
    expect(runtimeError("SELECT amout FROM orders", raw).position).toBe(7);
  });
});

describe("checkAnswer", () => {
  const pass = [
    "SELECT * FROM orders WHERE amount > 50",
    "select * from orders where amount > 50",
    "SELECT *\n  FROM   orders\n WHERE amount>50;",
    "SELECT * FROM orders WHERE 50 < amount",
    "SELECT id, customer_id, product_id, amount, order_date FROM orders WHERE amount > 50.0",
    "SELECT order_date, amount, product_id, customer_id, id FROM orders WHERE amount > 50 ORDER BY amount DESC",
    "SELECT * FROM orders WHERE NOT amount <= 50",
  ];
  it.each(pass)("accepts %s", async (sql) => {
    const r = await checkAnswer(sql, filterLesson, runner);
    expect(r.ok).toBe(true);
  });

  it(">= returns more rows and gets a boundary hint", async () => {
    const r = await checkAnswer("SELECT * FROM orders WHERE amount >= 50", filterLesson, runner);
    expect(r).toMatchObject({ ok: false, reason: "wrong row count" });
    if (!r.ok) {
      expect(r.hint).toContain("exactly 50");
      expect(r.hint).not.toContain("amount > 50");
    }
  });

  it("missing and extra columns", async () => {
    expect(await checkAnswer("SELECT id FROM orders WHERE amount > 50", filterLesson, runner)).toMatchObject({
      ok: false,
      reason: "missing column",
    });
    expect(
      await checkAnswer("SELECT *, amount * 2 AS doubled FROM orders WHERE amount > 50", filterLesson, runner),
    ).toMatchObject({ ok: false, reason: "extra column" });
  });

  it("same count, different rows", async () => {
    const r = await checkAnswer(
      "SELECT * FROM orders WHERE amount > 50 AND id <> 1 UNION ALL SELECT * FROM orders WHERE id = 2",
      filterLesson,
      runner,
    );
    expect(r).toMatchObject({ ok: false, reason: "rows differ" });
  });

  it("rows-ordered lessons notice the order", async () => {
    const ordered = {
      goal: { description: "", referenceSql: "SELECT * FROM orders ORDER BY amount DESC, id", compare: "rows-ordered" as const },
    };
    expect(await checkAnswer("SELECT * FROM orders ORDER BY amount ASC, id", ordered, runner)).toMatchObject({
      ok: false,
      reason: "wrong order",
    });
    expect((await checkAnswer("select * from orders order by amount desc, id", ordered, runner)).ok).toBe(true);
  });

  it("an empty query or an error is not an answer", async () => {
    expect(await checkAnswer("", filterLesson, runner)).toMatchObject({ ok: false, reason: "error" });
    expect(await checkAnswer("SELECT * FORM orders", filterLesson, runner)).toMatchObject({ ok: false, reason: "error" });
  });
});
