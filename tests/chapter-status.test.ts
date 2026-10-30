import { describe, expect, it } from "vitest";
import { chapterByNumber, chapters } from "@/content/chapters";
import { chapterEntry, chapterStatus, countsLine, prerequisiteText, statusCounts } from "@/lib/chapter-status";
import type { ProgressData } from "@/store/progress";

const base: ProgressData = { lessons: {}, placement: null, knownChapters: [], lastLessonId: null };
const filtering = chapterByNumber(3)!;
const joins = chapterByNumber(7)!;
const record = (status: "in progress" | "done") => ({
  status,
  attempts: 1,
  approved: status === "done",
  completion: null,
  hintsUsed: 0,
  finishedAt: null,
});
/** The first Filtering lesson only. */
const lesson = (status: "in progress" | "done") => ({ filter: record(status) });
/** Every Filtering lesson. */
const wholeChapter = (status: "in progress" | "done") =>
  Object.fromEntries(filtering.lessonIds.map((id) => [id, record(status)]));
/** A chapter that has no lessons written yet. */
const unwritten = { ...joins, lessonIds: [] };

describe("chapter status", () => {
  it("chapters without lessons are 'coming soon', never locked or broken", () => {
    expect(chapterStatus(unwritten, base)).toBe("coming soon");
    expect(chapterEntry(unwritten, base)).toBeNull();
  });
  it("follows the lesson statuses", () => {
    expect(chapterStatus(filtering, base)).toBe("not started");
    expect(chapterStatus(filtering, { ...base, lessons: lesson("in progress") })).toBe("in progress");
    // One finished lesson of five is still in progress; all five is done.
    expect(chapterStatus(filtering, { ...base, lessons: lesson("done") })).toBe("in progress");
    expect(chapterStatus(filtering, { ...base, lessons: wholeChapter("done") })).toBe("done");
  });
  it("a right quiz answer only 'looked familiar', it is not shown as mastery", () => {
    expect(chapterStatus(chapterByNumber(1)!, { ...base, knownChapters: [1] })).toBe("looked familiar in the quiz");
  });
  it("the start button reflects progress", () => {
    expect(chapterEntry(filtering, base)?.label).toBe("Start chapter 3");
    expect(chapterEntry(filtering, { ...base, lessons: lesson("in progress") })?.label).toBe("Continue chapter 3");
    // The next unfinished lesson is where you continue.
    expect(chapterEntry(filtering, { ...base, lessons: lesson("done") })).toEqual({ lessonId: "and-or", label: "Continue chapter 3" });
    expect(chapterEntry(filtering, { ...base, lessons: wholeChapter("done") })).toEqual({ lessonId: "filter", label: "Revisit chapter 3" });
  });
  it("prerequisites are advice, never a lock", () => {
    expect(prerequisiteText(chapterByNumber(1)!, base)).toBe("No prerequisites. A good first chapter.");
    expect(prerequisiteText(filtering, base)).toBe("Works best after Query basics, but you can start here if you already know it.");
    expect(prerequisiteText(filtering, { ...base, knownChapters: [2] })).toBe(
      "Builds on Query basics, which you have finished or which looked familiar in the quiz.",
    );
  });
});

describe("progress counts", () => {
  it("a fresh learner", () => {
    expect(countsLine(statusCounts(chapters, base))).toBe("0 done, 0 in progress, 12 not started");
  });
  it("after finishing Filtering and a quiz", () => {
    const p = { ...base, lessons: wholeChapter("done"), knownChapters: [1, 2] };
    expect(countsLine(statusCounts(chapters, p))).toBe("1 done, 0 in progress, 9 not started, 2 looked familiar in the quiz");
  });
  it("always adds up to the twelve chapters", () => {
    const c = statusCounts(chapters, { ...base, lessons: lesson("in progress"), knownChapters: [6] });
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(12);
    expect(c["in progress"]).toBe(1);
  });
});
