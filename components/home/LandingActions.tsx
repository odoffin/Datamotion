"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ledger";
import { chapters } from "@/content/chapters";
import { getLesson } from "@/content/lessons";
import { useProgressHydrated } from "@/lib/hooks/use-progress-hydrated";
import { useProgress } from "@/store/progress";

const firstWritten = chapters.find((c) => c.lessonIds.length > 0);

/** One clear action: continue where you were, or start; finding your level is the alternative. */
export function LandingActions() {
  const hydrated = useProgressHydrated();
  const lastId = useProgress((s) => s.lastLessonId);
  const last = hydrated && lastId ? getLesson(lastId) : undefined;
  const startId = firstWritten?.lessonIds[0];
  return (
    <>
      <div className="mt-8 flex flex-wrap gap-3">
        {last ? (
          <ButtonLink href={`/lesson/${last.id}`}>Continue: {last.title}</ButtonLink>
        ) : (
          startId && <ButtonLink href={`/lesson/${startId}`}>Start with {firstWritten.name}</ButtonLink>
        )}
        <ButtonLink href="/placement" variant="line">
          Find my level
        </ButtonLink>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        {last
          ? "Picking up where you left off."
          : `${firstWritten?.name ?? "Filtering"} is the first chapter with a written lesson. The quiz is six questions and optional.`}{" "}
        Or{" "}
        <Link href="/chapters" className="-my-3 inline-block py-3 text-ink underline">
          browse all {chapters.length} chapters
        </Link>
        .
      </p>
    </>
  );
}
