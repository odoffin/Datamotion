import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preflight, PREFLIGHT_TIMEOUT_MS } from "@/engine/preflight";

const urls = ["/duckdb/x/duckdb-eh.wasm", "/duckdb/x/duckdb-browser-eh.worker.js"];

describe("engine preflight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports within 5 seconds", () => {
    expect(PREFLIGHT_TIMEOUT_MS).toBe(5_000);
  });

  it("passes when every file answers", async () => {
    const methods: string[] = [];
    const fetcher = (_: string, init: { method: string }) => {
      methods.push(init.method);
      return Promise.resolve({ ok: true, status: 200 });
    };
    await expect(preflight(urls, fetcher)).resolves.toEqual({ ok: true });
    expect(methods).toEqual(["HEAD", "HEAD"]);
  });

  it("fails at once on a missing file", async () => {
    const fetcher = (url: string) => Promise.resolve(url.endsWith(".wasm") ? { ok: false, status: 404 } : { ok: true, status: 200 });
    await expect(preflight(urls, fetcher)).resolves.toEqual({ ok: false, reason: "HTTP 404 for /duckdb/x/duckdb-eh.wasm" });
  });

  it("fails at once when the network refuses (offline, blocked)", async () => {
    const fetcher = () => Promise.reject(new TypeError("Failed to fetch"));
    await expect(preflight(urls, fetcher)).resolves.toEqual({ ok: false, reason: "Failed to fetch" });
  });

  it("gives up after 5 seconds when nothing answers", async () => {
    let signal: AbortSignal | undefined;
    const fetcher = (_: string, init: { signal: AbortSignal }) => {
      signal = init.signal;
      return new Promise<{ ok: boolean; status: number }>((_, reject) =>
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
      );
    };
    const result = preflight(urls, fetcher);
    await vi.advanceTimersByTimeAsync(PREFLIGHT_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: false, reason: "No response within 5 seconds" });
  });
});
