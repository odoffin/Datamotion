import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Answer } from "@/lib/placement";
import type { Completion } from "@/lib/lesson-status";
import { markStorageBlocked } from "@/lib/storage-health";

export const PROGRESS_KEY = "dm.progress.v1";

export type LessonStatus = "not started" | "in progress" | "done";

export interface LessonProgress {
  status: LessonStatus;
  /** Every run of the query, right or wrong. */
  attempts: number;
  /** A run matched the goal at least once. */
  approved: boolean;
  /** mastered, or revealed if the answer was shown first (never upgraded by luck). */
  completion: Completion | null;
  hintsUsed: number;
  /** ISO time the lesson was finished (the code faded), if it is done. */
  finishedAt: string | null;
}

export interface PlacementResult {
  answers: Answer[];
  recommended: number;
  takenAt: string;
}

export interface ProgressData {
  lessons: Record<string, LessonProgress>;
  placement: PlacementResult | null;
  /**
   * Chapters whose quiz question was answered correctly: they "looked
   * familiar in the quiz". One right answer is not mastery. (The field keeps
   * its original name so saved progress still loads.)
   */
  knownChapters: number[];
  lastLessonId: string | null;
}

interface ProgressActions {
  openLesson: (id: string) => void;
  recordAttempt: (id: string) => void;
  recordHint: (id: string) => void;
  recordApproved: (id: string, completion: Completion) => void;
  /** Finishing (the fade). Stays done: bringing the code back to look again does not undo it. */
  markDone: (id: string, at?: Date) => void;
  savePlacement: (answers: Answer[], recommended: number, known: number[], at?: Date) => void;
  reset: () => void;
}

export type ProgressState = ProgressData & ProgressActions;

const empty = (): ProgressData => ({ lessons: {}, placement: null, knownChapters: [], lastLessonId: null });

const blank = (): LessonProgress => ({
  status: "not started",
  attempts: 0,
  approved: false,
  completion: null,
  hintsUsed: 0,
  finishedAt: null,
});

/**
 * localStorage, but every access is wrapped: in private windows or with
 * blocked storage, reads return nothing and writes are dropped, and the app
 * keeps working for the session. Any failure is reported so the UI can say
 * that progress will not be kept.
 */
export function safeStorage(get: () => StateStorage | undefined): StateStorage {
  return {
    getItem: (name) => {
      try {
        return get()?.getItem(name) ?? null;
      } catch {
        markStorageBlocked();
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        get()?.setItem(name, value);
      } catch {
        // Storage full or blocked: progress lives only in memory this session.
        markStorageBlocked();
      }
    },
    removeItem: (name) => {
      try {
        get()?.removeItem(name);
      } catch {
        markStorageBlocked();
      }
    },
  };
}

const browserStorage = () => (typeof window === "undefined" ? undefined : window.localStorage);

export function createProgressStore(storage: StateStorage = safeStorage(browserStorage)) {
  return create<ProgressState>()(
    persist(
      (set) => {
        const update = (id: string, change: (p: LessonProgress) => Partial<LessonProgress>) =>
          set((s) => {
            const current = s.lessons[id] ?? blank();
            return { lessons: { ...s.lessons, [id]: { ...current, ...change(current) } } };
          });
        return {
          ...empty(),
          openLesson: (id) => {
            update(id, (p) => ({ status: p.status === "not started" ? "in progress" : p.status }));
            set({ lastLessonId: id });
          },
          recordAttempt: (id) =>
            update(id, (p) => ({ attempts: p.attempts + 1, status: p.status === "not started" ? "in progress" : p.status })),
          recordHint: (id) => update(id, (p) => ({ hintsUsed: p.hintsUsed + 1 })),
          recordApproved: (id, completion) =>
            update(id, (p) => ({
              approved: true,
              // Once revealed, a later clean run does not turn it into mastery.
              completion: p.completion === "revealed" ? "revealed" : completion,
            })),
          // The first finish is the one that counts; finishing again keeps that date.
          markDone: (id, at = new Date()) =>
            update(id, (p) => ({ status: "done", finishedAt: p.finishedAt ?? at.toISOString() })),
          savePlacement: (answers, recommended, known, at = new Date()) =>
            set({ placement: { answers, recommended, takenAt: at.toISOString() }, knownChapters: known }),
          reset: () => set(empty()),
        };
      },
      {
        name: PROGRESS_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: (s): ProgressData => ({
          lessons: s.lessons,
          placement: s.placement,
          knownChapters: s.knownChapters,
          lastLessonId: s.lastLessonId,
        }),
        // Read storage only after hydration, so server and first client render match.
        skipHydration: true,
      },
    ),
  );
}

export const useProgress = createProgressStore();

export function lessonProgress(state: ProgressData, id: string): LessonProgress {
  return state.lessons[id] ?? blank();
}

/**
 * Runs a progress write once saved progress has been read, so loading it
 * later can never overwrite something the learner just did.
 */
export function whenProgressReady(write: (s: ProgressState) => void): void {
  if (useProgress.persist.hasHydrated()) write(useProgress.getState());
  else void Promise.resolve(useProgress.persist.rehydrate()).then(() => write(useProgress.getState()));
}
