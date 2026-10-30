"use client";

import { ButtonLink, type ButtonVariant } from "@/components/ledger";
import { getLesson } from "@/content/lessons";
import { useProgressHydrated } from "@/lib/hooks/use-progress-hydrated";
import { useProgress } from "@/store/progress";

interface PrimaryActionProps {
  /** The first written lesson, for a new visitor. */
  startId: string;
  /** "Start with Filtering" */
  startLabel: string;
  variant?: ButtonVariant;
}

/**
 * "Start with <chapter>" for a new visitor, "Continue: <lesson>" once there is
 * saved progress. Until progress has been read the button keeps its place but
 * stays hidden (see [data-pending] in globals.css), so it never flips label.
 */
export function PrimaryAction({ startId, startLabel, variant = "solid" }: PrimaryActionProps) {
  const hydrated = useProgressHydrated();
  const lastId = useProgress((s) => s.lastLessonId);
  const last = hydrated && lastId ? getLesson(lastId) : undefined;
  return last ? (
    <ButtonLink href={`/lesson/${last.id}`} variant={variant}>
      Continue: {last.title}
    </ButtonLink>
  ) : (
    <ButtonLink href={`/lesson/${startId}`} variant={variant} data-pending={hydrated ? undefined : ""}>
      {startLabel}
    </ButtonLink>
  );
}
