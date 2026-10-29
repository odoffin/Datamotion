import { chapterByNumber, chapters, hasLessons } from "@/content/chapters";

/**
 * The placement quiz, ported from design/reference/Placement.dc.html. One
 * question samples each of chapters 1, 2, 6, 7, 9 and 11. Pure and tested.
 */
export interface PlacementQuestion {
  topic: string;
  /** How the "why" line names this question, e.g. "the grouping question". */
  short: string;
  /** The chapter this question samples. */
  chapter: number;
  prompt: string;
  options: string[];
  right: number;
  /** Options are code, shown in mono. */
  code?: boolean;
  why: string;
}

export const QUESTIONS: readonly PlacementQuestion[] = [
  { topic: "Tables, rows and columns", short: "tables and rows", chapter: 1, prompt: "In a table of orders, what is one row?", options: ["One order record", "One kind of information, like amount", "The whole table", "The database"], right: 0, why: "A row is one record, here one order. A column holds one kind of information about every record, such as the amount." },
  { topic: "Querying and filtering", short: "SELECT and WHERE", chapter: 2, prompt: "Which query returns only the orders over 50?", options: ["SELECT * FROM orders WHERE amount > 50;", "SELECT amount > 50 FROM orders;", "FROM orders SELECT * WHERE amount > 50;", "SELECT * WHERE orders amount > 50;"], right: 0, code: true, why: "A query reads SELECT, then FROM, then WHERE. WHERE comes after the table is named and holds the test each row must pass." },
  { topic: "Aggregation", short: "grouping", chapter: 6, prompt: "Which clause filters groups after GROUP BY has run?", options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], right: 1, why: "WHERE filters individual rows before grouping. HAVING filters the groups afterwards, for example only cities with more than ten customers." },
  { topic: "Joins", short: "joins", chapter: 7, prompt: "You LEFT JOIN customers to orders. A customer has no orders. What happens to that customer?", options: ["They appear once, with NULL in the order columns", "They are removed from the result", "They appear twice", "The query returns an error"], right: 0, why: "A LEFT JOIN keeps every row from the left table. Where there is no match on the right, the right-hand columns are filled with NULL." },
  { topic: "Window functions", short: "window functions", chapter: 9, prompt: "What does ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) do?", options: ["Numbers each customer's orders 1, 2, 3 by date", "Counts all rows in the table", "Removes duplicate orders", "Sorts the table for good"], right: 0, why: "PARTITION BY restarts the count for each customer, and ORDER BY sets the order inside each one. No rows are collapsed or removed." },
  { topic: "Database design", short: "database design", chapter: 11, prompt: "What is the main aim of normalizing a database to third normal form?", options: ["Store each fact in one place to reduce repetition", "Make every query run faster", "Encrypt the data", "Make the files smaller"], right: 0, why: "Normalization removes repeated facts so a change is made once. It can make some queries need more joins, so it is about correctness first, not speed." },
];

/** correct / wrong: an option was picked. unknown: "I do not know". skipped: "skip ahead". */
export type Answer = "correct" | "wrong" | "unknown" | "skipped";

export function score(question: PlacementQuestion, picked: number): Answer {
  return picked === question.right ? "correct" : "wrong";
}

/** "I do not know this part, skip ahead": every remaining question is skipped. */
export function skipRest(answers: readonly Answer[]): Answer[] {
  return [...answers, ...Array<Answer>(Math.max(0, QUESTIONS.length - answers.length)).fill("skipped")];
}

export interface Recommendation {
  chapter: number;
  name: string;
  /** Red-pen note, six words at most. */
  note: string;
  reason: string;
  /** One line naming the answers behind the suggestion. */
  why: string;
  /** Honest limits of the advice, in plain words. */
  caveats: string[];
}

const TESTED = new Set(QUESTIONS.map((q) => q.chapter));
const LAST = chapters.length;

function listNumbers(ns: number[]): string {
  if (ns.length === 1) return `${ns[0]}`;
  return `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}

/**
 * Recommends the chapter of the first question that was not answered
 * correctly, or the last chapter when everything was right. The learner can
 * always ignore it and pick any chapter.
 */
export function recommend(answers: readonly Answer[]): Recommendation {
  const firstMiss = QUESTIONS.findIndex((_, i) => answers[i] !== "correct");
  const chapter = firstMiss === -1 ? LAST : QUESTIONS[firstMiss]!.chapter;
  const name = chapterByNumber(chapter)?.name ?? "";

  let note: string;
  let reason: string;
  if (firstMiss === -1) {
    note = "you know your stuff";
    reason = `You answered every question correctly, so you can start with the last chapter: indexes, views, reading query plans and the capstone project.`;
  } else if (firstMiss === 0) {
    note = "a good place to begin";
    reason = "The first question caught you out, so the best place to begin is the start. Chapter 1 covers what a database holds before any query.";
  } else {
    const before = QUESTIONS[firstMiss - 1]!.topic.toLowerCase();
    const here = QUESTIONS[firstMiss]!.topic.toLowerCase();
    note = "right where it gets interesting";
    reason = `You were comfortable up to ${before}, and ${here} is the first place a question caught you out. Chapter ${chapter} is built for exactly that.`;
  }

  const why = whyLine(answers, firstMiss);

  const caveats: string[] = [];
  // Chapters before the recommendation that no question sampled.
  const untested = chapters.map((c) => c.n).filter((n) => n < chapter && !TESTED.has(n));
  if (untested.length) {
    caveats.push(
      `The quiz asks one question per sampled chapter, so ${untested.length === 1 ? "chapter" : "chapters"} ${listNumbers(untested)} ${untested.length === 1 ? "was" : "were"} not tested. Skim ${untested.length === 1 ? "it" : "them"} on the map before you start.`,
    );
  }
  const target = chapterByNumber(chapter);
  if (target && !hasLessons(target)) {
    const withLessons = chapters.filter(hasLessons).map((c) => `${c.name} (chapter ${c.n})`);
    caveats.push(
      `Chapter ${chapter} has no lessons yet, so this starting point has not been tried against real lessons.${
        withLessons.length ? ` For now the only written lessons are in ${withLessons.join(" and ")}.` : ""
      }`,
    );
  }
  caveats.push("This is a suggestion, not a gate. Every chapter on the map is open to you.");
  return { chapter, name, note, reason, why, caveats };
}

const MISS_WORDS: Record<Exclude<Answer, "correct">, string> = {
  wrong: "was the first one you missed",
  unknown: "was the first one you said you did not know",
  skipped: "was where you skipped ahead",
};

/** e.g. "Why: you answered the grouping question correctly, and the joins question was the first one you missed." */
export function whyLine(answers: readonly Answer[], firstMiss: number): string {
  const q = (i: number) => `the ${QUESTIONS[i]!.short} question`;
  if (firstMiss === -1) return "Why: you answered all six questions correctly.";
  const miss = answers[firstMiss];
  const how = MISS_WORDS[miss === undefined || miss === "correct" ? "skipped" : miss];
  if (firstMiss === 0) return `Why: ${q(0)} ${how}.`;
  const before = firstMiss === 1 ? `${q(0)}` : `every question up to ${q(firstMiss - 1)}`;
  return `Why: you answered ${before} correctly, and ${q(firstMiss)} ${how}.`;
}

/**
 * Chapters that looked familiar in the quiz: the ones whose question was
 * answered correctly. One right answer is a hint, not mastery.
 */
export function familiarChapters(answers: readonly Answer[]): number[] {
  return QUESTIONS.flatMap((q, i) => (answers[i] === "correct" ? [q.chapter] : []));
}

/** Back: reopen the previous question, unanswered. */
export function previousAnswers(answers: readonly Answer[]): Answer[] {
  return answers.slice(0, -1);
}

/** Keyboard shortcut A, B, C or D (either case) to an option index, if it exists. */
export function optionForKey(key: string, optionCount: number): number | null {
  if (key.length !== 1) return null;
  const i = key.toUpperCase().charCodeAt(0) - 65;
  return i >= 0 && i < Math.min(optionCount, 4) ? i : null;
}

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
