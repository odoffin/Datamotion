import { beforeAll, describe, expect, it } from "vitest";
import { shop } from "@/content/datasets/shop";
import type { QueryRunner } from "@/engine/query-runner";
import { guardSandbox, runInSandbox, sandboxError, splitStatements } from "@/engine/sandbox";
import { createNodeRunner } from "./node-runner";

let runner: QueryRunner;
beforeAll(async () => {
  runner = await createNodeRunner(shop);
});

describe("splitStatements", () => {
  it("splits on semicolons outside quotes and keeps offsets", () => {
    const sql = "CREATE TABLE t (a VARCHAR); INSERT INTO t VALUES ('a;b')";
    const parts = splitStatements(sql)!;
    expect(parts.map((p) => p.text)).toEqual(["CREATE TABLE t (a VARCHAR)", "INSERT INTO t VALUES ('a;b')"]);
    expect(sql.slice(parts[1]!.start, parts[1]!.start + 6)).toBe("INSERT");
  });
  it("refuses an unclosed quote", () => {
    expect(splitStatements("INSERT INTO t VALUES ('oops)")).toBeNull();
  });
});

describe("guardSandbox", () => {
  it("allows changing data, several statements at once", () => {
    expect(guardSandbox("CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1); UPDATE t SET id = 2").ok).toBe(true);
    expect(guardSandbox("EXPLAIN SELECT * FROM orders").ok).toBe(true);
  });
  it("never lets a lesson end or escape the sandbox's transaction", () => {
    for (const sql of ["COMMIT", "BEGIN TRANSACTION", "INSERT INTO t VALUES (1); COMMIT", "ATTACH 'x.db'", "PRAGMA version", "SET threads = 1", "COPY orders TO 'x.csv'"]) {
      expect(guardSandbox(sql).ok, sql).toBe(false);
    }
  });
  it("does not mistake SET inside UPDATE, or words inside text, for forbidden statements", () => {
    expect(guardSandbox("UPDATE products SET price = 30 WHERE id = 5").ok).toBe(true);
    expect(guardSandbox("INSERT INTO notes VALUES (1, 'commit the changes')").ok).toBe(true);
  });
});

describe("runInSandbox", () => {
  it("runs on a fresh copy and leaves the shared tables untouched", async () => {
    const statements = splitStatements("DELETE FROM orders; CREATE TABLE notes (id INTEGER)")!;
    const run = await runInSandbox(runner, { check: "SELECT COUNT(*) AS n FROM orders" }, statements);
    expect(run.ok && run.result.rows[0]?.[0]).toBe(0);
    expect((await runner.run("SELECT COUNT(*) FROM orders")).rows[0]?.[0]).toBe(40);
    expect((await runner.run("SELECT * FROM notes")).error).toBeTruthy();
  });
  it("rolls back after an error too, and points at the failing statement", async () => {
    const sql = "DELETE FROM orders;\nCREATE TABEL x (id INTEGER)";
    const run = await runInSandbox(runner, {}, splitStatements(sql)!);
    expect(run.ok).toBe(false);
    if (!run.ok) {
      const error = sandboxError(sql, run);
      expect(sql.slice(error.position, (error.position ?? 0) + 5)).toBe("TABEL");
    }
    expect((await runner.run("SELECT COUNT(*) FROM orders")).rows[0]?.[0]).toBe(40);
  });
});
