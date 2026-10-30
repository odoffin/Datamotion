import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTRO_SCRIPT, OUTRO_BY_MS, OUTRO_MS, SEEN_KEY, SKIP_MS } from "@/components/landing/intro-script";

type Listener = () => void;

/** Runs the inline intro script against a fake page and reports what it did. */
function runIntro(opts: { reducedMotion?: boolean; seen?: boolean; storageBlocked?: boolean; loaded?: boolean } = {}) {
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Set<Listener>>();
  const stored = new Map<string, string>(opts.seen ? [[SEEN_KEY, "1"]] : []);
  const blocked = () => {
    throw new Error("SecurityError");
  };
  const page = {
    document: {
      readyState: opts.loaded ? "complete" : "loading",
      documentElement: {
        setAttribute: (k: string, v: string) => void attrs.set(k, v),
        removeAttribute: (k: string) => void attrs.delete(k),
      },
    },
    matchMedia: () => ({ matches: !!opts.reducedMotion }),
    sessionStorage: opts.storageBlocked
      ? { getItem: blocked, setItem: blocked }
      : { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => void stored.set(k, v) },
    addEventListener: (type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: Listener) => void listeners.get(type)?.delete(fn),
  };
  new Function(...Object.keys(page), INTRO_SCRIPT)(...Object.values(page));
  return {
    state: () => attrs.get("data-intro") ?? null,
    stored,
    fire: (type: string) => [...(listeners.get(type) ?? [])].forEach((fn) => fn()),
  };
}

describe("loading intro script", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does nothing with reduced motion", () => {
    expect(runIntro({ reducedMotion: true }).state()).toBeNull();
  });

  it("plays once per session", () => {
    const first = runIntro();
    expect(first.state()).toBe("on");
    expect(first.stored.get(SEEN_KEY)).toBe("1");
    expect(runIntro({ seen: true }).state()).toBeNull();
  });

  it("still plays (every load) when storage is blocked", () => {
    expect(runIntro({ storageBlocked: true }).state()).toBe("on");
  });

  it("holds for at least 1.5s even when the page has already loaded", () => {
    const intro = runIntro({ loaded: true });
    vi.advanceTimersByTime(1500 - OUTRO_MS - 1);
    expect(intro.state()).toBe("on");
    vi.advanceTimersByTime(1);
    expect(intro.state()).toBe("lift");
    vi.advanceTimersByTime(OUTRO_MS);
    expect(intro.state()).toBeNull();
  });

  it("ends when the page loads", () => {
    const intro = runIntro();
    vi.advanceTimersByTime(1200);
    expect(intro.state()).toBe("on");
    intro.fire("load");
    vi.advanceTimersByTime(0);
    expect(intro.state()).toBe("lift");
  });

  it("is gone by 4s if the page never loads", () => {
    const intro = runIntro();
    vi.advanceTimersByTime(OUTRO_BY_MS);
    expect(intro.state()).toBe("lift");
    vi.advanceTimersByTime(OUTRO_MS);
    expect(intro.state()).toBeNull();
    expect(OUTRO_BY_MS + OUTRO_MS).toBe(4000);
  });

  it("skips on any key or click", () => {
    for (const type of ["keydown", "pointerdown"]) {
      const intro = runIntro();
      intro.fire(type);
      expect(intro.state()).toBe("skip");
      vi.advanceTimersByTime(SKIP_MS);
      expect(intro.state()).toBeNull();
    }
  });
});
