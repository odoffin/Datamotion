"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Breadcrumb, Button, ButtonLink, LedgerSheet, MarginNote } from "@/components/ledger";
import { chapterByNumber } from "@/content/chapters";
import { useProgressHydrated } from "@/lib/hooks/use-progress-hydrated";
import { knownChapters, QUESTIONS, recommend, score, skipRest, type Answer } from "@/lib/placement";
import { useProgress } from "@/store/progress";

const LETTERS = ["A", "B", "C", "D"];

const ANSWER_WORDS: Record<Answer, { text: (chapter: number) => string; className: string }> = {
  correct: { text: () => "correct", className: "text-good" },
  wrong: { text: (n) => `review in chapter ${n}`, className: "text-pen" },
  unknown: { text: (n) => `not known yet, chapter ${n}`, className: "text-pen" },
  skipped: { text: () => "skipped", className: "text-muted" },
};

/** Six optional questions; the result is a suggestion, never a gate. */
export function PlacementQuiz() {
  useProgressHydrated();
  const savePlacement = useProgress((s) => s.savePlacement);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const index = answers.length;
  const done = index >= QUESTIONS.length;
  const q = QUESTIONS[Math.min(index, QUESTIONS.length - 1)]!;

  // Move focus to each new question (and the result) for keyboard and screen
  // reader users, but not on first load.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [index]);

  const finish = (all: Answer[]) => {
    setAnswers(all);
    setPicked(null);
    if (all.length >= QUESTIONS.length) savePlacement(all, recommend(all).chapter, knownChapters(all));
  };
  const next = () => {
    if (picked === null) return;
    finish([...answers, score(q, picked)]);
  };

  if (done) return <Result answers={answers} onRestart={() => finish([])} heading={heading} />;

  const answered = picked !== null;
  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pb-24 pt-6 sm:px-14">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Chapters", href: "/chapters" }, { label: "Placement quiz" }]} />
        <Link href="/chapters" className="inline-flex min-h-11 items-center text-[15px] text-muted underline hover:text-ink">
          Skip the quiz and pick a chapter
        </Link>
      </div>
      <section className="mt-8">
        <p className="text-[15px] text-muted">
          Question {index + 1} of {QUESTIONS.length}. Answer honestly, there is no penalty.
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-3 font-serif text-[clamp(1.75rem,4.5vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em] focus:outline-none"
        >
          {q.prompt}
        </h1>

        <LedgerSheet title={q.topic} className="mt-8" aria-label="Options">
          <div role="group" aria-label="Options">
            {q.options.map((text, i) => {
              const isRight = answered && i === q.right;
              const isWrong = answered && i === picked && i !== q.right;
              return (
                <button
                  key={text}
                  type="button"
                  onClick={() => !answered && setPicked(i)}
                  aria-disabled={answered}
                  aria-pressed={picked === i}
                  className={[
                    "grid min-h-16 w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center border-b border-rule py-2 text-left text-[17px] leading-snug text-ink",
                    isRight ? "bg-good/10" : isWrong ? "bg-pen/10" : answered ? "cursor-default" : "hover:bg-wash",
                  ].join(" ")}
                >
                  <span className="pl-[18px] font-mono text-[15px] text-muted">{LETTERS[i]}</span>
                  <span className={`block min-w-0 break-words pl-6 pr-3 ${q.code ? "font-mono text-[15px]" : ""}`}>{text}</span>
                  <span className="min-w-[6.5rem] pr-[18px] text-right text-sm font-semibold">
                    {isRight && (
                      <span className="inline-flex items-center gap-1.5 text-good">
                        <Check size={16} strokeWidth={3} aria-hidden />
                        correct
                      </span>
                    )}
                    {isWrong && (
                      <span className="inline-flex items-center gap-1.5 text-pen">
                        <X size={16} strokeWidth={3} aria-hidden />
                        not quite
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </LedgerSheet>

        {answered ? (
          <div role="status" className="rise mt-6">
            <p className="text-[17px] leading-[1.65]">{q.why}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={next}>{index === QUESTIONS.length - 1 ? "See where to start" : "Next question"}</Button>
              <Button variant="line" onClick={() => finish(skipRest([...answers, score(q, picked)]))}>
                I do not know this part, skip ahead
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="line" onClick={() => finish([...answers, "unknown"])}>
              I do not know
            </Button>
            <span className="text-sm text-muted">Guessing is fine, but this one tells us more.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function Result({
  answers,
  onRestart,
  heading,
}: {
  answers: Answer[];
  onRestart: () => void;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  const rec = recommend(answers);
  const chapter = chapterByNumber(rec.chapter);
  const firstLesson = chapter?.lessonIds[0];
  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pb-24 pt-6 sm:px-14">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Chapters", href: "/chapters" }, { label: "Placement result" }]} />
      <section className="rise mt-8">
        <p className="text-[15px] text-muted">Your starting point</p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-3 font-serif text-[clamp(2.25rem,6vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.02em] focus:outline-none"
        >
          Start at chapter {rec.chapter}: {rec.name}.
        </h1>
        <MarginNote className="mt-4 block text-[30px]">{rec.note}</MarginNote>
        <p className="mt-5 text-lg leading-[1.65]">{rec.reason}</p>
        {rec.caveats.map((c) => (
          <p key={c} className="mt-3 text-base leading-[1.65] text-muted">
            {c}
          </p>
        ))}
        <div className="mt-7 flex flex-wrap gap-3">
          {firstLesson ? (
            <ButtonLink href={`/lesson/${firstLesson}`}>Start chapter {rec.chapter}</ButtonLink>
          ) : (
            <ButtonLink href={`/chapters#chapter-${rec.chapter}`}>See chapter {rec.chapter} on the map</ButtonLink>
          )}
          <ButtonLink href="/chapters" variant="line">
            Pick any chapter instead
          </ButtonLink>
          <Button variant="line" onClick={onRestart}>
            Retake the quiz
          </Button>
        </div>

        <LedgerSheet title="Your answers" className="mt-10">
          <ul>
            {QUESTIONS.map((q, i) => {
              const a = answers[i] ?? "skipped";
              const words = ANSWER_WORDS[a];
              return (
                <li key={q.topic} className="grid min-h-[52px] grid-cols-[72px_minmax(0,1fr)_auto] items-center border-b border-rule">
                  <span className="pl-[18px] font-mono text-[15px] text-muted">{i + 1}</span>
                  <span className="min-w-0 pl-6 pr-3 text-base">{q.topic}</span>
                  <span className={`flex items-center gap-1.5 pr-[18px] text-right text-sm font-semibold ${words.className}`}>
                    {a === "correct" && <Check size={15} strokeWidth={3} aria-hidden />}
                    {(a === "wrong" || a === "unknown") && <X size={15} strokeWidth={3} aria-hidden />}
                    {words.text(q.chapter)}
                  </span>
                </li>
              );
            })}
          </ul>
        </LedgerSheet>
      </section>
    </div>
  );
}
