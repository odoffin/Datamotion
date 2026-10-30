import { ArrowRight, Check, X } from "lucide-react";
import { MarginNote } from "@/components/ledger";
import type { Explanation, MatchFigure, VerdictFigure } from "@/engine/explain";
import { SqlLine } from "./SqlLine";

const VERDICT = "inline-flex items-center gap-1 whitespace-nowrap font-semibold";

/** A few rows of the scan, each with its verdict: the test applied to real values. */
function Verdicts({ figure }: { figure: VerdictFigure }) {
  return (
    <table className="mt-3 w-full max-w-md border-collapse text-sm">
      <caption className="sr-only">The first rows the test looks at, and what happens to each</caption>
      <thead>
        <tr className="border-b border-ink text-left text-muted">
          <th scope="col" className="py-1 pr-3 font-normal">
            Row
          </th>
          {figure.columns.map((c) => (
            <th key={c} scope="col" className="py-1 pr-3 font-mono font-normal">
              {c}
            </th>
          ))}
          <th scope="col" className="py-1 text-right font-normal">
            Verdict
          </th>
        </tr>
      </thead>
      <tbody>
        {figure.rows.map((r) => (
          <tr key={r.n} className="border-b border-rule last:border-b-0">
            <td className="py-1.5 pr-3 font-mono text-muted">{r.n}</td>
            {r.cells.map((cell, i) => (
              <td key={i} className={`py-1.5 pr-3 font-mono ${r.kept ? "" : "text-muted line-through"}`}>
                {cell}
              </td>
            ))}
            <td className="py-1.5 text-right">
              {r.kept ? (
                <span className={`${VERDICT} text-good`}>
                  <Check size={14} strokeWidth={3} aria-hidden />
                  kept
                </span>
              ) : (
                <span className={`${VERDICT} text-pen`}>
                  <X size={14} strokeWidth={3} aria-hidden />
                  {r.unknown ? "dropped: unknown" : "dropped"}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A join drawn as matching rows: each left row, the right rows it meets, and what comes out. */
function Matches({ figure }: { figure: MatchFigure }) {
  const { left, right } = figure;
  const several = figure.rows.some((r) => r.matches.length > 1);
  const rightColumn = `${right.name}.${right.label ?? right.key}`;
  return (
    <>
      <table className="mt-3 w-full border-collapse text-sm">
        <caption className="sr-only">
          A few rows of {left.name}, the {right.name} rows each one matches, and the rows that come out
        </caption>
        <thead>
          <tr className="border-b border-ink text-left text-muted">
            {left.label && (
              <th scope="col" className="hidden py-1 pr-3 font-mono font-normal sm:table-cell">
                {left.name}.{left.label}
              </th>
            )}
            <th scope="col" className="py-1 pr-2 font-mono font-normal">
              {left.name}.{left.key}
            </th>
            <th scope="col" className="w-6 py-1">
              <span className="sr-only">matches</span>
            </th>
            <th scope="col" className="py-1 pr-3 font-mono font-normal">
              {rightColumn}
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              Rows out
            </th>
          </tr>
        </thead>
        <tbody>
          {figure.rows.map((r, i) => {
            const none = r.matches.length === 0;
            return (
              <tr key={i} className="border-b border-rule align-top last:border-b-0">
                {left.label && <td className="hidden py-1.5 pr-3 sm:table-cell">{r.label}</td>}
                <td className="py-1.5 pr-2 font-mono">{r.key}</td>
                <td className="py-1.5 text-muted">
                  <ArrowRight size={14} className="mt-0.5" aria-hidden />
                </td>
                <td className={`py-1.5 pr-3 ${none ? "text-muted" : ""}`}>{none ? "no match" : r.matches.join(", ")}</td>
                <td className="py-1.5 text-right">
                  {!none ? (
                    <span className={`${VERDICT} text-good`}>
                      <Check size={14} strokeWidth={3} aria-hidden />
                      {r.matches.length === 1 ? "1 row" : `${r.matches.length} rows`}
                    </span>
                  ) : figure.keepsUnmatched ? (
                    <span className="inline-flex items-start gap-1 font-semibold text-good">
                      <Check size={14} strokeWidth={3} className="mt-0.5 shrink-0" aria-hidden />1 row, with NULL
                    </span>
                  ) : (
                    <span className={`${VERDICT} text-pen`}>
                      <X size={14} strokeWidth={3} aria-hidden />
                      dropped
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {several && (
        <p className="mt-2 text-sm text-muted">A row comes out once for every match, so two matches make two rows.</p>
      )}
    </>
  );
}

interface ReadItProps {
  explained: { sql: string; explanation: Explanation } | null;
  /** The text on the slip now; when it differs, the panel says which run it reads. */
  sql: string;
  /** What to say while there is nothing to read yet. */
  empty: string;
}

/**
 * The learner's query read back in the order the database runs it: one ledger
 * line per step, a red-pen word in the margin, the clause as written, what it
 * does in plain words and the rows going in and out.
 */
export function ReadIt({ explained, sql, empty }: ReadItProps) {
  if (!explained) return <p className="px-5 py-5 text-[15px] leading-relaxed text-muted">{empty}</p>;
  const { steps, note } = explained.explanation;
  if (steps.length === 0) {
    return (
      <p className="px-5 py-5 text-[15px] leading-relaxed text-muted">
        This query is more than Read it can follow yet. Your result shows what it returned.
      </p>
    );
  }
  const margin = (i: number) => (steps.length === 1 ? "" : i === 0 ? "first" : i === steps.length - 1 ? "last" : "then");
  return (
    <div>
      {explained.sql !== sql && (
        <div className="border-b border-rule px-5 py-3">
          <p className="text-sm text-muted">Reading your last run:</p>
          <SqlLine sql={explained.sql.trim()} />
        </div>
      )}
      {note && <p className="border-b border-rule bg-wash px-5 py-3 text-[15px] font-semibold">{note}</p>}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-12 border-l-2 border-margin sm:left-[72px]" />
        <ol>
          {steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[3rem_minmax(0,1fr)] border-b border-rule last:border-b-0 sm:grid-cols-[72px_minmax(0,1fr)]">
              <span aria-hidden className="pr-1.5 pt-3.5 text-right sm:pr-3">
                <MarginNote className="text-[19px] sm:text-[22px]">{margin(i)}</MarginNote>
              </span>
              <div className="min-w-0 py-3.5 pl-3 pr-3 sm:pl-5 sm:pr-5">
                <SqlLine sql={s.sql} />
                <p className="mt-1.5 text-[15px] leading-relaxed">{s.sentence}</p>
                {s.count && <p className="mt-1 text-sm text-muted">{s.count}</p>}
                {s.figure?.kind === "verdicts" && <Verdicts figure={s.figure} />}
                {s.figure?.kind === "matches" && <Matches figure={s.figure} />}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
