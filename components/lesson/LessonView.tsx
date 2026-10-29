"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Disclosure, LedgerSheet, Slip } from "@/components/ledger";
import { PlaybackBar } from "@/components/PlaybackBar";
import { ResultTable, resultCountText } from "@/components/ResultTable";
import { FilterStage, filterCountText } from "@/components/stage/FilterStage";
import { datasets } from "@/content/datasets";
import type { LessonDefinition } from "@/content/lessons/types";
import { prefersReducedMotion, usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { canShowAnswer, resultVerdict } from "@/lib/lesson-status";
import { useLesson } from "@/store/lesson";
import { usePlayback } from "@/store/playback";
import { DiagnosticStrip } from "./DiagnosticStrip";
import { QueryEditor } from "./QueryEditor";
import { SchemaCard } from "./SchemaCard";

export function LessonView({ lesson }: { lesson: LessonDefinition }) {
  const { sql, status, fatal, checkerReady, outcome, attempt, scene, result, faded } = useLesson();
  const { lastRunSql, hintsShown, answerShown, completion } = useLesson();
  const { setSql, startOver, run, fade, bringBack, open, showHint, showAnswer } = useLesson();
  const { stepIndex, reset } = usePlayback();
  const reducedMotion = usePrefersReducedMotion();
  const ids = { slip: useId(), keys: useId() };
  const [showDetails, setShowDetails] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const ledger = useRef<HTMLDivElement>(null);
  const bringBackButton = useRef<HTMLButtonElement>(null);
  const approved = outcome.kind === "approved";
  // The text differs from what last ran: verdicts below belong to the old text.
  const edited = lastRunSql !== null && sql !== lastRunSql;
  const showApproved = approved && !edited;
  const table = datasets[lesson.datasetId].tables.find((t) => t.name === lesson.table);
  const allHintsShown = hintsShown >= lesson.hints.length;

  useEffect(() => {
    void open(lesson);
  }, [open, lesson]);

  // Pad the page by the sticky playback footer's height so it never covers the last rows.
  useEffect(() => {
    const el = footer.current;
    if (!el) return;
    const sync = () => page.current?.style.setProperty("--playback-h", `${el.offsetHeight}px`);
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    return () => ro.disconnect();
  }, []);

  // The ledger only plays for an approved answer; anything else leaves it idle.
  const totalSteps = scene?.trace.steps.length ?? 0;
  useEffect(() => {
    if (!approved) reset(0, false);
  }, [approved, reset]);

  const play = useCallback(() => {
    reset(totalSteps, !prefersReducedMotion());
    ledger.current?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [reset, totalSteps]);

  const runQuery = useCallback(async () => {
    if ((await run()).kind === "approved") play();
  }, [run, play]);

  // When the slip fades, focus moves to the way back so it is never lost.
  useEffect(() => {
    if (faded) bringBackButton.current?.focus();
  }, [faded]);

  const step = approved ? scene?.trace.steps[stepIndex] : undefined;
  const durationFor = useCallback(
    (i: number) => Math.min(3500, 900 + (scene?.trace.steps[i]?.narration.length ?? 0) * 22),
    [scene],
  );
  const busy = status === "booting" || status === "preparing-checker" || status === "running";
  const bootLine =
    status === "booting"
      ? "Starting the database. It downloads once, the first time you open a lesson."
      : status === "preparing-checker"
        ? "Preparing the checker, so it can point at mistakes."
        : null;

  return (
    <div
      ref={page}
      className="mx-auto flex w-full max-w-[1440px] flex-wrap items-start gap-14 px-4 pb-[calc(var(--playback-h,0px)+6rem)] pt-10 sm:px-14 sm:pt-14"
    >
      {/* Explanation */}
      <section className="min-w-0 max-w-[520px] flex-[1_1_420px]">
        <h1 className="font-serif text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
          {lesson.headline}
        </h1>
        <p className="mt-[22px] text-lg leading-relaxed">{lesson.explanation.short}</p>
        <Disclosure>
          {lesson.explanation.long.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Disclosure>
        <p className="mt-8 text-base leading-relaxed">
          <strong>The goal.</strong> {lesson.goal.description}
        </p>
        <p className="mt-3 text-base leading-relaxed">
          <strong>Your turn.</strong> The query on the slip has a typo. Run it, follow the red pen to the word that is
          wrong, fix it and run again. Any query that returns the right rows passes.
        </p>
      </section>

      {/* Workspace */}
      <section aria-label="Workspace" className="flex min-w-0 flex-[1.4_1_560px] flex-col gap-8">
        {/* The schema sits beside the slip on wide screens and above it on narrow ones. */}
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
          {table && (
            <div className="lg:col-start-2 lg:row-start-1">
              <SchemaCard table={table} />
            </div>
          )}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <Slip gone={faded}>
              <p id={ids.slip} className="text-sm text-muted">
                Request slip. Type your query below.
              </p>
              <div className="mt-3">
                <QueryEditor value={sql} onChange={setSql} onRun={() => void runQuery()} label="SQL query" describedBy={`${ids.slip} ${ids.keys}`} />
              </div>
              <p id={ids.keys} className="mt-2 text-sm text-muted">
                Enter runs the query. Shift+Enter starts a new line. Escape, then Tab, leaves the slip.
              </p>
              {/* Polite live region: start-up, running, and checker fallback. */}
              <p role="status" aria-live="polite" className="mt-2 flex items-center gap-2 text-sm text-ink empty:mt-0">
                {bootLine && <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />}
                {bootLine ??
                  (status === "ready" && !checkerReady
                    ? "The checker could not load, so mistakes are found by running the query. Everything else works."
                    : null)}
              </p>
              {edited && outcome.kind !== "idle" && (
                <p className="mt-2 text-sm font-semibold">You&apos;ve edited the query since the last run.</p>
              )}

              {outcome.kind === "diagnostic" && (
                <DiagnosticStrip diagnosis={outcome.diagnosis} attempt={attempt} stale={edited} />
              )}

              {outcome.kind === "system" && (
                <p role="alert" className="mt-6 text-base text-pen">
                  {outcome.message} Reload the page to try again.
                </p>
              )}

              {outcome.kind === "wrong" && (
                <div role="alert" className="mt-6">
                  {edited && <p className="mb-1 text-sm text-muted">From your last run. Run again to check your changes.</p>}
                  <p className="font-serif text-2xl font-semibold text-pen">Not approved yet.</p>
                  <p className="mt-2 text-base leading-relaxed">{outcome.hint}</p>
                </div>
              )}

              {showApproved ? (
                <div role="status" className="mt-6">
                  <p className="font-serif text-2xl font-semibold text-good">Approved. The ledger below shows what survived.</p>
                  <p className="mt-2.5 text-base leading-relaxed">
                    {completion === "revealed"
                      ? "You finished with the answer shown, so this exercise counts as revealed, not mastered."
                      : "When you feel sure of WHERE, let the code fade and move on."}
                  </p>
                  <div className="mt-[18px] flex flex-wrap gap-3">
                    <Button onClick={fade}>I&apos;ve got it, fade the code</Button>
                    <Button variant="line" onClick={play}>
                      Show me once more
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={() => void runQuery()} disabled={status !== "ready"}>
                    {busy && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
                    {status === "booting"
                      ? "Starting the database"
                      : status === "preparing-checker"
                        ? "Preparing the checker"
                        : status === "running"
                          ? "Running"
                          : "Run the query"}
                  </Button>
                  <Button variant="line" onClick={startOver} disabled={busy}>
                    Start over
                  </Button>
                </div>
              )}

              {/* Help on request only: hints one at a time, then the answer. */}
              {!showApproved && (
                <div className="mt-5 border-t border-rule pt-4">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="line" onClick={showHint} disabled={allHintsShown || lesson.hints.length === 0}>
                      {allHintsShown ? "No more hints" : hintsShown === 0 ? "Show a hint" : "Show another hint"}
                    </Button>
                    {canShowAnswer(attempt, hintsShown) && !answerShown && (
                      <Button variant="line" onClick={showAnswer}>
                        Show the answer
                      </Button>
                    )}
                  </div>
                  <ol aria-live="polite" className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed empty:hidden">
                    {lesson.hints.slice(0, hintsShown).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ol>
                  {answerShown && (
                    <div aria-live="polite" className="mt-4">
                      <p className="text-[15px]">One answer that works:</p>
                      <p className="mt-1 break-words font-mono text-base">{lesson.goal.referenceSql}</p>
                      <p className="mt-2 text-sm text-muted">
                        You can still finish, but this exercise will count as revealed, not mastered.
                      </p>
                      <Button variant="line" className="mt-3" onClick={() => setSql(lesson.goal.referenceSql)}>
                        Put it on the slip
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {fatal && (
                <p role="alert" className="mt-4 text-base text-pen">
                  {fatal}
                </p>
              )}
            </Slip>

            {faded && (
              <div className="rise border border-ink bg-sheet p-7 shadow-slip">
                <p className="text-[15px] text-muted">The code has faded.</p>
                <h2 className="mt-2.5 font-serif text-[clamp(1.75rem,4vw,2.125rem)] font-semibold tracking-[-0.01em]">
                  You kept only the rows that passed.
                </h2>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button ref={bringBackButton} variant="line" onClick={bringBack}>
                    Bring my code back
                  </Button>
                  <Button variant="line" onClick={play}>
                    Show me once more
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div ref={ledger} className="scroll-mt-4">
          <LedgerSheet
            aria-label="Animation"
            title={lesson.table}
            count={scene ? (approved ? filterCountText(scene, stepIndex) : `${scene.table.rows.length} rows`) : undefined}
            actions={
              <Button variant="line" aria-pressed={showDetails} onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? "Hide other columns" : "Show other columns"}
              </Button>
            }
            footer={
              <div ref={footer} className="sticky bottom-0 z-[2] border-t-2 border-ink bg-sheet">
                <p className="hidden px-5 pt-3 text-sm text-muted sm:block" aria-hidden>
                  {approved && scene ? `Step ${stepIndex + 1} of ${totalSteps}` : " "}
                </p>
                <p aria-live="polite" data-testid="narration" className="min-h-[1.6em] px-5 pt-3 text-[15px] leading-relaxed sm:pt-0">
                  {step?.narration ??
                    (bootLine ??
                      (outcome.kind === "wrong"
                        ? "The ledger plays once your rows match the goal."
                        : "Run your query to see which rows pass the test."))}
                </p>
                <PlaybackBar durationFor={durationFor} reducedMotion={reducedMotion} />
              </div>
            }
          >
            {scene ? (
              <FilterStage scene={scene} stepIndex={approved ? stepIndex : 0} showDetails={showDetails} />
            ) : (
              <p className="py-6 pl-24 pr-5 text-muted">{fatal ?? "Preparing the ledger."}</p>
            )}
          </LedgerSheet>
        </div>

        <LedgerSheet aria-label="Your query's result" title="Your result" count={result ? resultCountText(result) : undefined} margin={false}>
          {result ? (
            <ResultTable result={result} verdict={resultVerdict(outcome.kind, edited)} />
          ) : (
            <p className="px-5 py-4 text-muted">Run a query to see what DuckDB returns.</p>
          )}
        </LedgerSheet>
      </section>
    </div>
  );
}
