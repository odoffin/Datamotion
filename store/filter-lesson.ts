import { create } from "zustand";
import { datasets } from "@/content/datasets";
import { filterLesson } from "@/content/lessons/filter";
import {
  buildFilterScene,
  filterQuerySql,
  validateFilterSlots,
  type FilterScene,
  type FilterSlots,
} from "@/engine/scenes/filter";
import { engineRunner, loadDataset, runQuery, type RunQueryResult } from "@/lib/engine/db";
import { friendlyError } from "@/engine/sql-guard";

type Status = "booting" | "ready" | "running" | "error";

interface FilterLessonState {
  slots: FilterSlots;
  status: Status;
  /** Fatal or run error shown to the learner. */
  error: string | null;
  scene: FilterScene | null;
  result: RunQueryResult | null;
  /** Slots differ from what's on stage. */
  dirty: boolean;
  setSlot: <K extends keyof FilterSlots>(key: K, value: FilterSlots[K]) => void;
  boot: () => Promise<void>;
  run: () => Promise<boolean>;
}

const slots = filterLesson.editableSlots;

export const useFilterLesson = create<FilterLessonState>()((set, get) => ({
  slots: {
    column: slots.column.default,
    operator: slots.operator.default,
    threshold: String(slots.threshold.default),
  },
  status: "booting",
  error: null,
  scene: null,
  result: null,
  dirty: false,
  setSlot: (key, value) => set((s) => ({ slots: { ...s.slots, [key]: value }, dirty: true })),
  boot: async () => {
    const error = await loadDataset(datasets[filterLesson.datasetId]);
    set(error ? { status: "error", error } : { status: "ready", error: null });
  },
  run: async () => {
    const valid = validateFilterSlots(filterLesson.table, get().slots, slots.column.options);
    if (!valid.ok) {
      set({ error: valid.error });
      return false;
    }
    set({ status: "running", error: null });
    const [scene, result] = await Promise.all([
      buildFilterScene(engineRunner, valid.value),
      runQuery(filterQuerySql(valid.value)),
    ]);
    if (!scene.ok) {
      set({ status: "ready", error: friendlyError(scene.error) });
      return false;
    }
    set({ status: "ready", scene: scene.value, result, error: result.error ?? null, dirty: false });
    return true;
  },
}));

/** The SQL for the current slots, or null while they're invalid. */
export function currentSql(s: FilterSlots): string | null {
  const valid = validateFilterSlots(filterLesson.table, s, slots.column.options);
  return valid.ok ? filterQuerySql(valid.value) : null;
}
