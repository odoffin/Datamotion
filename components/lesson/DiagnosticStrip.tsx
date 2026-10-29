"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { MarginNote } from "@/components/ledger";
import type { Diagnosis } from "@/engine/check";
import type { Token } from "@/engine/lex";

const TOKEN_COLOUR: Partial<Record<Token["kind"], string>> = {
  keyword: "text-key font-medium",
  number: "text-num",
};

interface DiagnosticStripProps {
  diagnosis: Diagnosis;
  /** Failed-run counter; its parity picks the shake keyframes so it replays. */
  attempt: number;
  /** The learner has edited since this run; the note stays, labelled as old. */
  stale?: boolean;
}

/**
 * The learner's tokens in mono with the wrong one circled in red pen, shaken
 * once, and a Caveat note directly underneath saying what was expected.
 */
export function DiagnosticStrip({ diagnosis, attempt, stale = false }: DiagnosticStripProps) {
  const { tokens, index, note, message, hint } = diagnosis;
  const shake = attempt % 2 === 0 ? "shake-a" : "shake-b";
  const missingAtEnd = index >= tokens.length;
  const whole = index < 0;
  const shown: { text: string; kind?: Token["kind"]; bad: boolean }[] = tokens.map((t, i) => ({
    text: t.text,
    kind: t.kind,
    bad: i === index,
  }));
  if (missingAtEnd) shown.push({ text: "…", bad: true });

  // Notes near the right edge hang leftwards so they never overflow the slip.
  const strip = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);
  useLayoutEffect(() => {
    const box = strip.current;
    const bad = box?.querySelector<HTMLElement>("[data-bad]");
    if (!box || !bad) return;
    setAlignRight(bad.offsetLeft + 180 > box.clientWidth);
  }, [diagnosis]);

  const badText = missingAtEnd ? "the end of the query" : whole ? "the whole query" : `"${tokens[index]?.text ?? ""}"`;
  const noteEl = (
    <MarginNote
      className={`pointer-events-none absolute top-full mt-[14px] whitespace-nowrap text-2xl ${alignRight ? "right-0" : "left-0"}`}
    >
      {note}
    </MarginNote>
  );

  return (
    <div className="mt-6">
      {stale && <p className="mb-1 text-sm text-muted">From your last run. Run again to check your changes.</p>}
      <div role="alert">
        <p className="sr-only">
          The red pen circles {badText}: {note}.
        </p>
        <div
          ref={strip}
          aria-hidden
          className={`relative flex min-h-12 flex-wrap gap-x-3.5 gap-y-14 pt-2 font-mono text-[clamp(17px,2.4vw,21px)] leading-snug ${
            whole ? `pen-circle-box mb-3 px-3 pb-2 ${shake}` : "pb-14"
          }`}
        >
          {shown.map((t, i) => (
            <span
              key={`${i}-${t.text}`}
              data-bad={t.bad || undefined}
              className={[
                "relative inline-block px-1",
                t.bad ? `pen-circle ${shake}` : (t.kind && TOKEN_COLOUR[t.kind]) ?? "text-ink",
              ].join(" ")}
            >
              {t.text}
              {t.bad && noteEl}
            </span>
          ))}
        </div>
        {whole && (
          <MarginNote aria-hidden className="mb-4 block text-2xl">
            {note}
          </MarginNote>
        )}
        <p className="text-base leading-relaxed">{message}</p>
      </div>
      {hint && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}
