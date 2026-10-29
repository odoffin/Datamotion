import { chapterByNumber, hasLessons, type Chapter } from "@/content/chapters";
import type { ProgressData } from "@/store/progress";

export type ChapterStatus = "done" | "in progress" | "tested out" | "not started" | "coming soon";

const lessonStatus = (p: ProgressData, id: string) => p.lessons[id]?.status ?? "not started";

/** Status for the map, always shown as a word (plus an icon), never colour alone. */
export function chapterStatus(c: Chapter, p: ProgressData): ChapterStatus {
  if (hasLessons(c)) {
    const statuses = c.lessonIds.map((id) => lessonStatus(p, id));
    if (statuses.every((s) => s === "done")) return "done";
    if (statuses.some((s) => s !== "not started")) return "in progress";
  }
  if (p.knownChapters.includes(c.n)) return "tested out";
  return hasLessons(c) ? "not started" : "coming soon";
}

/** A chapter counts as covered for soft prerequisites when done or tested out. */
function covered(n: number, p: ProgressData): boolean {
  const c = chapterByNumber(n);
  if (!c) return false;
  const s = chapterStatus(c, p);
  return s === "done" || s === "tested out";
}

/** Soft prerequisites: advice only, never a lock. */
export function prerequisiteText(c: Chapter, p: ProgressData): string {
  if (c.prerequisites.length === 0) return "No prerequisites. A good first chapter.";
  const name = (n: number) => chapterByNumber(n)?.name ?? `chapter ${n}`;
  const open = c.prerequisites.filter((n) => !covered(n, p));
  if (open.length === 0) return `Builds on ${c.prerequisites.map(name).join(" and ")}, which you have covered.`;
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
