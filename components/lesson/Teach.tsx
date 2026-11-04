"use client";

import { useEffect, useMemo, useState } from "react";
import { NotebookPage } from "@/components/ledger";
import { formatCell } from "@/components/stage/format";
import type { LessonDefinition } from "@/content/lessons/types";
import { formatSql } from "@/engine/format";
import type { QueryResult } from "@/engine/query-runner";
import { splitStatements } from "@/engine/sandbox";
import { readOnlyRunner, sandboxExec } from "@/lib/engine/db";
import { SqlLine } from "./SqlLine";

/** Rows of the example's result shown on the page. */
const SHOWN = 6;

/** The worked example's real result, run once the lesson's data is loaded. */
function useExample(lesson: LessonDefinition, ready: boolean): QueryResult | null {
  const [result, setResult] = useState<{ id: string; result: QueryResult } | null>(null);
  const example = lesson.teach?.example;
  useEffect(() => {
    if (!ready || !example) return;
    let live = true;
    const run = async (): Promise<QueryResult> => {
      if (!lesson.sandbox) return readOnlyRunner.run(example.sql);
      // Lessons that change data: run on a fresh copy, then show the table afterwards.
      const statements = splitStatements(example.sql) ?? [];
      const ran = await sandboxExec({ setup: lesson.sandbox.setup, ...(example.check ? { check: example.check } : {}) }, statements);
      return ran.ok ? ran.result : { columns: [], rows: [], ms: 0, error: ran.error };
    };
    void run().then((r) => {
      if (live) setResult({ id: lesson.id, result: r });
    });
    return () => {
      live = false;
    };
  }, [ready, example, lesson.id, lesson.sandbox]);
  return result?.id === lesson.id ? result.result : null;
}

function ExampleTable({ result }: { result: QueryResult }) {
  if (result.error) return <p className="mt-2 text-sm text-muted">The example could not run here.</p>;
  if (!result.rows.length) return <p className="mt-2 text-sm text-muted">It returns no rows.</p>;
  return (
    <div className="mt-2 overflow-x-auto border border-rule bg-sheet" data-lenis-prevent>
      <table className="w-full border-collapse font-mono text-sm">
        <caption className="sr-only">The example&apos;s result</caption>
        <thead>
          <tr>
            {result.columns.map((c, i) => (
              <th key={`${c}-${i}`} scope="col" className="border-b-2 border-ink px-3 py-1.5 text-left font-medium text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, SHOWN).map((row, r) => (
            <tr key={r} className="border-b border-rule last:border-b-0">
              {row.map((cell, c) => (
                <td key={c} className="whitespace-pre px-3 py-1.5 align-top tabular-nums">
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > SHOWN && (
        <p className="border-t border-rule px-3 py-1.5 font-sans text-sm text-muted">
          The first {SHOWN} of {result.rows.length} rows.
        </p>
      )}
    </div>
  );
}

const HEADING = "font-serif text-lg font-semibold";

/**
 * Explained simply: the lesson's idea taught like a textbook page, in words a
 * young child could follow. An everyday picture, how it works step by step, a
 * worked example run on the real data, the usual mistake, and one line to
 * keep, written in highlighter.
 */
export function Teach({ lesson, ready, identifiers }: { lesson: LessonDefinition; ready: boolean; identifiers: readonly string[] }) {
  const t = lesson.teach;
  const result = useExample(lesson, ready);
  const sql = useMemo(() => (t ? formatSql(t.example.sql, identifiers) : ""), [t, identifiers]);
  if (!t) return null;
  return (
    <NotebookPage aria-labelledby="teach-title">
      <h2 id="teach-title" className="font-serif text-2xl font-semibold">
        Explained simply
      </h2>

      <section className="mt-4">
        <h3 className={HEADING}>Think of it like this</h3>
        <p className="mt-1 text-base leading-relaxed">{t.picture}</p>
      </section>

      <section className="mt-5">
        <h3 className={HEADING}>How it works</h3>
        <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-base leading-relaxed marker:font-mono marker:text-muted">
          {t.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="mt-5">
        <h3 className={HEADING}>Example</h3>
        <p className="mt-1 text-sm text-muted">On other data than your exercise, so it shows the idea without giving the answer away.</p>
        <div className="mt-2 border-l-2 border-ink pl-3">
          <SqlLine sql={sql} />
        </div>
        <p className="mt-2 text-base leading-relaxed">{t.example.says}</p>
        {result ? <ExampleTable result={result} /> : <p className="mt-2 text-sm text-muted">{ready ? "Running the example." : "The example runs once the database is ready."}</p>}
      </section>

      <section className="mt-5">
        <h3 className={`${HEADING} text-pen`}>Watch out</h3>
        <p className="mt-1 text-base leading-relaxed">{t.watchOut}</p>
      </section>

      <section className="mt-5">
        <h3 className={HEADING}>Remember</h3>
        <p className="mt-1 text-base leading-relaxed">
          <mark className="bg-marker px-1 text-ink">{t.remember}</mark>
        </p>
      </section>
    </NotebookPage>
  );
}
