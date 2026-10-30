import Link from "next/link";
import { BRAND_NAME, SOURCE_URL } from "@/lib/brand";
import { start } from "@/lib/landing";
import { CAPTION, TEXT_LINK, WRAP } from "./layout";

export function LandingHeader() {
  return (
    <header className={`${WRAP} flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-5 sm:pt-7`}>
      <Link href="/" className="inline-flex min-h-11 flex-col justify-center font-serif text-[28px] font-bold italic tracking-[-0.01em] text-ink no-underline">
        {BRAND_NAME}
        <span aria-hidden className="mt-px block h-[3px] w-full -rotate-[1.2deg] bg-pen" />
      </Link>
      <nav aria-label="Main">
        <ul className="flex flex-wrap gap-x-7 text-[15px]">
          <li>
            <a href="#how" className={`${TEXT_LINK} text-muted`}>
              How it works
            </a>
          </li>
          <li>
            <a href="#chapters" className={`${TEXT_LINK} text-muted`}>
              Chapters
            </a>
          </li>
          <li>
            <Link href={`/lesson/${start.lessonId}`} className={`${TEXT_LINK} font-semibold text-ink`}>
              Start learning
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className={`${WRAP} flex flex-wrap items-baseline justify-between gap-x-10 gap-y-2 pb-14 pt-7`}>
      <span className="font-serif text-[22px] font-bold italic">{BRAND_NAME}</span>
      <p className={`${CAPTION} max-w-[36em]`}>Your queries run in your browser on DuckDB. Built by Adewale Odoffin in Toronto.</p>
      <nav aria-label="Footer">
        <ul className="flex flex-wrap gap-x-6 text-sm">
          <li>
            <a href="#chapters" className={`${TEXT_LINK} text-muted`}>
              Chapters
            </a>
          </li>
          <li>
            <a href={SOURCE_URL} className={`${TEXT_LINK} text-muted`}>
              Source on GitHub
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
