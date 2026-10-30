"use client";

import { Check, X } from "lucide-react";
import { useId, useState } from "react";
import type { ExplainBackQuestion } from "@/engine/explain-back";

/**
 * Explain it back: finish one sentence about the query just approved. A wrong
 * ending is crossed out and the learner tries again; the right one comes with
 * the reason. Radio buttons, so it works by keyboard and screen reader.
 */
export function ExplainBack({ question }: { question: ExplainBackQuestion }) {
  const name = useId();
  const [tried, setTried] = useState<number[]>([]);
  const solved = tried.includes(question.answer);
  const last = tried[tried.length - 1];
  return (
    <fieldset className="mt-5 border-t border-rule pt-4">
      <legend className="sr-only">Check yourself</legend>
      {/* A textbook's end-of-section check, in the notebook's own words. */}
      <p aria-hidden className="font-serif text-xl font-semibold">
        Check yourself
      </p>
      <p className="mt-1 text-[15px] leading-relaxed">
        Explain it back. Finish the sentence about your query: <span className="font-semibold">{question.prompt} …</span>
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {question.options.map((option, i) => {
          const wrong = tried.includes(i) && i !== question.answer;
          const right = solved && i === question.answer;
          return (
            <label
              key={option}
              className={[
                "flex min-h-11 items-start gap-3 rounded-btn border px-3 py-2.5 text-[15px] leading-snug has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                right ? "border-good border-2 bg-sheet" : wrong ? "border-rule text-muted" : "cursor-pointer border-ink bg-sheet hover:bg-wash",
              ].join(" ")}
            >
              <input
                type="radio"
                name={name}
                value={i}
                checked={last === i}
                disabled={solved || wrong}
                onChange={() => setTried((t) => [...t, i])}
                className="mt-0.5 size-4 shrink-0 accent-ink"
              />
              <span className={`flex-1 ${wrong ? "line-through" : ""}`}>{option}</span>
              {right && (
                <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-good">
                  <Check size={15} strokeWidth={3} aria-hidden />
                  right
                </span>
              )}
              {wrong && (
                <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-pen">
                  <X size={15} strokeWidth={3} aria-hidden />
                  not this
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p role="status" className="mt-3 text-[15px] leading-relaxed empty:mt-0">
        {solved ? (
          <>
            <span className="font-semibold text-good">Yes.</span> {question.why}
          </>
        ) : last !== undefined ? (
          "Not quite. Read your query once more and pick another ending."
        ) : null}
      </p>
    </fieldset>
  );
}
