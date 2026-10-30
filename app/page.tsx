import type { Metadata } from "next";
import { ButtonLink } from "@/components/ledger";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { HowALessonWorks } from "@/components/landing/HowALessonWorks";
import { Intro } from "@/components/landing/Intro";
import { LandingFooter, LandingHeader } from "@/components/landing/LandingChrome";
import { CAPTION, WRAP } from "@/components/landing/layout";
import { PenCircle, PenUnderline } from "@/components/landing/Pen";
import { PrimaryAction } from "@/components/landing/PrimaryAction";
import { StartAnywhere } from "@/components/landing/StartAnywhere";
import { BRAND_NAME } from "@/lib/brand";
import { start } from "@/lib/landing";

const PITCH = `${BRAND_NAME} teaches SQL by running your own code on real data, one row at a time. You type every line yourself, so it sticks.`;

export const metadata: Metadata = { description: PITCH };

const startLabel = `Start with ${start.chapterName}`;

export default function Home() {
  return (
    <>
      {/* First in the HTML, so the intro covers the page from the first paint. */}
      <Intro />
      <LandingHeader />
      <main className="flex-1">
        <section className={`${WRAP} grid items-center gap-16 pb-24 pt-12 min-[861px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] min-[861px]:pt-18`}>
          <div className="flex flex-col gap-7">
            <h1 className="min-w-0 text-balance font-serif [overflow-wrap:break-word] text-[clamp(2.6rem,1.5rem+4.5vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.02em]">
              Type the query. Watch every row get its <PenUnderline>verdict.</PenUnderline>
            </h1>
            <p className="max-w-[34em] text-[19px] leading-[1.6] text-muted">{PITCH}</p>
            <div className="flex flex-wrap gap-3.5">
              <PrimaryAction startId={start.lessonId} startLabel={startLabel} />
              <ButtonLink href="/placement" variant="line">
                Find my level
              </ButtonLink>
            </div>
            <p className={`${CAPTION} max-w-[32em]`}>Runs in your browser on a real DuckDB database. No account, nothing to install.</p>
          </div>
          <HeroDemo />
        </section>

        <HowALessonWorks />
        <StartAnywhere />

        <section aria-labelledby="your-turn" className="ink-band bg-ink text-sheet">
          <div className={`${WRAP} grid items-center gap-10 pb-28 pt-26 min-[861px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] min-[861px]:gap-16`}>
            <h2 id="your-turn" className="min-w-0 font-serif [overflow-wrap:break-word] text-[clamp(4rem,2rem+5vw,6rem)] font-bold leading-none tracking-[-0.03em]">
              Your{" "}
              <PenCircle stroke="stroke-margin" width={3} onView>
                turn.
              </PenCircle>
            </h2>
            <div className="flex flex-col gap-6">
              <p className="max-w-[26em] text-xl leading-[1.6]">Fix one broken query and watch the rows answer.</p>
              <div className="flex flex-wrap gap-3.5">
                <PrimaryAction startId={start.lessonId} startLabel={startLabel} variant="solid-inverse" />
                <ButtonLink href="/placement" variant="line-inverse">
                  Find my level
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
