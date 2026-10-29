"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getStorageHealth, probeStorage, subscribeStorageHealth, type StorageHealth } from "@/lib/storage-health";
import { useProgress } from "@/store/progress";

const subscribe = (onChange: () => void) => useProgress.persist.onFinishHydration(onChange);

/**
 * Loads saved progress once on the client (after the first render, so server
 * and client markup match) and reports whether it has been read yet.
 */
export function useProgressHydrated(): boolean {
  useEffect(() => {
    probeStorage(() => window.localStorage);
    if (!useProgress.persist.hasHydrated()) void useProgress.persist.rehydrate();
  }, []);
  return useSyncExternalStore(subscribe, () => useProgress.persist.hasHydrated(), () => false);
}

/** "blocked" once the browser refuses storage; "unknown" on the server. */
export function useStorageHealth(): StorageHealth {
  return useSyncExternalStore(subscribeStorageHealth, getStorageHealth, () => "unknown");
}
