import type { Dataset } from "@/content/datasets/types";
import { loadChecker, type CheckerLoad } from "@/engine/checker-loader";
import type { QueryResult, QueryRunner } from "@/engine/query-runner";
import { datasetStatements } from "@/engine/sql";
import { friendlyError, guardReadOnly } from "@/engine/sql-guard";
import { startWasmChecker, wasmRunner } from "./wasm-runner";

export type RunQueryResult = QueryResult;

const loaded = new Map<string, Promise<string | null>>();

/**
 * Creates the dataset's tables in the browser database (once per dataset).
 * Resolves to an error message, or null on success. Never throws.
 */
export function loadDataset(dataset: Dataset): Promise<string | null> {
  let pending = loaded.get(dataset.id);
  if (!pending) {
    pending = (async () => {
      for (const sql of datasetStatements(dataset)) {
        const res = await wasmRunner.run(sql);
        if (res.error) {
          loaded.delete(dataset.id);
          return `Couldn't load the ${dataset.title} dataset: ${friendlyError(res.error)}`;
        }
      }
      return null;
    })();
    loaded.set(dataset.id, pending);
  }
  return pending;
}

let checker: Promise<CheckerLoad> | null = null;

/**
 * Loads the query checker once, giving up after 12 seconds so a slow
 * connection behaves like an offline one. Never throws.
 */
export function prepareChecker(): Promise<CheckerLoad> {
  checker ??= loadChecker(startWasmChecker);
  return checker;
}

/** The checker's runner, or null when it is not (or not yet) available. */
export async function checkerRunner(): Promise<QueryRunner | null> {
  const c = await (checker ?? Promise.resolve(null));
  return c?.ok ? c.runner : null;
}

/** Runs one read-only learner query. Errors come back as `error`, never thrown. */
export async function runQuery(sql: string): Promise<RunQueryResult> {
  const guard = guardReadOnly(sql);
  if (!guard.ok) return { columns: [], rows: [], ms: 0, error: guard.error };
  const res = await wasmRunner.run(guard.sql);
  return res.error ? { ...res, error: friendlyError(res.error) } : res;
}

/** The trusted runner for engine-built (instrumented) queries. */
export const engineRunner = wasmRunner;
