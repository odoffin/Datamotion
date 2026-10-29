"use client";

import { LoaderCircle } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useId } from "react";
import { filterLesson } from "@/content/lessons/filter";
import { PlaybackBar } from "@/components/PlaybackBar";
import { ResultTable } from "@/components/ResultTable";
import { SqlViewer } from "@/components/SqlViewer";
import { FilterStage } from "@/components/stage/FilterStage";
import { prefersReducedMotion, usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { currentSql, useFilterLesson } from "@/store/filter-lesson";
import { usePlayback } from "@/store/playback";

const control =
  "h-9 w-full rounded-md border border-border bg-bg px-2 font-mono text-sm text-text";

export function FilterLesson() {
  const { slots, status, error, scene, result, dirty, setSlot, boot, run } = useFilterLesson();
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

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid flex-1 grid-cols-1 lg:h-[calc(100dvh-3rem)] lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)]">
        {/* Left: lesson text and controls */}
        <aside className="flex flex-col gap-5 overflow-auto border-border p-5 lg:border-r">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Lesson</p>
            <h1 className="text-xl font-semibold tracking-tight">{filterLesson.title}</h1>
            <p className="text-sm leading-relaxed text-text-secondary">{filterLesson.explanation}</p>
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void runAndPlay();
            }}
            aria-describedby={error ? ids.error : undefined}
          >
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.column} className="text-xs text-text-secondary">{s.column.label}</label>
                <select id={ids.column} className={control} value={slots.column} onChange={(e) => setSlot("column", e.target.value)}>
                  {s.column.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.operator} className="text-xs text-text-secondary">{s.operator.label}</label>
                <select id={ids.operator} className={`${control} w-20`} value={slots.operator} onChange={(e) => setSlot("operator", e.target.value)}>
                  {s.operator.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.threshold} className="text-xs text-text-secondary">{s.threshold.label}</label>
              <input
                id={ids.threshold}
                type="number"
                inputMode="decimal"
                step={s.threshold.step ?? "any"}
                className={control}
                value={slots.threshold}
                onChange={(e) => setSlot("threshold", e.target.value)}
                aria-invalid={sql === null}
              />
            </div>
            <button
              type="submit"
              disabled={status !== "ready" || sql === null}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-bg disabled:opacity-50"
            >
              {(status === "booting" || status === "running") && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
              {status === "booting" ? "Starting database…" : status === "running" ? "Running…" : "Run"}
            </button>
            {error && (
              <p id={ids.error} role="alert" className="text-sm text-text">
                {error}
              </p>
            )}
          </form>

          <div className="flex flex-col gap-2">
            <SqlViewer value={sql ?? "-- Enter a number for the threshold"} label="SQL query (read-only)" />
            <p className="text-xs text-text-secondary">
              {dirty ? "Edited. Press Run to see it play. " : ""}
              The query is rebuilt from the controls above. Free-form editing arrives in a later version.
            </p>
          </div>
        </aside>

        {/* Centre: narration, stage, playback */}
        <section aria-label="Animation" className="flex min-h-[32rem] min-w-0 flex-col bg-stage">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs tabular-nums text-text-secondary" aria-hidden>
              {scene ? `Step ${stepIndex + 1} of ${scene.trace.steps.length}` : " "}
            </p>
            <p aria-live="polite" data-testid="narration" className="min-h-6 text-sm font-medium text-text">
              {step?.narration ?? (status === "error" ? "" : "Loading the database…")}
            </p>
          </div>
          <div className="relative min-h-[28rem] flex-1 lg:min-h-0">
            {scene ? (
              <FilterStage scene={scene} stepIndex={stepIndex} />
            ) : (
              <p className="p-4 text-sm text-text-secondary">
                {status === "error" ? error : "Preparing the stage…"}
              </p>
            )}
          </div>
          <PlaybackBar durationFor={durationFor} reducedMotion={reducedMotion} />
        </section>

        {/* Right: the real result from DuckDB */}
        <aside aria-label="Real query result" className="flex min-h-0 flex-col gap-3 border-border p-5 lg:border-l">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Real result</h2>
          {result ? (
            <ResultTable result={result} matchesAnimation={matches} />
          ) : (
            <p className="text-sm text-text-secondary">Run the query to see DuckDB&apos;s output.</p>
          )}
        </aside>
      </div>
    </MotionConfig>
  );
}
