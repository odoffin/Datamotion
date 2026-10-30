import { Check, X } from "lucide-react";
import type { CSSProperties } from "react";
import { Slip } from "@/components/ledger";
import { sqlParts } from "@/components/lesson/SqlLine";
import { demo, heroTally, splitAtWhere } from "@/lib/landing";
import { CAPTION } from "./layout";

// Typing pace and pauses, in seconds. The whole run stays under five seconds
// (WCAG 2.2.2), then rests on the result.
const TYPE_FROM = 0.3;
const PER_CHAR = 0.06;
const BEFORE_VERDICTS = 0.3;

const seconds = (n: number) => `${Math.round(n * 1000) / 1000}s`;

/** When each line starts typing and how long it takes, one after another. */
function typingPlan(sql: string) {
  const lines: { text: string; start: number; dur: number }[] = [];
  for (const text of splitAtWhere(sql)) {
    const prev = lines[lines.length - 1];
    lines.push({ text, start: prev ? prev.start + prev.dur : TYPE_FROM, dur: text.length * PER_CHAR });
  }
  const last = lines[lines.length - 1];
  return { lines, verdictsAt: (last ? last.start + last.dur : TYPE_FROM) + BEFORE_VERDICTS };
}

const plan = typingPlan(demo.sql);

/**
 * The request slip from a lesson, playing on its own: the goal query types
 * itself, then each of the first rows of the real table gets its verdict from
 * the real rule. Pure CSS (globals.css, "Landing page"), so it needs no script.
 */
export function HeroDemo() {
  return (
    <Slip style={{ "--verdicts-at": seconds(plan.verdictsAt) } as CSSProperties}>
      <p className={CAPTION}>Request slip. Type your query below.</p>
      <div className="demo-code mt-2.5">
        <p className="min-h-8.5 font-mono text-[17px] leading-[1.7] text-ink">
          {plan.lines.map((line, i) => (
            <span key={line.text}>
              {i > 0 && " "}
              <span
                className="demo-line"
                style={{ "--chars": line.text.length, "--start": seconds(line.start), "--dur": seconds(line.dur) } as CSSProperties}
              >
                <span className="demo-text">
                  {sqlParts(line.text).map((p, j) => (
                    <span key={j} className={p.className}>
                      {p.text}
                    </span>
                  ))}
                </span>
                <span aria-hidden className="demo-caret" />
              </span>
            </span>
          ))}
        </p>
      </div>
      <div className="mt-5.5 border-t border-ink">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1 pb-2 pt-2.5">
          <span className="font-serif font-semibold">{demo.table}</span>
          <span className={`${CAPTION} demo-verdict`} style={{ "--i": demo.rows.length } as CSSProperties}>
            {heroTally}
          </span>
        </div>
        <div className="relative border-t border-rule">
          <span aria-hidden className="absolute inset-y-0 left-11 w-px bg-margin" />
          {/* Column names once, in a header; the rows hold only values. */}
          <div aria-hidden className="grid min-h-9 grid-cols-[44px_minmax(0,1fr)_auto] items-center border-b-2 border-ink font-mono text-[13px] text-muted">
            <span className="pl-3">#</span>
            <span className="pl-3.5 text-ink">{demo.ruleColumn}</span>
            <span className="pr-2 font-sans">Verdict</span>
          </div>
          {demo.rows.map((row, i) => (
            <div
              key={row.position}
              className="grid min-h-11 grid-cols-[44px_minmax(0,1fr)_auto] items-center border-b border-rule font-mono text-[15px] last:border-b-0"
              style={{ "--i": i } as CSSProperties}
            >
              <span className="pl-3 text-muted">{row.position}</span>
              <span className="pl-3.5">
                <span className="sr-only">{demo.ruleColumn} </span>
                <span className={row.kept ? undefined : "demo-struck"}>{String(row.amount)}</span>
              </span>
              {row.kept ? (
                <span className="demo-verdict inline-flex items-center gap-1.5 pr-2 font-sans text-[13px] font-semibold text-good">
                  <Check size={14} strokeWidth={3} aria-hidden />
                  kept
                </span>
              ) : (
                <span className="demo-verdict inline-flex items-center gap-1.5 pr-2 font-sans text-[13px] text-pen">
                  <X size={14} strokeWidth={3} aria-hidden />
                  dropped
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Slip>
  );
}
