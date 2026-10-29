import type { QueryRunner } from "./query-runner";

/** How long the checker may take to download before the lesson moves on without it. */
export const CHECKER_TIMEOUT_MS = 12_000;

export interface CheckerHandle {
  runner: QueryRunner;
}

export type CheckerLoad =
  | { ok: true; runner: QueryRunner }
  | { ok: false; reason: "timeout" | "error"; error: string };

/**
 * Starts the query checker with a hard deadline. A slow connection then
 * behaves exactly like an offline one: after `timeoutMs` the start is aborted
 * (the browser implementation terminates its worker, which cancels the
 * download) and the lesson continues without the checker. Never throws.
 */
export function loadChecker(
  start: (signal: AbortSignal) => Promise<CheckerHandle>,
  timeoutMs: number = CHECKER_TIMEOUT_MS,
): Promise<CheckerLoad> {
  const controller = new AbortController();
  return new Promise<CheckerLoad>((resolve) => {
    const timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, reason: "timeout", error: `The checker took longer than ${timeoutMs / 1000} seconds to load.` });
    }, timeoutMs);
    start(controller.signal).then(
      (handle) => {
        clearTimeout(timer);
        // A start that finishes after the deadline is ignored (already aborted).
        resolve({ ok: true, runner: handle.runner });
      },
      (err: unknown) => {
        clearTimeout(timer);
        resolve({ ok: false, reason: "error", error: err instanceof Error ? err.message : String(err) });
      },
    );
  });
}
