"use client";

import { useProgressHydrated, useStorageHealth } from "@/lib/hooks/use-progress-hydrated";

/** Says plainly when this browser will not keep progress. */
export function StorageNotice() {
  useProgressHydrated();
  const health = useStorageHealth();
  return (
    <div role="status" className="mx-auto w-full max-w-[1440px] px-4 sm:px-14">
      {health === "blocked" && (
        <p className="mt-4 border border-ink bg-sheet px-4 py-3 text-[15px]">
          Progress can&apos;t be saved in this browser and will reset on reload.
        </p>
      )}
    </div>
  );
}
