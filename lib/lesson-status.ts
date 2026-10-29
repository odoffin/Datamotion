/** Pure lesson-state rules, kept out of the components so they can be tested. */

export type OutcomeKind = "idle" | "diagnostic" | "wrong" | "approved" | "system";

export interface ResultVerdict {
  tone: "ok" | "bad" | "stale";
  text: string;
}

/**
 * The line above "Your result". Once the learner edits the text, the shown
 * rows belong to an older query, so say that instead of judging them.
 */
export function resultVerdict(outcome: OutcomeKind, edited: boolean): ResultVerdict | null {
  if (edited) return { tone: "stale", text: "You've edited the query since the last run" };
  if (outcome === "approved") return { tone: "ok", text: "Matches the goal" };
  if (outcome === "wrong") return { tone: "bad", text: "Does not match the goal yet" };
  return null;
}

/** "Show the answer" appears after two wrong runs, or once a hint has been used. */
export function canShowAnswer(failedRuns: number, hintsShown: number): boolean {
  return failedRuns >= 2 || hintsShown > 0;
}

export type Completion = "mastered" | "revealed";

/** Seeing the answer still lets the learner finish, but it is not mastery. */
export function completionFor(answerRevealed: boolean): Completion {
  return answerRevealed ? "revealed" : "mastered";
}

/** Hints come one at a time, on request; never more than exist. */
export function nextHintCount(shown: number, available: number): number {
  return Math.min(shown + 1, available);
}
