import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { createProgressStore, lessonProgress, PROGRESS_KEY, safeStorage } from "@/store/progress";

function memoryStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: StateStorage = {
  getItem: () => {
    throw new Error("SecurityError: storage is blocked");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

describe("progress store", () => {
  it("records attempts, hints, approval and done", () => {
    const store = createProgressStore(memoryStorage());
    const s = store.getState();
    s.openLesson("filter");
    s.recordAttempt("filter");
    s.recordAttempt("filter");
    s.recordHint("filter");
    s.recordApproved("filter", "mastered");
    s.markDone("filter", new Date("2026-10-29T12:00:00Z"));
    const p = lessonProgress(store.getState(), "filter");
    expect(p).toEqual({
      status: "done",
      attempts: 2,
      approved: true,
      completion: "mastered",
      hintsUsed: 1,
      finishedAt: "2026-10-29T12:00:00.000Z",
    });
    expect(store.getState().lastLessonId).toBe("filter");
  });

  it("undo: bringing the code back makes the lesson in progress again", () => {
    const store = createProgressStore(memoryStorage());
    store.getState().markDone("filter");
    store.getState().undoDone("filter");
    expect(lessonProgress(store.getState(), "filter")).toMatchObject({ status: "in progress", finishedAt: null });
  });

  it("revealed stays revealed, not mastered, even after a later clean run", () => {
    const store = createProgressStore(memoryStorage());
    store.getState().recordApproved("filter", "revealed");
    store.getState().recordApproved("filter", "mastered");
    expect(lessonProgress(store.getState(), "filter").completion).toBe("revealed");
  });

  it("persists under dm.progress.v1 and reloads", async () => {
    const storage = memoryStorage();
    const a = createProgressStore(storage);
    await a.persist.rehydrate();
    a.getState().markDone("filter");
    a.getState().savePlacement(["correct", "wrong"], 2, [1]);
    expect(storage.data.has(PROGRESS_KEY)).toBe(true);
    const b = createProgressStore(storage);
    await b.persist.rehydrate();
    expect(lessonProgress(b.getState(), "filter").status).toBe("done");
    expect(b.getState().placement?.recommended).toBe(2);
    expect(b.getState().knownChapters).toEqual([1]);
  });

  it("persistence failure: blocked storage never throws and the store still works", async () => {
    const store = createProgressStore(safeStorage(() => throwing));
    await expect(store.persist.rehydrate()).resolves.not.toThrow();
    expect(() => store.getState().markDone("filter")).not.toThrow();
    expect(lessonProgress(store.getState(), "filter").status).toBe("done");
  });

  it("persistence failure: no storage at all (server, or window.localStorage throws on access)", async () => {
    const store = createProgressStore(
      safeStorage(() => {
        throw new Error("SecurityError: localStorage is not available");
      }),
    );
    await store.persist.rehydrate();
    store.getState().openLesson("filter");
    expect(lessonProgress(store.getState(), "filter").status).toBe("in progress");
  });

  it("a fresh learner has nothing started", () => {
    const store = createProgressStore(memoryStorage());
    expect(lessonProgress(store.getState(), "filter").status).toBe("not started");
    expect(store.getState().placement).toBeNull();
  });
});
