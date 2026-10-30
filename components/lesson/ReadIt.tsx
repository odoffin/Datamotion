"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, MarginNote } from "@/components/ledger";
import { ResultTable } from "@/components/ResultTable";
import { SAMPLE_ROWS, type Explanation, type MatchFigure, type VerdictFigure } from "@/engine/explain";
import { sameQuery } from "@/engine/format";
import { inPlainWords, piecesOf, SPACING_NOTE, type PieceOptions } from "@/engine/pieces";
import type { QueryResult } from "@/engine/query-runner";
import { readOnlyRunner } from "@/lib/engine/db";
import { DragNumber } from "./DragNumber";
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

/** Tables already fetched, by query, so stepping back and forth does not run them again. */
const fetched = new Map<string, QueryResult>();

/** The real table after a step: its first rows, fetched when the step is opened. */
function StepTable({ sql }: { sql: string }) {
  const [, setVersion] = useState(0);
  const result = fetched.get(sql);
  useEffect(() => {
    if (fetched.has(sql)) return;
    let live = true;
    void readOnlyRunner.run(sql).then((res) => {
      fetched.set(sql, res);
      if (live) setVersion((v) => v + 1);
    });
    return () => {
      live = false;
    };
  }, [sql]);
  if (!result) return <p className="mt-3 text-sm text-muted">Fetching the table after this step.</p>;
  if (result.error) return null;
  return (
    <div className="mt-3 border border-ink bg-sheet">
      <p className="px-3 py-2 text-sm text-muted">
        The table after this step{result.rows.length === SAMPLE_ROWS ? `: its first ${SAMPLE_ROWS} rows` : ""}
      </p>
      <ResultTable result={result} scrollClassName="max-h-[15rem]" />
    </div>
  );
}

interface ReadItProps {
  explained: { sql: string; explanation: Explanation } | null;
  /** The text on the slip now; when it differs, the panel says which run it reads. */
  sql: string;
  /** What to say while there is nothing to read yet. */
  empty: string;
  /** The lesson's tables, so Piece by piece can tell a table from a column. */
  tables: PieceOptions["tables"];
}

/** Every word and mark of the query with what it means, under the line it sits on. */
function PieceByPiece({ sql, tables }: { sql: string; tables: PieceOptions["tables"] }) {
  const lines = useMemo(() => piecesOf(sql.trim(), { tables }), [sql, tables]);
  if (!lines.length) return null;
  return (
    <section aria-labelledby="pieces-title" className="border-b border-rule px-5 py-4">
      <h3 id="pieces-title" className="font-serif text-xl font-semibold">
        Piece by piece
      </h3>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">{SPACING_NOTE}</p>
      <ol className="mt-3 space-y-4">
        {lines.map((line, i) => (
          <li key={i}>
            <SqlLine sql={line.code} />
            <dl className="mt-1.5 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 pl-3 text-[15px] leading-snug">
              {line.pieces.map((p, k) => (
                <div key={k} className="contents">
                  <dt>
                    <code className="inline-block whitespace-pre rounded-btn border border-rule bg-paper px-1.5 font-mono text-[14px] text-ink">{p.text}</code>
                  </dt>
                  <dd>{p.meaning}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The learner's query read back in the order the database runs it: one ledger
 * line per step, a red-pen word in the margin, the clause as written, what it
 * does in plain words and the rows going in and out. One step at a time is
 * open: it shows the real table after it, its figure, and a number to drag.
 */
export function ReadIt({ explained, sql, empty, tables }: ReadItProps) {
  // The open step belongs to one run; a new run starts again at the first step.
  const [open, setOpen] = useState({ sql: "", step: 0 });
  const items = useRef<(HTMLLIElement | null)[]>([]);
  if (!explained) return <p className="px-5 py-5 text-[15px] leading-relaxed text-muted">{empty}</p>;
  const { steps, note } = explained.explanation;
  if (steps.length === 0) {
    return (
      <p className="px-5 py-5 text-[15px] leading-relaxed text-muted">
        This query is more than Read it can follow yet. Your result shows what it returned.
      </p>
    );
  }
  const active = open.sql === explained.sql ? Math.min(open.step, steps.length - 1) : 0;
  const go = (step: number) => {
    setOpen({ sql: explained.sql, step });
    requestAnimationFrame(() => items.current[step]?.scrollIntoView({ block: "nearest" }));
  };
  const margin = (i: number) => (steps.length === 1 ? "" : i === 0 ? "first" : i === steps.length - 1 ? "last" : "then");
  return (
    <div>
      {!sameQuery(explained.sql, sql) && (
        <div className="border-b border-rule px-5 py-3">
          <p className="text-sm text-muted">Reading your last run:</p>
          <SqlLine sql={explained.sql.trim()} />
        </div>
      )}
      {/* The whole query in one sentence, then every piece of it, then the steps. */}
      <section aria-labelledby="plain-title" className="border-b border-rule px-5 py-4">
        <h3 id="plain-title" className="text-sm text-muted">
          In plain words
        </h3>
        <p className="mt-1 font-serif text-xl leading-snug">{inPlainWords(steps.map((s) => s.sentence))}</p>
      </section>
      <PieceByPiece sql={explained.sql} tables={tables} />
      {note && <p className="border-b border-rule bg-wash px-5 py-3 text-[15px] font-semibold">{note}</p>}
      {steps.length > 1 && (
        // Stays at the top of the scrolling panel, so stepping is always one click away.
        <div className="sticky top-0 z-[2] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule bg-sheet px-5 py-2.5">
          <p className="text-sm text-muted">
            Step {active + 1} of {steps.length}
            <span className="hidden sm:inline">. Step through to see the table after each one.</span>
          </p>
          <div className="flex gap-2">
            <Button variant="line" onClick={() => go(active - 1)} disabled={active === 0}>
              Previous step
            </Button>
            <Button variant="line" onClick={() => go(active + 1)} disabled={active === steps.length - 1}>
              Next step
            </Button>
          </div>
        </div>
      )}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-12 border-l-2 border-margin sm:left-[72px]" />
        <ol>
          {steps.map((s, i) => {
            const isOpen = i === active;
            return (
              <li
                key={i}
                ref={(el) => {
                  items.current[i] = el;
                }}
                aria-current={isOpen ? "step" : undefined}
                className={`grid grid-cols-[3rem_minmax(0,1fr)] border-b border-rule last:border-b-0 sm:grid-cols-[72px_minmax(0,1fr)] ${
                  isOpen ? "bg-wash shadow-[inset_4px_0_0_var(--ink)]" : ""
                }`}
              >
                <span aria-hidden className="pr-1.5 pt-3.5 text-right sm:pr-3">
                  <MarginNote className="text-[19px] sm:text-[22px]">{margin(i)}</MarginNote>
                </span>
                <div className="min-w-0 py-3.5 pl-3 pr-3 sm:pl-5 sm:pr-5">
                  <SqlLine sql={s.sql} />
                  <p className="mt-1.5 text-[15px] leading-relaxed">{s.sentence}</p>
                  {s.count && <p className="mt-1 text-sm text-muted">{s.count}</p>}
                  {isOpen ? (
                    <>
                      {s.figure?.kind === "verdicts" && <Verdicts figure={s.figure} />}
                      {s.figure?.kind === "matches" && <Matches figure={s.figure} />}
                      {s.tweak && <DragNumber key={`${explained.sql}:${i}`} tweak={s.tweak} />}
                      {s.table && <StepTable sql={s.table} />}
                    </>
                  ) : (
                    (s.table || s.figure || s.tweak) && (
                      <button type="button" onClick={() => go(i)} className="-my-2 mt-0 py-2 text-sm font-semibold text-ink underline">
                        Open this step
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
