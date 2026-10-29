import { DuckDBInstance } from "@duckdb/node-api";
import type { Dataset } from "@/content/datasets/types";
import { normalizeValue, type QueryRunner } from "@/engine/query-runner";
import { datasetStatements } from "@/engine/sql";

/** Test-only QueryRunner backed by the native Node DuckDB package. */
export async function createNodeRunner(dataset: Dataset): Promise<QueryRunner> {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  for (const sql of datasetStatements(dataset)) await conn.run(sql);
  return {
    async run(sql) {
      try {
        const start = performance.now();
        const reader = await conn.runAndReadAll(sql);
        const ms = performance.now() - start;
        return {
          columns: reader.columnNames(),
          rows: reader.getRowsJS().map((row) => row.map(normalizeValue)),
          ms,
        };
      } catch (err) {
        return { columns: [], rows: [], ms: 0, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
