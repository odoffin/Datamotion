import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHECKER_TIMEOUT_MS, loadChecker, type CheckerHandle } from "@/engine/checker-loader";
import type { QueryRunner } from "@/engine/query-runner";

const runner: QueryRunner = { run: () => Promise.resolve({ columns: [], rows: [], ms: 0 }) };

describe("loadChecker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps the download at 12 seconds", () => {
    expect(CHECKER_TIMEOUT_MS).toBe(12_000);
  });

  it("a slow connection falls back exactly like offline, and the download is aborted", async () => {
    let signal: AbortSignal | undefined;
    // Never resolves: a connection so slow the extension never arrives.
    const result = loadChecker((s) => {
      signal = s;
      return new Promise<CheckerHandle>(() => {});
    });
    await vi.advanceTimersByTimeAsync(CHECKER_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toMatchObject({ ok: false, reason: "timeout" });
    expect(signal?.aborted).toBe(true);
  });

  it("a checker that arrives after the deadline is ignored", async () => {
    let finish: (h: CheckerHandle) => void = () => {};
    const result = loadChecker(() => new Promise<CheckerHandle>((r) => (finish = r)));
    await vi.advanceTimersByTimeAsync(CHECKER_TIMEOUT_MS);
    finish({ runner });
    await expect(result).resolves.toMatchObject({ ok: false, reason: "timeout" });
  });

  it("offline (the download fails) gives the same fallback, without waiting", async () => {
    const result = loadChecker(() => Promise.reject(new Error("Failed to fetch")));
    await expect(result).resolves.toMatchObject({ ok: false, reason: "error", error: "Failed to fetch" });
  });

  it("a checker that loads in time is used", async () => {
    const result = loadChecker(
      () => new Promise<CheckerHandle>((r) => setTimeout(() => r({ runner }), CHECKER_TIMEOUT_MS - 100)),
    );
    await vi.advanceTimersByTimeAsync(CHECKER_TIMEOUT_MS - 100);
    await expect(result).resolves.toEqual({ ok: true, runner });
  });
});
