"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useProgress } from "@/store/progress";

const subscribe = (onChange: () => void) => useProgress.persist.onFinishHydration(onChange);

/**
 * Loads saved progress once on the client (after the first render, so server
 * and client markup match) and reports whether it has been read yet.
 */
export function useProgressHydrated(): boolean {
  useEffect(() => {
    if (!useProgress.persist.hasHydrated()) void useProgress.persist.rehydrate();
  }, []);
  return useSyncExternalStore(subscribe, () => useProgress.persist.hasHydrated(), () => false);
}
