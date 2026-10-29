import { describe, expect, it } from "vitest";
import { chapterByNumber, chapters } from "@/content/chapters";
import { familiarChapters, optionForKey, previousAnswers, QUESTIONS, recommend, score, skipRest, type Answer } from "@/lib/placement";

const all = (a: Answer): Answer[] => QUESTIONS.map(() => a);

describe("placement mapping", () => {
  it("has six questions sampling chapters 1, 2, 6, 7, 9 and 11", () => {
    expect(QUESTIONS.map((q) => q.chapter)).toEqual([1, 2, 6, 7, 9, 11]);
    for (const q of QUESTIONS) expect(chapterByNumber(q.chapter)).toBeDefined();
  });
  it("has exactly one right option per question", () => {
    for (const q of QUESTIONS) {
      expect(q.right).toBeGreaterThanOrEqual(0);
      expect(q.right).toBeLessThan(q.options.length);
    }
  });
  it("has twelve chapters, numbered 1 to 12", () => {
    expect(chapters.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("placement scoring", () => {
  it("scores a pick against the right option", () => {
    expect(score(QUESTIONS[2]!, 1)).toBe("correct");
    expect(score(QUESTIONS[2]!, 0)).toBe("wrong");
  });

  it("all correct: start at chapter 12", () => {
    const r = recommend(all("correct"));
    expect(r.chapter).toBe(12);
    expect(r.name).toBe("Real-world SQL");
    // Chapters no question sampled are named honestly.
    expect(r.caveats.join(" ")).toContain("chapters 3, 4, 5, 8 and 10 were not tested");
  });

  it("first wrong: start at chapter 1", () => {
    const r = recommend(["wrong", "correct", "correct", "correct", "correct", "correct"]);
    expect(r.chapter).toBe(1);
    expect(r.reason).toContain("The first question caught you out");
    expect(r.caveats.join(" ")).not.toContain("were not tested");
  });

  it("middle wrong: start at the chapter of the first miss", () => {
    const r = recommend(["correct", "correct", "correct", "wrong", "correct", "correct"]);
    expect(r.chapter).toBe(7);
    expect(r.reason).toContain("comfortable up to aggregation");
    expect(r.caveats.join(" ")).toContain("chapters 3, 4 and 5 were not tested");
  });

  it("'I do not know' counts as a miss", () => {
    expect(recommend(["correct", "unknown"]).chapter).toBe(2);
  });

  it("skip ahead: everything after is skipped, and the first miss decides", () => {
    const answers = skipRest(["correct", "correct"]);
    expect(answers).toEqual(["correct", "correct", "skipped", "skipped", "skipped", "skipped"]);
    expect(recommend(answers).chapter).toBe(6);
    expect(recommend(skipRest([])).chapter).toBe(1);
  });

  it("says honestly when the recommended chapter has no lessons yet", () => {
    const r = recommend(["correct", "correct", "wrong"]);
    expect(r.chapter).toBe(6);
    expect(r.caveats.join(" ")).toContain("Chapter 6 has no lessons yet");
    expect(r.caveats.join(" ")).toContain("Filtering (chapter 3)");
  });

  it("never gates: the last caveat always says every chapter is open", () => {
    expect(recommend(all("wrong")).caveats.at(-1)).toContain("Every chapter on the map is open");
  });

  it("chapters that looked familiar are the ones answered correctly", () => {
    expect(familiarChapters(["correct", "correct", "wrong", "correct", "skipped", "skipped"])).toEqual([1, 2, 7]);
  });
});

describe("quiz controls", () => {
  it("Back reopens the previous question unanswered", () => {
    expect(previousAnswers(["correct", "wrong"])).toEqual(["correct"]);
    expect(previousAnswers([])).toEqual([]);
  });
  it("A to D choose options, in either case; other keys do nothing", () => {
    expect(optionForKey("a", 4)).toBe(0);
    expect(optionForKey("D", 4)).toBe(3);
    expect(optionForKey("c", 2)).toBeNull();
    expect(optionForKey("E", 4)).toBeNull();
    expect(optionForKey("Enter", 4)).toBeNull();
    expect(optionForKey("1", 4)).toBeNull();
  });
});
