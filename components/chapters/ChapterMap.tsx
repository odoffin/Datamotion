"use client";

import { BadgeCheck, Check, Clock, PenLine } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Breadcrumb, ButtonLink, LedgerSheet, MarginNote } from "@/components/ledger";
import { chapterByNumber, chapterGroups, chapterOfLesson, chapters, type Chapter } from "@/content/chapters";
import { getLesson } from "@/content/lessons";
import { chapterEntry, chapterStatus, prerequisiteText, type ChapterStatus } from "@/lib/chapter-status";
import { prefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { useProgressHydrated } from "@/lib/hooks/use-progress-hydrated";
import { useProgress } from "@/store/progress";

const STATUS: Record<ChapterStatus, { icon: ReactNode; className: string }> = {
  done: { icon: <Check size={15} strokeWidth={3} aria-hidden />, className: "text-good" },
  "in progress": { icon: <PenLine size={15} aria-hidden />, className: "text-ink" },
  "tested out": { icon: <BadgeCheck size={15} aria-hidden />, className: "text-good" },
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

      <div className="mt-14 flex flex-wrap items-start gap-12">
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
    </div>
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
        "grid min-h-[72px] w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center border-b border-rule py-2.5 text-left text-ink",
        selected ? "bg-sheet shadow-[inset_4px_0_0_var(--ink)]" : "hover:bg-wash",
      ].join(" ")}
    >
      <span className="pl-[18px] font-mono text-base text-muted">{c.n}</span>
      <span className="block min-w-0 pl-6 pr-3">
        <span className="block font-serif text-[clamp(1.125rem,2.4vw,1.375rem)] font-semibold leading-tight">{c.name}</span>
        <span className="mt-1 block text-sm leading-normal text-muted">{c.topics}</span>
      </span>
      <span className={`flex min-w-[6.5rem] items-center justify-end gap-1.5 pr-[18px] text-right text-sm font-semibold ${look?.className ?? ""}`}>
        {look?.icon}
        {status ?? " "}
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
      <p className="mt-4 text-[15px] leading-relaxed text-muted">{hydrated ? prerequisiteText(c, progress) : " "}</p>
      {c.note && <MarginNote className="mt-3.5 block">{c.note}</MarginNote>}

      {c.lessonIds.length === 0 && (
        <p className="mt-5 border-l-2 border-ink pl-4 text-base leading-relaxed">
          Lessons for this chapter are being written. You can still read what it covers here
          {written.length ? `, and ${written.map((x) => x.name).join(" and ")} is ready to start now.` : "."}
        </p>
      )}
      {firstLesson && (
        <p className="mt-5 text-[15px] text-muted">
          {c.lessonIds.length === 1 ? "1 lesson so far" : `${c.lessonIds.length} lessons so far`}: {firstLesson.title}.
        </p>
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
      <p className="mt-3.5 text-sm leading-relaxed text-muted">
        For now, Test out first opens the placement quiz. A short test for each chapter comes later.
      </p>
    </div>
  );
}
