import Link from "next/link";
import { ButtonLink } from "@/components/ledger";
import { capitalise, chapterCount, chapterLines, countWord, demo, lessonsReady, quizLength, readyLabel } from "@/lib/landing";
import { WRAP } from "./layout";
import { PrimaryAction } from "./PrimaryAction";

const readyLine =
  lessonsReady === 1
    ? "One lesson is ready to try today."
    : `${capitalise(countWord(lessonsReady))} lessons are ready to try today.`;

/** Every chapter from content/chapters.ts, with what is written so far. Nothing is locked. */
export function StartAnywhere() {
  return (
    <section id="chapters" aria-labelledby="chapters-title" className={`${WRAP} scroll-mt-6 pb-24 pt-22`}>
      <div className="grid items-start gap-12 min-[861px]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] min-[861px]:gap-16">
        <div className="flex flex-col gap-5.5">
          <h2 id="chapters-title" className="min-w-0 font-serif [overflow-wrap:break-word] text-[clamp(2rem,1.5rem+1.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.01em]">
            Start anywhere.
          </h2>
          <p className="text-lg leading-[1.65] text-muted">
            {capitalise(countWord(chapterCount))} chapters run from your first SELECT to database design. Begin at chapter 1, or
            take a {countWord(quizLength)}-question quiz and jump to where you belong. Nothing is locked.
          </p>
          <p className="text-[15px] leading-[1.6] text-muted">
            {readyLine} The rest are being written one chapter at a time.
          </p>
          <div className="flex flex-wrap gap-3.5 pt-1.5">
            <PrimaryAction startId={demo.lessonId} startLabel={`Start with ${demo.chapterName}`} />
            <ButtonLink href="/placement" variant="line">
              Find my level
            </ButtonLink>
          </div>
        </div>
        <ol aria-label="Chapters" className="border-b border-rule">
          {chapterLines.map((c) => (
            <li key={c.n} className="border-t border-rule">
              <Link
                href={`/chapters#chapter-${c.n}`}
                className="group grid min-h-11 grid-cols-[44px_minmax(0,1fr)_auto] items-baseline gap-3 py-3.5 text-base text-ink no-underline"
              >
                <span className="font-mono text-[15px] text-num">{c.n}</span>
                <span className="group-hover:underline">{c.name}</span>
                <span className={`text-[13px] ${c.ready ? "font-semibold text-good" : "text-muted"}`}>{readyLabel(c.ready)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
