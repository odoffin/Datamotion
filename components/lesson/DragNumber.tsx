"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ledger";
import type { Tweak } from "@/engine/explain";
import { readOnlyRunner } from "@/lib/engine/db";

const fill = (parts: readonly string[], values: readonly number[]) =>
  parts.reduce((text, part, i) => text + part + (i < values.length ? String(values[i]) : ""), "");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Drag a number in the learner's own test and watch which rows it keeps: an
 * explorable explanation. One mark per row (or group): a tall ink mark is
 * kept, a short low one is dropped, so the state is never colour alone, and
 * the count is said in words.
 */
export function DragNumber({ tweak }: { tweak: Tweak }) {
  const original = tweak.numbers.map((n) => n.value);
  const [values, setValues] = useState(original);
  const [verdicts, setVerdicts] = useState<boolean[] | null>(null);
  const [baseline, setBaseline] = useState<number | null>(null);
  const id = useId();
  const changed = values.some((v, i) => v !== original[i]);
  const query = fill(tweak.query, values);

  useEffect(() => {
    let live = true;
    // A short pause, so dragging fast runs only the last value.
    const timer = setTimeout(() => {
      void readOnlyRunner.run(query).then((res) => {
        if (!live || res.error) return;
        const kept = res.rows.map((r) => r[0] === true);
        setVerdicts(kept);
        setBaseline((b) => b ?? kept.filter(Boolean).length);
      });
    }, 60);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const kept = verdicts?.filter(Boolean).length ?? null;
  return (
    <div className="mt-3 border border-ink bg-paper px-3 py-3 sm:px-4">
      <p className="text-sm font-semibold">Drag the number and watch the {tweak.noun}s change</p>
      <code className="mt-1.5 block whitespace-pre-wrap break-words font-mono text-[15px] text-ink">
        {tweak.parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < values.length && <mark className="rounded-btn bg-wash px-1 font-semibold text-num">{values[i]}</mark>}
          </span>
        ))}
      </code>
      {tweak.numbers.map((n, i) => (
        <input
          key={i}
          type="range"
          min={n.min}
          max={n.max}
          step={n.step}
          value={values[i]}
          aria-label={`Change ${n.about}`}
          aria-describedby={`${id}-count`}
          onChange={(e) => {
            const v = Number(e.target.value);
            setValues((vs) => vs.map((x, k) => (k === i ? v : x)));
          }}
          className="mt-1 h-11 w-full cursor-ew-resize accent-ink"
        />
      ))}
      {verdicts && verdicts.length <= 200 && (
        <div aria-hidden className="mt-1 flex flex-wrap items-end gap-[3px]">
          {verdicts.map((k, i) => (
            <span key={i} className={k ? "h-4 w-1.5 bg-ink" : "h-1.5 w-1.5 bg-rule"} />
          ))}
        </div>
      )}
      <p id={`${id}-count`} aria-live="polite" className="mt-2 text-[15px] leading-relaxed">
        {kept === null || !verdicts
          ? "Trying it on every row."
          : `${kept} of ${plural(verdicts.length, tweak.noun)} kept.${changed && baseline !== null ? ` Your query keeps ${baseline}.` : ""}`}
      </p>
      {changed && (
        <Button variant="line" className="mt-2" onClick={() => setValues(original)}>
          Back to {original.join(" and ")}
        </Button>
      )}
    </div>
  );
}
