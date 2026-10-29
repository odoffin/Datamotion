"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useId } from "react";
import { Button, Disclosure, LedgerSheet, MarginNote, Slip } from "@/components/ledger";
import { PlaybackBar } from "@/components/PlaybackBar";
import { ResultTable, resultCountText } from "@/components/ResultTable";
import { SqlViewer } from "@/components/SqlViewer";
import { FilterStage, filterCountText } from "@/components/stage/FilterStage";
import { filterLesson } from "@/content/lessons/filter";
import { prefersReducedMotion, usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { currentSql, useFilterLesson } from "@/store/filter-lesson";
import { usePlayback } from "@/store/playback";

const field =
  "min-h-11 w-full rounded-none border-0 border-b-2 border-ink bg-transparent px-1 font-mono text-lg text-ink";

export function FilterLesson() {
  const { slots, status, error, scene, result, dirty, setSlot, resetSlots, boot, run } = useFilterLesson();
  const { stepIndex, reset } = usePlayback();
  const reducedMotion = usePrefersReducedMotion();
  const ids = { column: useId(), operator: useId(), threshold: useId(), error: useId() };
  const s = filterLesson.editableSlots;

  const runAndPlay = useCallback(async () => {
    if (await run()) {
      // Read live: on the first run the hook still holds its server value.
      reset(useFilterLesson.getState().scene?.trace.steps.length ?? 0, !prefersReducedMotion());
    }
  }, [run, reset]);

  // Boot DuckDB on the client, then run the default query once.
  useEffect(() => {
    void (async () => {
      if (useFilterLesson.getState().status === "booting") await boot();
      if (useFilterLesson.getState().status === "ready" && !useFilterLesson.getState().scene) {
        await runAndPlay();
      }
    })();
  }, [boot, runAndPlay]);

  const sql = currentSql(slots);
  const step = scene?.trace.steps[stepIndex];
  const durationFor = useCallback(
    (i: number) => {
      const len = scene?.trace.steps[i]?.narration.length ?? 0;
      return Math.min(3500, 900 + len * 22);
    },
    [scene],
  );

  const matches =
    !!scene &&
    !!result &&
    JSON.stringify(result.rows) ===
      JSON.stringify(
        scene.table.rows.filter((r) => scene.trace.resultRowIds.includes(r.rid)).map((r) => r.cells),
      );

  const busy = status === "booting" || status === "running";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-start gap-14 px-4 pb-24 pt-10 sm:px-14 sm:pt-14">
      {/* Explanation */}
      <section className="min-w-0 max-w-[520px] flex-[1_1_420px]">
        <h1 className="font-serif text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
          {filterLesson.headline}
        </h1>
        <p className="mt-[22px] text-lg leading-relaxed">{filterLesson.explanation.short}</p>
        <Disclosure>
          {filterLesson.explanation.long.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Disclosure>
        <p className="mt-8 text-base leading-relaxed">
          <strong>Your turn.</strong> Change the column, the comparison or the threshold on the slip, run it,
          and watch which rows survive. Try the same number with &gt; and then &gt;=.
        </p>
      </section>

      {/* Workspace */}
      <section aria-label="Workspace" className="flex min-w-0 flex-[1.4_1_560px] flex-col gap-8">
        <Slip>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAndPlay();
            }}
            aria-describedby={error ? ids.error : undefined}
          >
            <p className="text-sm text-muted">Request slip. Build your query below.</p>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,1fr)_6rem_11rem]">
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.column} className="text-sm text-muted">{s.column.label}</label>
                <select id={ids.column} className={field} value={slots.column} onChange={(e) => setSlot("column", e.target.value)}>
                  {s.column.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.operator} className="text-sm text-muted">{s.operator.label}</label>
                <select id={ids.operator} className={field} value={slots.operator} onChange={(e) => setSlot("operator", e.target.value)}>
                  {s.operator.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                <label htmlFor={ids.threshold} className="text-sm text-muted">{s.threshold.label}</label>
                <input
                  id={ids.threshold}
                  type="number"
                  inputMode="decimal"
                  step={s.threshold.step ?? "any"}
                  className={field}
                  value={slots.threshold}
                  onChange={(e) => setSlot("threshold", e.target.value)}
                  aria-invalid={sql === null}
                />
                <MarginNote aria-hidden className="mt-1 whitespace-nowrap text-right text-[22px]">
                  watch the boundary
                </MarginNote>
              </div>
            </div>

            <div className="mt-6">
              <SqlViewer value={sql ?? "-- Enter a number for the threshold"} label="SQL query (read-only)" />
              <p className="mt-2 text-sm text-muted">
                {dirty ? "Edited. Run it to see the new verdicts. " : ""}
                The query is built from the choices above. Free typing arrives in the next version.
              </p>
            </div>

            {error && (
              <p id={ids.error} role="alert" className="mt-4 text-base text-pen">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="submit" disabled={status !== "ready" || sql === null}>
                {busy && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
                {status === "booting" ? "Starting the database" : status === "running" ? "Running" : "Run the query"}
              </Button>
              <Button variant="line" onClick={resetSlots} disabled={busy}>
                Start over
              </Button>
            </div>
          </form>
        </Slip>

        <LedgerSheet
          aria-label="Animation"
          title={filterLesson.table}
          count={scene ? filterCountText(scene, stepIndex) : undefined}
          footer={
            <div className="sticky bottom-0 z-[2] border-t-2 border-ink bg-sheet">
              <p className="hidden px-5 pt-3 text-sm text-muted sm:block" aria-hidden>
                {scene ? `Step ${stepIndex + 1} of ${scene.trace.steps.length}` : " "}
              </p>
              <p aria-live="polite" data-testid="narration" className="min-h-[1.6em] px-5 pt-3 text-[15px] sm:pt-0 leading-relaxed">
                {step?.narration ?? (status === "error" ? "" : "Starting the database. This takes a moment the first time.")}
              </p>
              <PlaybackBar durationFor={durationFor} reducedMotion={reducedMotion} />
            </div>
          }
        >
          {scene ? (
            <FilterStage scene={scene} stepIndex={stepIndex} />
          ) : (
            <p className="py-6 pl-24 pr-5 text-muted">{status === "error" ? error : "Preparing the ledger."}</p>
          )}
        </LedgerSheet>

        <LedgerSheet
          aria-label="Real query result"
          title="Real result"
          count={result ? resultCountText(result) : undefined}
          margin={false}
        >
          {result ? (
            <ResultTable result={result} matchesAnimation={matches} />
          ) : (
            <p className="px-5 py-4 text-muted">Run the query to see what DuckDB returns.</p>
          )}
        </LedgerSheet>
      </section>
    </div>
  );
}
