/** Normalised result shape shared by every runner (browser and tests). */
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  ms: number;
  error?: string;
}

/**
 * The only thing the engine and scene builders depend on. The browser uses
 * duckdb-wasm; tests use the Node DuckDB package. Implementations must not
 * throw: failures come back as `error`.
 */
export interface QueryRunner {
  run(sql: string): Promise<QueryResult>;
}

/** Converts driver-specific values (bigint, Date) into plain JSON-ish values. */
export function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}
