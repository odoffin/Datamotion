import { describe, expect, it } from "vitest";
import { chapterOfLesson } from "@/content/chapters";
import { lessons } from "@/content/lessons";

describe("lesson content", () => {
  it.each(Object.values(lessons))("$id has a few short, distinct concept tags", (lesson) => {
    expect(lesson.concepts.length).toBeGreaterThanOrEqual(1);
    expect(lesson.concepts.length).toBeLessThanOrEqual(5);
    expect(new Set(lesson.concepts.map((c) => c.toLowerCase())).size).toBe(lesson.concepts.length);
    for (const c of lesson.concepts) expect(c.split(/\s+/).length).toBeLessThanOrEqual(5);
  });
  it.each(Object.values(lessons))("$id belongs to a chapter", (lesson) => {
    expect(chapterOfLesson(lesson.id)).toBeDefined();
  });
});
