"use client";

import { Check, Clock, Eye, PenLine } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Breadcrumb, Button, ButtonLink, ConceptTags, Disclosure, LedgerSheet, MarginNote } from "@/components/ledger";
import { chapterByNumber, chapterGroups, chapterOfLesson, chapters, type Chapter } from "@/content/chapters";
import { getLesson } from "@/content/lessons";
import { chapterEntry, chapterStatus, countsLine, prerequisiteText, statusCounts, type ChapterStatus } from "@/lib/chapter-status";
import { prefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { useProgressHydrated } from "@/lib/hooks/use-progress-hydrated";
import { lessonProgress, useProgress } from "@/store/progress";

const LEGEND: { status: ChapterStatus; meaning: string }[] = [
  { status: "done", meaning: "You finished every lesson in the chapter." },
  { status: "in progress", meaning: "You have opened or run a lesson here but not finished it." },
  { status: "not started", meaning: "Lessons are ready; you have not opened them yet." },
  { status: "looked familiar in the quiz", meaning: "You got this chapter's quiz question right. One answer is a hint, not mastery." },
  { status: "coming soon", meaning: "Lessons are still being written. You can read what the chapter covers." },
];

const STATUS: Record<ChapterStatus, { icon: ReactNode; className: string }> = {
  done: { icon: <Check size={15} strokeWidth={3} aria-hidden />, className: "text-good" },
  "in progress": { icon: <PenLine size={15} aria-hidden />, className: "text-ink" },
  // Neutral, not green: one right answer in the quiz is a hint, not mastery.
  "looked familiar in the quiz": { icon: <Eye size={15} aria-hidden />, className: "text-ink" },
  "not started": { icon: null, className: "text-muted" },
  "coming soon": { icon: <Clock size={15} aria-hidden />, className: "text-muted" },
};

/** The chapter map: start anywhere. Nothing is locked; chapters without lessons say so. */
export function ChapterMap() {
  const hydrated = useProgressHydrated();
  const progress = useProgress();
  const [selected, setSelected] = useState<number | null>(null);
  const detail = useRef<HTMLDivElement>(null);

  // First selection: a #chapter-N link, else the chapter in progress, else the quiz's suggestion, else 1.
  useEffect(() => {
    if (!hydrated || selected !== null) return;
    const fromHash = Number(/^#chapter-(\d+)$/.exec(window.location.hash)?.[1]);
    const fromLesson = progress.lastLessonId ? chapterOfLesson(progress.lastLessonId)?.n : undefined;
    const pick = [fromHash, fromLesson, progress.placement?.recommended, 1].find((n) => n && chapterByNumber(n));
    // Selecting from saved progress or the URL happens once, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(pick ?? 1);
  }, [hydrated, selected, progress.lastLessonId, progress.placement]);

  const choose = (n: number) => {
    setSelected(n);
    // On narrow screens the detail slip sits below the list: bring it into view.
    requestAnimationFrame(() => {
      const box = detail.current?.getBoundingClientRect();
      if (box && box.top > window.innerHeight * 0.6) {
        detail.current?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    });
  };

  const sel = chapterByNumber(selected ?? 1) ?? chapters[0]!;
  const recommended = progress.placement ? chapterByNumber(progress.placement.recommended) : undefined;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-6 sm:px-14">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Chapters" }]} />
      <section className="mt-8 max-w-[720px]">
        <h1 className="font-serif text-[clamp(2.5rem,6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
          Start where you are.
        </h1>
        <p className="mt-[22px] text-lg leading-relaxed">
          Twelve chapters, from your first query to designing a database. Begin at the top, jump to any chapter you
          already know, or take a short quiz and we will point you to a starting place.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ButtonLink href="/placement" variant={recommended ? "line" : "solid"}>
            {recommended ? "Retake the placement quiz" : "Take the placement quiz"}
          </ButtonLink>
          <span className="text-[15px] text-muted">
            {recommended && hydrated
              ? `Your quiz suggested chapter ${recommended.n}: ${recommended.name}.`
              : "Six questions. Skip it any time."}
          </span>
        </div>
      </section>

      {/* Progress at a glance; space is held while saved progress loads. */}
      <p role="status" className="mt-8 min-h-[1.6em] text-base font-semibold">
        {hydrated ? (
          <>
            <span className="sr-only">Your progress: </span>
            {countsLine(statusCounts(chapters, progress))}
          </>
        ) : (
          <span className="font-normal text-muted">Loading your progress</span>
        )}
      </p>

      <div className="mt-4 max-w-[720px]">
        <Disclosure openLabel="What the status words mean" closeLabel="Hide the status words">
          <dl className="space-y-2.5">
            {LEGEND.map(({ status, meaning }) => (
              <div key={status}>
                <dt className={`flex items-center gap-1.5 font-semibold ${STATUS[status].className}`}>
                  {STATUS[status].icon}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </dt>
                <dd className="text-[15px] text-ink">{meaning}</dd>
              </div>
            ))}
          </dl>
        </Disclosure>
      </div>

      <div className="mt-10 flex flex-wrap items-start gap-12">
        <LedgerSheet title="Contents" count="Pick any line" className="min-w-0 flex-[1.3_1_600px]">
          <ul>
            {chapters.map((c) => {
              const group = chapterGroups.find((g) => g.from === c.n);
              return (
                <li key={c.n}>
                  {group && (
                    <div className="flex flex-wrap items-baseline gap-x-3.5 border-b border-rule py-3 pl-24 pr-5">
                      <h2 className="text-sm font-semibold text-muted">{group.label}</h2>
                      <MarginNote className="text-[22px]">{group.note}</MarginNote>
                    </div>
                  )}
                  <ChapterRow
                    chapter={c}
                    status={hydrated ? chapterStatus(c, progress) : null}
                    selected={c.n === sel.n}
                    onSelect={() => choose(c.n)}
                  />
                </li>
              );
            })}
          </ul>
        </LedgerSheet>

        <aside ref={detail} aria-labelledby="chapter-detail" className="min-w-0 flex-[1_1_380px] scroll-mt-4 lg:sticky lg:top-6">
          <ChapterDetail chapter={sel} hydrated={hydrated} />
        </aside>
      </div>

      <ClearProgress />
    </div>
  );
}

/** Two steps, so one stray click never wipes a learner's record. */
function ClearProgress() {
  const reset = useProgress((s) => s.reset);
  const [stage, setStage] = useState<"idle" | "confirm" | "cleared">("idle");
  return (
    <section aria-labelledby="clear-progress" className="mt-16 max-w-[720px] border-t border-rule pt-6">
      <h2 id="clear-progress" className="font-serif text-xl font-semibold">
        Your saved progress
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Progress is kept in this browser only: lesson statuses, attempts, hints and your quiz result.
      </p>
      {stage === "confirm" ? (
        <div role="alertdialog" aria-labelledby="clear-confirm" className="mt-4 border border-ink bg-sheet p-5">
          <p id="clear-confirm" className="text-base font-semibold">
            Clear all progress in this browser? This cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                reset();
                setStage("cleared");
              }}
            >
              Yes, clear my progress
            </Button>
            <Button variant="line" onClick={() => setStage("idle")} autoFocus>
              Keep my progress
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="line" onClick={() => setStage("confirm")}>
            Clear my progress
          </Button>
          <p role="status" className="text-[15px]">
            {stage === "cleared" ? "Your progress has been cleared." : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function ChapterRow({
  chapter: c,
  status,
  selected,
  onSelect,
}: {
  chapter: Chapter;
  status: ChapterStatus | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const look = status ? STATUS[status] : null;
  return (
    <button
      type="button"
      id={`chapter-${c.n}`}
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        // Narrow screens: the status sits under the name; wider: in its own column.
        "grid min-h-[72px] w-full grid-cols-[72px_minmax(0,1fr)] items-center border-b border-rule py-2.5 text-left text-ink sm:grid-cols-[72px_minmax(0,1fr)_auto]",
        selected ? "bg-sheet shadow-[inset_4px_0_0_var(--ink)]" : "hover:bg-wash",
      ].join(" ")}
    >
      <span className="row-span-2 pl-[18px] font-mono text-base text-muted sm:row-span-1">{c.n}</span>
      <span className="block min-w-0 pl-6 pr-3">
        <span className="block font-serif text-[clamp(1.125rem,2.4vw,1.375rem)] font-semibold leading-tight">{c.name}</span>
        <span className="mt-1 block text-sm leading-normal text-muted">{c.topics}</span>
      </span>
      {/* Space is reserved; while saved progress loads the word is a neutral "loading". */}
      <span
        className={`col-start-2 flex items-center gap-1.5 pl-6 pr-3 pt-1 text-sm font-semibold leading-snug sm:col-start-3 sm:row-start-1 sm:min-w-[6.5rem] sm:max-w-[10rem] sm:justify-end sm:pl-0 sm:pr-[18px] sm:pt-0 sm:text-right ${
          look?.className ?? "font-normal text-muted"
        }`}
      >
        {look?.icon && <span className="shrink-0">{look.icon}</span>}
        {status ?? "loading"}
      </span>
    </button>
  );
}

function ChapterDetail({ chapter: c, hydrated }: { chapter: Chapter; hydrated: boolean }) {
  const progress = useProgress();
  const entry = hydrated ? chapterEntry(c, progress) : null;
  const firstLesson = c.lessonIds[0] ? getLesson(c.lessonIds[0]) : undefined;
  const written = chapters.filter((x) => x.lessonIds.length > 0);
  return (
    <div key={c.n} className="rise border border-ink bg-sheet p-6 shadow-slip sm:p-7">
      <p className="text-[15px] text-muted">Chapter {c.n} of {chapters.length}</p>
      <h2 id="chapter-detail" className="mt-2 font-serif text-[clamp(1.75rem,4vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.01em]">
        {c.name}
      </h2>
      <p className="mt-4 text-base leading-[1.65]">{c.blurb}</p>
      <p className="mt-4 text-[15px] leading-relaxed">
        <strong>You will type:</strong> <code className="break-words font-mono text-sm">{c.sample}</code>
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        {hydrated ? prerequisiteText(c, progress) : "Checking what you have covered."}
      </p>
      {c.note && <MarginNote className="mt-3.5 block">{c.note}</MarginNote>}

      {c.lessonIds.length === 0 && (
        <p className="mt-5 border-l-2 border-ink pl-4 text-base leading-relaxed">
          Lessons for this chapter are being written. You can still read what it covers here
          {written.length ? `, and ${written.map((x) => x.name).join(" and ")} is ready to start now.` : "."}
        </p>
      )}
      {firstLesson && (
        <>
          <p className="mt-5 text-[15px] text-muted">
            {c.lessonIds.length === 1 ? "1 lesson" : `${c.lessonIds.length} lessons`}, in order. Open any of them.
          </p>
          <ol className="mt-2 border-t border-rule" aria-label={`Lessons in ${c.name}`}>
            {c.lessonIds.map((id, i) => {
              const l = getLesson(id);
              if (!l) return null;
              const status = hydrated ? lessonProgress(progress, id).status : null;
              const shown = status && status !== "not started" ? STATUS[status] : null;
              return (
                <li key={id} className="border-b border-rule">
                  <Link
                    href={`/lesson/${id}`}
                    className="group grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-2 py-2.5 text-[15px] text-ink no-underline"
                  >
                    <span className="font-mono text-sm text-num">{i + 1}</span>
                    <span className="group-hover:underline">{l.title}</span>
                    {shown && status && (
                      <span className={`inline-flex items-center gap-1.5 text-[13px] ${shown.className}`}>
                        {shown.icon}
                        {status}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
          <ConceptTags
            concepts={[...new Set(c.lessonIds.flatMap((id) => getLesson(id)?.concepts ?? []))].slice(0, 8)}
            className="mt-4"
            label="Concepts in this chapter:"
          />
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {entry ? (
          <ButtonLink href={`/lesson/${entry.lessonId}`}>{entry.label}</ButtonLink>
        ) : (
          written[0] &&
          c.lessonIds.length === 0 && (
            <ButtonLink href={`/lesson/${written[0].lessonIds[0]}`}>Start {written[0].name} instead</ButtonLink>
          )
        )}
        <ButtonLink href="/placement" variant="line">
          Test out first
        </ButtonLink>
      </div>
    </div>
  );
}
