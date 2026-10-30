"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, ButtonLink, ConceptTags, Disclosure, NotebookPage, TabList, TabPanel, type TabItem } from "@/components/ledger";
import { PlaybackBar } from "@/components/PlaybackBar";
import { ResultTable, resultCountText } from "@/components/ResultTable";
import { FilterStage, filterCountText } from "@/components/stage/FilterStage";
import { chapterOfLesson } from "@/content/chapters";
import { datasets } from "@/content/datasets";
import { getLesson } from "@/content/lessons";
import type { LessonDefinition } from "@/content/lessons/types";
import { puzzleLines } from "@/engine/clauses";
import { explainBack } from "@/engine/explain-back";
import { formatSql, sameQuery } from "@/engine/format";
import { lex } from "@/engine/lex";
import { prefersReducedMotion, usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { canShowAnswer, resultVerdict } from "@/lib/lesson-status";
import { lessonIdentifiers, useLesson } from "@/store/lesson";
import { usePlayback } from "@/store/playback";
import { DiagnosticStrip } from "./DiagnosticStrip";
import { ExplainBack } from "./ExplainBack";
import { Parsons } from "./Parsons";
import { QueryEditor } from "./QueryEditor";
import { ReadIt } from "./ReadIt";
import { SchemaCard } from "./SchemaCard";
import { SqlLine } from "./SqlLine";
import { StepThrough } from "./StepThrough";

type PanelTab = "run" | "read" | "result" | "columns";

/** "a, b and c" */
const andList = (items: readonly string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Concept tags read as part of a sentence: "Comparison operators" becomes "comparison operators"; SQL words keep their capitals. */
const inSentence = (concept: string) => (/^[A-Z][a-z]/.test(concept) ? concept[0]!.toLowerCase() + concept.slice(1) : concept);

const DEFAULT_TASK =
  "The query below has a typo. Run it and fix the word the red pen circles. Any query that returns the right rows passes.";

export function LessonView({ lesson }: { lesson: LessonDefinition }) {
  const { sql, status, fatal, checkerReady, outcome, attempt, scene, result } = useLesson();
  const { lastRunSql, hintsShown, answerShown, completion, explained, idle } = useLesson();
  const { setSql, startOver, redo, run, open, showHint, showAnswer } = useLesson();
  const { stepIndex, reset } = usePlayback();
  const reducedMotion = usePrefersReducedMotion();
  const ids = { slip: useId(), keys: useId(), tabs: useId() };
  const [showDetails, setShowDetails] = useState(false);
  const [tab, setTab] = useState<PanelTab>("run");
  // Each run (and "Show me once more") walks Watch it run from its first step again.
  const [replay, setReplay] = useState(0);
  // The Parsons puzzle: offered as help once a hint is out.
  const [puzzle, setPuzzle] = useState<"help" | null>(null);
  // Every query on the page is shown in the house style: the slip, the answer, the puzzle.
  const identifiers = useMemo(() => lessonIdentifiers(lesson), [lesson]);
  const tidy = (text: string) => formatSql(text, identifiers);
  const answer = useMemo(() => formatSql(lesson.goal.referenceSql, identifiers), [lesson.goal.referenceSql, identifiers]);
  const lines = useMemo(() => puzzleLines(answer), [answer]);
  // Explain it back: a question about the approved query, or the lesson's own answer if no rule fits it.
  const explainQuestion = useMemo(
    () =>
      outcome.kind === "approved"
        ? (lastRunSql ? explainBack(lastRunSql, lesson.id, result) : null) ?? explainBack(lesson.goal.referenceSql, lesson.id, result)
        : null,
    [outcome.kind, lastRunSql, lesson.id, lesson.goal.referenceSql, result],
  );
  const panel = useRef<HTMLElement>(null);
  const approved = outcome.kind === "approved";
  // The text differs from what last ran: verdicts below belong to the old text.
  // Tidying the layout is not an edit: only a change of words or symbols is.
  const edited = lastRunSql !== null && !sameQuery(sql, lastRunSql);
  const showApproved = approved && !edited;
  // The Columns tab shows every shop table the lesson's query uses, its main table first.
  const used = new Set(lex(lesson.goal.referenceSql).map((t) => t.text.toLowerCase()));
  const schemaTables = datasets[lesson.datasetId].tables
    .filter((t) => t.name === lesson.table || used.has(t.name))
    .sort((a, b) => Number(b.name === lesson.table) - Number(a.name === lesson.table));
  const allHintsShown = hintsShown >= lesson.hints.length;
  const nextLesson = lesson.nextLessonId ? getLesson(lesson.nextLessonId) : undefined;
  const chapter = chapterOfLesson(lesson.id);
  const nextChapter = nextLesson ? chapterOfLesson(nextLesson.id) : undefined;
  const position = chapter ? chapter.lessonIds.indexOf(lesson.id) + 1 : 1;
  const progressLine = !chapter
    ? ""
    : !nextLesson
      ? "That completes the course. "
      : nextChapter?.n !== chapter.n
        ? `That completes ${chapter.name}. `
        : `Lesson ${position} of ${chapter.lessonIds.length} in ${chapter.name}. `;

  useEffect(() => {
    void open(lesson);
  }, [open, lesson]);

  // The ledger plays the learner's own last query; before any run it is idle.
  const ran = !!scene && scene.mode !== "idle";
  const totalSteps = scene?.trace.steps.length ?? 0;
  useEffect(() => {
    if (!ran) reset(0, false);
  }, [ran, reset]);

  // Brings the panel into view after a tab switch renders, only as far as needed.
  const showPanel = useCallback((next: PanelTab) => {
    setTab(next);
    requestAnimationFrame(() =>
      panel.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" }),
    );
  }, []);

  // Every run opens the panel that explains it best: the animation when it can follow the
  // query row by row, Read it when it can only show a simplified view, the plan for EXPLAIN.
  const play = useCallback(() => {
    const scene = useLesson.getState().scene;
    const steps = scene?.trace.steps.length ?? 0;
    // A query plan reads best as text, so EXPLAIN lessons open on the result.
    showPanel(lesson.goal.compare === "explain" ? "result" : "run");
    setReplay((r) => r + 1);
    reset(steps, steps > 1 && !prefersReducedMotion());
  }, [reset, showPanel, lesson.goal.compare]);

  const runQuery = useCallback(async () => {
    const result = await run();
    // Right or wrong, a query that ran gets its own animation.
    if (result.kind === "approved" || result.kind === "wrong") play();
  }, [run, play]);

  // Do it again: a fresh starter slip, and the page back at the top of the exercise.
  const redoLesson = useCallback(() => {
    redo();
    setPuzzle(null);
    requestAnimationFrame(() => document.getElementById(ids.slip)?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" }));
  }, [redo, ids.slip]);

  const step = ran ? scene?.trace.steps[stepIndex] : undefined;
  const durationFor = useCallback(
    (i: number) => Math.min(3500, 900 + (scene?.trace.steps[i]?.narration.length ?? 0) * 22),
    [scene],
  );
  const busy = status === "booting" || status === "preparing-checker" || status === "running";
  const bootLine =
    status === "booting"
      ? // Shown only while the database starts; gone as soon as it is ready.
        "First visit only: downloading about 10 MB. Later visits are instant."
      : status === "preparing-checker"
        ? "Preparing the checker, so it can point at mistakes."
        : null;

  const watchEmpty =
    status === "running" || ((outcome.kind === "approved" || outcome.kind === "wrong") && !explained)
      ? "Reading your query."
      : outcome.kind === "diagnostic"
        ? "Watch it run shows a query once it runs. Fix the word the red pen circled, then run it again."
        : (bootLine ?? "Run your query, then watch what each line does to this table.");

  const readItEmpty =
    status === "running" || ((outcome.kind === "approved" || outcome.kind === "wrong") && !explained)
      ? "Reading your query."
      : outcome.kind === "diagnostic"
        ? "Read it reads a query once it runs. Fix the word the red pen circled, then run it again."
        : "Run your query, and this tab reads it back to you one step at a time, in the order the database runs it.";

  // On a phone the four divider tabs fit one row with their short names.
  const named = (short: string, long: string) => (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  );
  const tabs: TabItem<PanelTab>[] = [
    { id: "run", label: named("Watch", "Watch it run") },
    { id: "read", label: named("Read", "Read it") },
    {
      id: "result",
      label: (
        <>
          {named("Result", "Your result")}
          {result && !result.error && <span className="font-normal text-muted">{result.rows.length}</span>}
        </>
      ),
    },
    { id: "columns", label: "Columns" },
  ];

  return (
    // Phones: lesson, workbench, long version. Wide screens: the lesson and the long
    // version stack in a side column beside the workbench.
    <div className="mx-auto grid w-full max-w-[1440px] items-start gap-x-14 gap-y-8 px-4 pb-20 pt-6 sm:px-14 sm:pt-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      {/* The lesson as a textbook page: number in the margin, headline, words to know, the key idea on ruled lines. */}
      <section className="min-w-0 lg:col-start-1 lg:row-start-1">
        <NotebookPage margin={chapter ? `${chapter.n}.${position}` : undefined}>
          {chapter && (
            <p className="text-sm text-muted">
              Chapter {chapter.n}, lesson {position} of {chapter.lessonIds.length}
            </p>
          )}
          <h1 className="mt-1 font-serif text-[clamp(2rem,1.3rem+2.4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.02em]">
            {lesson.headline}
          </h1>
          <h2 className="mt-5 text-sm text-muted">Words to know</h2>
          <ConceptTags concepts={lesson.concepts} label="Words to know:" className="mt-1.5" />
          <div className="mt-5 border border-ink">
            <h2 className="border-b border-ink bg-paper px-3 py-1.5 font-serif text-base font-semibold">Key idea</h2>
            <p className="ruled px-3 pb-[3px] text-lg" style={{ "--ruled-offset": "-7px" } as CSSProperties}>
              {lesson.explanation.short}
            </p>
          </div>
        </NotebookPage>
      </section>

      {/* The workbench: the slip, then one panel with the animation, the result and the columns. */}
      <section aria-label="Workbench" className="flex min-w-0 flex-col gap-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <NotebookPage>
          <p id={ids.slip} className="text-sm text-muted">
            Request slip
          </p>
          <p className="mt-1 text-base font-medium leading-relaxed">{lesson.goal.description}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">Your turn.</span> {lesson.task ?? DEFAULT_TASK}
          </p>
          <div className="mt-4">
            <QueryEditor value={sql} onChange={setSql} onRun={() => void runQuery()} label="SQL query" describedBy={`${ids.slip} ${ids.keys}`} />
          </div>
          {/* Keyboard tips: read to screen readers everywhere, shown where there is a keyboard-sized screen. */}
          <p id={ids.keys} className="sr-only mt-2 text-sm text-muted sm:not-sr-only">
            Enter runs the query. Shift+Enter starts a new line. Tidy up lays it out one clause per line. Escape, then Tab, leaves the slip.
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
            <div className="mt-6">
              <p role="status" className="font-serif text-2xl font-semibold text-good">
                {lesson.goal.compare === "explain"
                  ? "Approved. DuckDB's plan is in Your result below."
                  : lesson.sandbox
                    ? "Approved. The ledger below shows the result afterwards."
                    : "Approved. Watch it run below, one line at a time."}
              </p>
              <p className="mt-2.5 text-base leading-relaxed">
                {completion === "revealed"
                  ? "You finished with the answer shown, so this exercise counts as revealed, not mastered. Do it again on your own whenever you like."
                  : `${progressLine}You practised ${andList(lesson.concepts.map(inSentence))}. Move on when you feel sure of it, or do it again to practise.`}
              </p>
              {explainQuestion && <ExplainBack key={`${lesson.id}:${lastRunSql}`} question={explainQuestion} />}
              {/* Happy with it: move on, or start the exercise again from the starter slip. */}
              <div className="mt-[18px] flex flex-wrap gap-3">
                {nextLesson ? (
                  <ButtonLink href={`/lesson/${nextLesson.id}`}>Next lesson: {nextLesson.title}</ButtonLink>
                ) : (
                  <ButtonLink href={chapter ? `/chapters#chapter-${chapter.n}` : "/chapters"}>Back to the chapter map</ButtonLink>
                )}
                <Button variant="line" onClick={redoLesson}>
                  Do it again
                </Button>
              </div>
              {!nextLesson && (
                <p className="mt-3 text-[15px] leading-relaxed">That was the last lesson. Every chapter stays open on the map.</p>
              )}
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
              <Button variant="line" onClick={() => setSql(tidy(sql))} disabled={tidy(sql) === sql}>
                Tidy up
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
                {lines && hintsShown > 0 && (
                  <Button variant="line" aria-expanded={puzzle === "help"} onClick={() => setPuzzle((p) => (p === "help" ? null : "help"))}>
                    {puzzle === "help" ? "Hide the puzzle" : "Build it from scrambled lines"}
                  </Button>
                )}
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
              {lines && puzzle === "help" && (
                <div className="mt-4">
                  <Parsons
                    lines={lines}
                    seed={lesson.id}
                    intro="Here are the lines of one answer, shuffled. Tap them in the order you would write them."
                    done="In order. Now write it on the slip and run it."
                  />
                </div>
              )}
              {answerShown && (
                <div aria-live="polite" className="mt-4">
                  <p className="text-[15px]">One answer that works:</p>
                  <div className="mt-1">
                    <SqlLine sql={answer} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    You can still finish, but this exercise will count as revealed, not mastered.
                  </p>
                  <Button variant="line" className="mt-3" onClick={() => setSql(answer)}>
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
        </NotebookPage>

        <section ref={panel} aria-label="Your query" className="min-w-0 scroll-mt-4">
          {/* Notebook divider tabs standing on the page below; the chosen one joins it. */}
          <div className="flex flex-wrap items-end justify-between gap-x-4 border-b-2 border-ink pr-1">
            <TabList tabs={tabs} value={tab} onChange={setTab} idBase={ids.tabs} label="Your query" variant="index" className="px-0" />
            {tab === "run" && lesson.sandbox && (
              <div className="flex flex-wrap items-center gap-x-3 py-1.5 pl-4">
                <p className="text-[15px] text-muted">
                  {scene ? `${scene.table.name}: ${filterCountText(scene, ran ? stepIndex : 0)}` : lesson.table}
                </p>
                <Button variant="line" aria-pressed={showDetails} onClick={() => setShowDetails((v) => !v)}>
                  {showDetails ? "Hide other columns" : "Show other columns"}
                </Button>
              </div>
            )}
          </div>

          <div className="border border-t-0 border-ink bg-sheet">
            <TabPanel idBase={ids.tabs} id="run" selected={tab === "run"}>
              {!lesson.sandbox ? (
                <StepThrough
                  explained={explained}
                  sql={sql}
                  empty={watchEmpty}
                  preview={idle ? { name: idle.table.name, columns: idle.table.columns, rows: idle.table.rows.map((r) => r.cells) } : null}
                  replay={replay}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <>
                  {/* Lessons that change data: the table before, then afterwards with the changed rows marked. */}
                  {ran && scene && edited && (
                    <div className="border-b border-rule px-5 py-3">
                      <p className="text-sm text-muted">Animating your last run:</p>
                      <SqlLine sql={scene.sql.trim()} />
                    </div>
                  )}
                  {scene?.banner && (
                    <p role="status" className="border-b border-rule bg-wash px-5 py-3 text-[15px] font-semibold">
                      {scene.banner}.{" "}
                      <span className="font-normal">
                        {scene.verdicts
                          ? "The verdicts below come from running your query; the real result is in Your result."
                          : "Your real result is in Your result."}
                      </span>
                    </p>
                  )}
                  {/* Controls and narration sit above the rows, so they stay in view with them. */}
                  <div className="border-b border-rule">
                    <p className="hidden px-5 pt-3 text-sm text-muted sm:block" aria-hidden>
                      {ran && totalSteps > 1 ? `Step ${stepIndex + 1} of ${totalSteps}` : "\u00a0"}
                    </p>
                    <p aria-live="polite" data-testid="narration" className="min-h-[1.6em] px-5 pt-3 text-[15px] leading-relaxed sm:pt-0">
                      {step?.narration ??
                        bootLine ??
                        (lesson.sandbox ? scene?.trace.steps[0]?.narration : null) ??
                        "Run your statement to see the table afterwards."}
                    </p>
                    {/* Nothing to play in a before-and-after table: no controls that do nothing. */}
                    {totalSteps > 1 ? <PlaybackBar durationFor={durationFor} reducedMotion={reducedMotion} /> : <div className="pb-3" />}
                  </div>
                  {/* The rows scroll inside this box; the page stays put. */}
                  <div data-ledger-scroll data-lenis-prevent className="h-[min(20rem,38svh)] overflow-y-auto overscroll-contain">
                    <div className="relative">
                      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[72px] z-[1] border-l-2 border-margin" />
                      {scene && scene.table.rows.length === 0 ? (
                        <p className="py-6 pl-24 pr-5 text-muted">No rows yet.</p>
                      ) : scene ? (
                        <FilterStage scene={scene} stepIndex={ran ? stepIndex : 0} showDetails={showDetails} />
                      ) : (
                        <p className="py-6 pl-24 pr-5 text-muted">{fatal ?? "Preparing the ledger."}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabPanel>

            <TabPanel idBase={ids.tabs} id="read" selected={tab === "read"}>
              {/* Several steps with figures: they scroll inside this box, and the page stays put. */}
              <div data-lenis-prevent className="max-h-[min(32rem,60svh)] overflow-y-auto overscroll-contain">
                <ReadIt explained={explained} sql={sql} empty={readItEmpty} tables={datasets[lesson.datasetId].tables} />
              </div>
            </TabPanel>

            <TabPanel idBase={ids.tabs} id="result" selected={tab === "result"}>
              <p className="border-b border-rule px-5 py-2.5 text-[15px] text-muted">
                {result ? resultCountText(result) : "Run a query to see what DuckDB returns."}
              </p>
              {result && (
                <ResultTable result={result} verdict={resultVerdict(outcome.kind, edited)} scrollClassName="max-h-[min(20rem,40svh)]" />
              )}
            </TabPanel>

            <TabPanel idBase={ids.tabs} id="columns" selected={tab === "columns"}>
              {schemaTables.length > 0 ? (
                schemaTables.map((t) => <SchemaCard key={t.name} table={t} framed={false} />)
              ) : (
                <p className="px-5 py-4 text-[15px] text-muted">
                  This lesson&apos;s table is made by your statement, so its columns are the ones the request names.
                </p>
              )}
            </TabPanel>
          </div>
        </section>
      </section>

      <section aria-label="More about this lesson" className="min-w-0 lg:col-start-1 lg:row-start-2">
        <Disclosure>
          {lesson.explanation.long.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Disclosure>
      </section>
    </div>
  );
}
