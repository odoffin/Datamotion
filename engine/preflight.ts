/** How long the quick reachability check may take before the database is reported as unable to start. */
export const PREFLIGHT_TIMEOUT_MS = 5_000;

export type PreflightResult = { ok: true } | { ok: false; reason: string };

type Fetcher = (url: string, init: { method: "HEAD"; signal: AbortSignal; cache: RequestCache }) => Promise<{ ok: boolean; status: number }>;

/**
 * Checks that the engine files can be reached before the worker starts. A
 * failed or very slow download otherwise only surfaces after the 30 s
 * backstop. HEAD requests are cheap: no body is transferred.
 */
export async function preflight(
  urls: readonly string[],
  fetcher: Fetcher,
  timeoutMs: number = PREFLIGHT_TIMEOUT_MS,
): Promise<PreflightResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const responses = await Promise.all(
      urls.map((url) => fetcher(url, { method: "HEAD", signal: controller.signal, cache: "no-store" })),
    );
    const bad = responses.findIndex((r) => !r.ok);
    return bad === -1 ? { ok: true } : { ok: false, reason: `HTTP ${responses[bad]!.status} for ${urls[bad]}` };
  } catch (err) {
    return {
      ok: false,
      reason: controller.signal.aborted
        ? `No response within ${timeoutMs / 1000} seconds`
        : err instanceof Error
          ? err.message
          : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
