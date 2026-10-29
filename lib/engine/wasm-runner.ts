import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { Field, Table } from "apache-arrow";
import type { CheckerHandle } from "@/engine/checker-loader";
import { preflight } from "@/engine/preflight";
import { normalizeValue, type QueryResult, type QueryRunner } from "@/engine/query-runner";
import assets from "./duckdb-assets.json";

interface Instance {
  db: AsyncDuckDB;
  conn: AsyncDuckDBConnection;
  worker: Worker;
}

/** Where the build step (scripts/copy-duckdb-assets.mjs) puts the engine: our own origin. */
const ASSET_BASE = `/duckdb/${assets.duckdbWasm}`;

/** Our own mirror of the extension repository, laid out as DuckDB expects: <repo>/<version>/<platform>/<name>. */
export const EXTENSION_REPOSITORY_PATH = "/duckdb/extensions";

/**
 * Boots one duckdb-wasm instance, served from our own origin, inside its own
 * Web Worker so query work never blocks the main thread. Browser only.
 */
async function bootInstance(signal?: AbortSignal): Promise<Instance> {
  if (typeof window === "undefined") throw new Error("DuckDB can only run in the browser.");
  const duckdb = await import("@duckdb/duckdb-wasm");
  const url = (name: string) => new URL(`${ASSET_BASE}/${name}`, window.location.origin).href;
  // selectBundle picks the exception-handling build when the browser supports it, else MVP.
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: url(assets.bundles.mvp.module), mainWorker: url(assets.bundles.mvp.worker) },
    eh: { mainModule: url(assets.bundles.eh.module), mainWorker: url(assets.bundles.eh.worker) },
  });
  if (!bundle.mainWorker) throw new Error("No DuckDB worker bundle available.");
  // Fail fast: a worker whose files cannot load only times out after 30 s.
  const reachable = await preflight([bundle.mainModule, bundle.mainWorker], (u, init) => fetch(u, init));
  if (!reachable.ok) throw new Error(`The database files could not be downloaded (${reachable.reason}).`);
  // Same origin, so the worker loads directly (no blob: URL needed under the CSP).
  const worker = new Worker(bundle.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  // Backstop: if a download still stalls after the preflight, instantiate()
  // never settles on its own. Fail instead of hanging.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failed = new Promise<never>((_, reject) => {
    worker.addEventListener("error", () => reject(new Error("The database worker could not load.")), { once: true });
    timer = setTimeout(() => reject(new Error("The database took too long to start.")), 30_000);
  });
  try {
    await Promise.race([db.instantiate(bundle.mainModule, bundle.pthreadWorker), failed]);
  } catch (err) {
    worker.terminate();
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (signal?.aborted) {
    worker.terminate();
    throw new Error("Aborted.");
  }
  return { db, conn: await db.connect(), worker };
}

let main: Promise<AsyncDuckDBConnection> | null = null;

/**
 * The learner's database. Locked straight away: no reading local files or URLs
 * (read_csv('https://…') etc.). Nothing here waits for the checker.
 */
function connect(): Promise<AsyncDuckDBConnection> {
  main ??= (async () => {
    const { conn } = await bootInstance();
    await conn.query("SET enable_external_access = false");
    return conn;
  })();
  main.catch(() => {
    main = null; // allow a retry after a failed boot
  });
  return main;
}

/**
 * The query checker: a separate, small instance that only ever parses the
 * learner's text with json_serialize_sql and never runs it. It lives in its
 * own worker because duckdb-wasm downloads extensions synchronously inside
 * the worker; terminating that worker is the only way to cancel a slow
 * download without stalling the learner's database.
 */
export async function startWasmChecker(signal: AbortSignal): Promise<CheckerHandle> {
  const instance = await bootInstance(signal);
  const stop = () => instance.worker.terminate();
  signal.addEventListener("abort", stop, { once: true });
  // Fetch the json extension from our own mirror, not extensions.duckdb.org.
  const repository = new URL(EXTENSION_REPOSITORY_PATH, window.location.origin).href;
  await instance.conn.query(`SET custom_extension_repository = '${repository.replaceAll("'", "''")}'`);
  await instance.conn.query("LOAD json");
  if (signal.aborted) throw new Error("Aborted.");
  // Parsing needs no file or network access either.
  await instance.conn.query("SET enable_external_access = false");
  return { runner: runnerFor(() => Promise.resolve(instance.conn)) };
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

function runnerFor(getConn: () => Promise<AsyncDuckDBConnection>): QueryRunner {
  return {
    async run(sql) {
      try {
        const conn = await getConn();
        const start = performance.now();
        const table = await conn.query(sql);
        return await tableToResult(table, performance.now() - start);
      } catch (err) {
        return { columns: [], rows: [], ms: 0, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}

export const wasmRunner: QueryRunner = runnerFor(connect);
