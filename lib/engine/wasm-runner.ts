import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { Field, Table } from "apache-arrow";
import { normalizeValue, type QueryResult, type QueryRunner } from "@/engine/query-runner";

let connection: Promise<AsyncDuckDBConnection> | null = null;

/**
 * Boots duckdb-wasm once from its jsDelivr bundles inside its own Web Worker,
 * so query work never blocks the main thread. Browser only.
 */
function connect(): Promise<AsyncDuckDBConnection> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DuckDB can only run in the browser."));
  }
  connection ??= (async () => {
    const duckdb = await import("@duckdb/duckdb-wasm");
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    if (!bundle.mainWorker) throw new Error("No DuckDB worker bundle available.");
    // Cross-origin workers aren't allowed, so bootstrap via a same-origin blob.
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      }),
    );
    const worker = new Worker(workerUrl);
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);
    const conn = await db.connect();
    // Sandbox: no reading local files or URLs (read_csv('https://…') etc.).
    await conn.query("SET enable_external_access = false");
    return conn;
  })();
  connection.catch(() => {
    connection = null; // allow a retry after a failed boot
  });
  return connection;
}

async function arrowCellConverter(field: Field): Promise<(v: unknown) => unknown> {
  const { DataType } = await import("apache-arrow");
  if (DataType.isDate(field.type)) {
    return (v) =>
      typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : normalizeValue(v);
  }
  if (DataType.isTimestamp(field.type)) {
    return (v) => (typeof v === "number" ? new Date(v).toISOString() : normalizeValue(v));
  }
  if (DataType.isDecimal(field.type)) {
    const scale = field.type.scale;
    // TODO: arrow 17 returns decimals as scaled big-number views; this loses
    // precision past ~15 significant digits, which is fine for lesson data.
    return (v) => (v == null ? null : Number(String(v)) / 10 ** scale);
  }
  return normalizeValue;
}

async function tableToResult(table: Table, ms: number): Promise<QueryResult> {
  const fields = table.schema.fields;
  const converters = await Promise.all(fields.map(arrowCellConverter));
  const vectors = fields.map((_, c) => table.getChildAt(c));
  const rows: unknown[][] = [];
  for (let r = 0; r < table.numRows; r++) {
    rows.push(vectors.map((vec, c) => converters[c]!(vec?.get(r) ?? null)));
  }
  return { columns: fields.map((f) => f.name), rows, ms };
}

export const wasmRunner: QueryRunner = {
  async run(sql) {
    try {
      const conn = await connect();
      const start = performance.now();
      const table = await conn.query(sql);
      return await tableToResult(table, performance.now() - start);
    } catch (err) {
      return {
        columns: [],
        rows: [],
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
