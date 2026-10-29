import { describe, expect, it } from "vitest";
import { canShowAnswer, completionFor, nextHintCount, resultVerdict } from "@/lib/lesson-status";

describe("resultVerdict", () => {
  it("never judges rows from an older query once the text is edited", () => {
    expect(resultVerdict("approved", true)).toEqual({ tone: "stale", text: "You've edited the query since the last run" });
    expect(resultVerdict("wrong", true)?.tone).toBe("stale");
  });
  it("judges the last run when nothing changed", () => {
    expect(resultVerdict("approved", false)).toEqual({ tone: "ok", text: "Matches the goal" });
    expect(resultVerdict("wrong", false)).toEqual({ tone: "bad", text: "Does not match the goal yet" });
    expect(resultVerdict("idle", false)).toBeNull();
  });
});

describe("Show the answer", () => {
  it("appears only after two wrong runs or after a hint", () => {
    expect(canShowAnswer(0, 0)).toBe(false);
    expect(canShowAnswer(1, 0)).toBe(false);
    expect(canShowAnswer(2, 0)).toBe(true);
    expect(canShowAnswer(0, 1)).toBe(true);
  });
  it("marks a finished exercise as revealed, not mastered", () => {
    expect(completionFor(true)).toBe("revealed");
    expect(completionFor(false)).toBe("mastered");
  });
});

describe("hints", () => {
  it("reveal one at a time and stop at the last", () => {
    expect(nextHintCount(0, 2)).toBe(1);
    expect(nextHintCount(1, 2)).toBe(2);
    expect(nextHintCount(2, 2)).toBe(2);
  });
});
