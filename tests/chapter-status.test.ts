import { describe, expect, it } from "vitest";
import { chapterByNumber } from "@/content/chapters";
import { chapterEntry, chapterStatus, prerequisiteText } from "@/lib/chapter-status";
import type { ProgressData } from "@/store/progress";

const base: ProgressData = { lessons: {}, placement: null, knownChapters: [], lastLessonId: null };
const filtering = chapterByNumber(3)!;
const joins = chapterByNumber(7)!;
const lesson = (status: "in progress" | "done") => ({
  filter: { status, attempts: 1, approved: status === "done", completion: null, hintsUsed: 0, finishedAt: null },
});

describe("chapter status", () => {
  it("chapters without lessons are 'coming soon', never locked or broken", () => {
    expect(chapterStatus(joins, base)).toBe("coming soon");
    expect(chapterEntry(joins, base)).toBeNull();
  });
  it("follows the lesson statuses", () => {
    expect(chapterStatus(filtering, base)).toBe("not started");
    expect(chapterStatus(filtering, { ...base, lessons: lesson("in progress") })).toBe("in progress");
    expect(chapterStatus(filtering, { ...base, lessons: lesson("done") })).toBe("done");
  });
  it("tested out in the placement quiz", () => {
    expect(chapterStatus(chapterByNumber(1)!, { ...base, knownChapters: [1] })).toBe("tested out");
  });
  it("the start button reflects progress", () => {
    expect(chapterEntry(filtering, base)?.label).toBe("Start chapter 3");
    expect(chapterEntry(filtering, { ...base, lessons: lesson("in progress") })?.label).toBe("Continue chapter 3");
    expect(chapterEntry(filtering, { ...base, lessons: lesson("done") })).toEqual({ lessonId: "filter", label: "Revisit chapter 3" });
  });
  it("prerequisites are advice, never a lock", () => {
    expect(prerequisiteText(chapterByNumber(1)!, base)).toBe("No prerequisites. A good first chapter.");
    expect(prerequisiteText(filtering, base)).toBe("Works best after Query basics, but you can start here if you already know it.");
    expect(prerequisiteText(filtering, { ...base, knownChapters: [2] })).toBe("Builds on Query basics, which you have covered.");
  });
});
