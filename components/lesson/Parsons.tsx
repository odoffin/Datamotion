"use client";

import { CircleCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ledger";
import { inWrittenOrder } from "@/engine/clauses";
import { SqlLine } from "./SqlLine";

/** The same shuffle every visit for a lesson, never the written order itself. */
function shuffled(n: number, seed: string): number[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const random = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  if (order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

interface ParsonsProps {
  /** The statement's lines in written order (engine/clauses puzzleLines). */
  lines: string[];
  seed: string;
  intro: string;
  /** Said once the lines are in a right order. */
  done: string;
}

/**
 * A Parsons puzzle: the lines of a query, shuffled, tapped back into the order
 * you write them. Buttons, not dragging, so it works with a keyboard, a screen
 * reader and a thumb alike.
 */
export function Parsons({ lines, seed, intro, done }: ParsonsProps) {
  const pool = useMemo(() => shuffled(lines.length, seed), [lines.length, seed]);
  const [placed, setPlaced] = useState<number[]>([]);
  const left = pool.filter((i) => !placed.includes(i));
  const complete = placed.length === lines.length;
  const right = complete && inWrittenOrder(lines, placed);
  const firstWrong = complete && !right ? placed.findIndex((li, i) => li !== i) : -1;

  return (
    <div>
      <p className="text-[15px] leading-relaxed">{intro}</p>
      <p className="mt-3 text-sm text-muted">Your order</p>
      <ol className="mt-1 border border-ink bg-sheet">
        {placed.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing yet. Tap a line below to start.</li>}
        {placed.map((li, pos) => (
          <li key={li} className="border-b border-rule last:border-b-0">
            <button
              type="button"
              onClick={() => setPlaced((p) => p.filter((x) => x !== li))}
              aria-label={`Take back line ${pos + 1}: ${lines[li]}`}
              className="grid min-h-11 w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5 text-left hover:bg-wash"
            >
              <span className="pl-3 font-mono text-sm text-muted">{pos + 1}</span>
              <SqlLine sql={lines[li]!} />
              {pos === firstWrong ? <span className="pr-3 font-hand text-[22px] leading-none text-pen">out of place</span> : <span />}
            </button>
          </li>
        ))}
      </ol>
      {left.length > 0 && (
        <>
          <p className="mt-4 text-sm text-muted">Lines left to place</p>
          <ul className="mt-1 flex flex-col gap-2">
            {left.map((li) => (
              <li key={li}>
                <button
                  type="button"
                  onClick={() => setPlaced((p) => [...p, li])}
                  className="min-h-11 w-full rounded-btn border border-ink bg-sheet px-3 py-2 text-left hover:bg-wash"
                >
                  <span className="sr-only">Place next: </span>
                  <SqlLine sql={lines[li]!} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p role="status" className="mt-3 text-[15px] leading-relaxed empty:mt-0">
        {right ? (
          <span className="inline-flex items-start gap-2 font-semibold text-good">
            <CircleCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            {done}
          </span>
        ) : firstWrong >= 0 ? (
          `Line ${firstWrong + 1} is out of place. Tap it, and the lines after it, to take them back.`
        ) : null}
      </p>
      {placed.length > 0 && (
        <Button variant="line" className="mt-3" onClick={() => setPlaced([])}>
          Start the puzzle again
        </Button>
      )}
    </div>
  );
}
