import { chapterByNumber, hasLessons, type Chapter } from "@/content/chapters";
import type { ProgressData } from "@/store/progress";

/** The words shown on the map. "looked familiar in the quiz": one right answer is not mastery. */
export type ChapterStatus = "done" | "in progress" | "looked familiar in the quiz" | "not started" | "coming soon";

const lessonStatus = (p: ProgressData, id: string) => p.lessons[id]?.status ?? "not started";

/** Status for the map, always shown as a word (plus an icon), never colour alone. */
export function chapterStatus(c: Chapter, p: ProgressData): ChapterStatus {
  if (hasLessons(c)) {
    const statuses = c.lessonIds.map((id) => lessonStatus(p, id));
    if (statuses.every((s) => s === "done")) return "done";
    if (statuses.some((s) => s !== "not started")) return "in progress";
  }
  if (p.knownChapters.includes(c.n)) return "looked familiar in the quiz";
  return hasLessons(c) ? "not started" : "coming soon";
}

/** Soft prerequisites: advice only, never a lock. */
export function prerequisiteText(c: Chapter, p: ProgressData): string {
  if (c.prerequisites.length === 0) return "No prerequisites. A good first chapter.";
  const name = (n: number) => chapterByNumber(n)?.name ?? `chapter ${n}`;
  const status = (n: number) => {
    const ch = chapterByNumber(n);
    return ch ? chapterStatus(ch, p) : "not started";
  };
  const statuses = c.prerequisites.map(status);
  const names = c.prerequisites.map(name).join(" and ");
  if (statuses.every((s) => s === "done")) return `Builds on ${names}, which you have finished.`;
  if (statuses.every((s) => s === "done" || s === "looked familiar in the quiz")) {
    return `Builds on ${names}, which you have finished or which looked familiar in the quiz.`;
  }
  const open = c.prerequisites.filter((_, i) => statuses[i] !== "done" && statuses[i] !== "looked familiar in the quiz");
  return `Works best after ${open.map(name).join(" and ")}, but you can start here if you already know it.`;
}

/** Where "Start" goes: the first lesson not done yet, or the first lesson. Null when none exist. */
export function chapterEntry(c: Chapter, p: ProgressData): { lessonId: string; label: string } | null {
  if (!hasLessons(c)) return null;
  const next = c.lessonIds.find((id) => lessonStatus(p, id) !== "done") ?? c.lessonIds[0]!;
  const status = chapterStatus(c, p);
  const label =
    status === "done" ? `Revisit chapter ${c.n}` : status === "in progress" ? `Continue chapter ${c.n}` : `Start chapter ${c.n}`;
  return { lessonId: next, label };
}

export type StatusCounts = Record<ChapterStatus, number>;

export function statusCounts(list: readonly Chapter[], p: ProgressData): StatusCounts {
  const counts: StatusCounts = { done: 0, "in progress": 0, "not started": 0, "looked familiar in the quiz": 0, "coming soon": 0 };
  for (const c of list) counts[chapterStatus(c, p)]++;
  return counts;
}

/**
 * "1 done, 0 in progress, 2 not started, 9 coming soon". The first three are
 * always shown; the other two only when they apply. The parts add up to the
 * number of chapters.
 */
export function countsLine(counts: StatusCounts): string {
  const parts = [`${counts.done} done`, `${counts["in progress"]} in progress`, `${counts["not started"]} not started`];
  if (counts["looked familiar in the quiz"]) parts.push(`${counts["looked familiar in the quiz"]} looked familiar in the quiz`);
  if (counts["coming soon"]) parts.push(`${counts["coming soon"]} coming soon`);
  return parts.join(", ");
}
