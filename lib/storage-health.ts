/**
 * Whether this browser lets us save progress. Starts unknown; a probe or any
 * failed read or write settles it. Pure apart from a tiny listener set.
 */
export type StorageHealth = "unknown" | "ok" | "blocked";

let health: StorageHealth = "unknown";
const listeners = new Set<() => void>();

function set(next: StorageHealth) {
  // Once blocked, stay blocked for the session.
  if (health === next || health === "blocked") return;
  health = next;
  listeners.forEach((l) => l());
}

export const getStorageHealth = () => health;
export const markStorageBlocked = () => set("blocked");

export function subscribeStorageHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface ProbeTarget {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Write and remove a throwaway key. Some browsers allow reads but refuse writes. */
export function probeStorage(get: () => ProbeTarget | undefined): StorageHealth {
  try {
    const s = get();
    if (!s) throw new Error("No storage");
    s.setItem("dm.probe", "1");
    s.removeItem("dm.probe");
    set("ok");
  } catch {
    set("blocked");
  }
  return health;
}

/** For tests only. */
export function resetStorageHealthForTests() {
  health = "unknown";
}
