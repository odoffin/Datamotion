import { Pause, StepBack, StepForward } from "lucide-react";
import type { ReactNode } from "react";
import { buttonClass, MarginNote, Slip } from "@/components/ledger";
import { sqlParts } from "@/components/lesson/SqlLine";
import { demo, playbackExample, starterDiagnosis } from "@/lib/landing";
import { CAPTION, WRAP } from "./layout";
import { PenCircle } from "./Pen";

const CODE = "font-mono text-[17px] leading-[1.7] text-ink";

function Sql({ sql }: { sql: string }) {
  return sqlParts(sql).map((p, i) => (
    <span key={i} className={p.className}>
      {p.text}
    </span>
  ));
}

/** Straight quotes in the checker's message, set as the artboard's curly ones. */
const curly = (s: string) => s.replace(/"([^"]*)"/g, "“$1”");

function YouType() {
  return (
    <Slip>
      <p className={CAPTION}>Your query</p>
      <p className={`${CODE} mt-1.5`}>
        <Sql sql={demo.alternativeSql} />
      </p>
      <p className="mt-3.5 text-[15px] font-semibold leading-normal text-good">
        Approved. Your query returned the same {demo.keptTotal} rows as the goal.
      </p>
    </Slip>
  );
}

function ItPoints() {
  const d = starterDiagnosis();
  const bad = d.tokens[d.index];
  const sql = demo.starterSql;
  if (!bad) return null;
  return (
    <Slip>
      <p className={CAPTION}>Your query</p>
      <p className={`${CODE} mt-3.5`}>
        <Sql sql={sql.slice(0, bad.start)} />
        <PenCircle onView className="demo-shake text-pen">
          {bad.text}
        </PenCircle>
        <Sql sql={sql.slice(bad.end)} />
      </p>
      {/* Under the circled word: its offset in the mono line, in characters. */}
      <p aria-hidden className="mt-3.5 font-mono text-[17px]" style={{ paddingLeft: `${bad.start}ch` }}>
        <MarginNote>{d.note}</MarginNote>
      </p>
      <p className="mt-2.5 text-[15px] leading-normal">{curly(d.message)}</p>
    </Slip>
  );
}

function SeeItRun() {
  const { step, total, narration } = playbackExample();
  const square = "flex size-11 shrink-0 items-center justify-center rounded-btn border border-ink";
  return (
    <Slip>
      <p className="text-[15px] text-muted">
        Step {step} of {total}
      </p>
      <p className="mt-1 text-base font-medium">{narration}</p>
      {/* A picture of the playback bar, not a control. */}
      <div aria-hidden className="mt-4 flex items-center gap-3">
        <span className={square}>
          <StepBack size={18} />
        </span>
        <span className={`${square} bg-ink text-sheet`}>
          <Pause size={18} />
        </span>
        <span className={square}>
          <StepForward size={18} />
        </span>
        <span className="relative h-0.5 flex-1 bg-rule">
          <span className="absolute -top-px left-0 h-1 bg-ink" style={{ width: `${(step / total) * 100}%` }} />
        </span>
        <span className="font-mono text-[13px] text-muted">
          {step}/{total}
        </span>
      </div>
    </Slip>
  );
}

function ThenMoveOn() {
  return (
    <Slip>
      <p className="font-serif text-2xl font-semibold text-good">Approved.</p>
      <p className="mt-1.5 text-[15px] leading-normal">Move on when you feel sure of it, or do it again to practise.</p>
      {/* Pictures of the lesson's buttons, not controls. */}
      <div aria-hidden className="pointer-events-none mt-4 flex select-none flex-wrap gap-2.5">
        <span className={buttonClass("solid")}>Next lesson</span>
        <span className={buttonClass("line")}>Do it again</span>
      </div>
    </Slip>
  );
}

interface Entry {
  note: string;
  title: string;
  body: ReactNode;
  slip: ReactNode;
}

const ENTRIES: Entry[] = [
  {
    note: "you type",
    title: "Every query is yours.",
    body: "There is no copy and paste. Each lesson hands you a request slip with a mistake on it. Fix it, run it, and the database answers with real rows. Any query that returns the right rows passes, so there is more than one correct answer.",
    slip: <YouType />,
  },
  {
    note: "it points",
    title: "A wrong word gets circled.",
    body: "Datapen finds the exact word that is wrong, circles it in red pen and tells you what it expected. You see the one word to fix, not a wall of error text.",
    slip: <ItPoints />,
  },
  {
    note: "see it run",
    title: "Watch your own query run.",
    body: "The animation is built from the query you typed. Rows are kept or dropped the way the database decides, and the rows left at the end match the real result. Pause it, step back, or play it again.",
    slip: <SeeItRun />,
  },
  {
    note: "then move on",
    title: "When you have it, move on.",
    body: "Once your query is approved, finish one sentence about it to check you understood. Then go on to the next lesson, or do it again from the start. No chapter is ever locked.",
    slip: <ThenMoveOn />,
  },
];

/** One ledger sheet: a red margin line with a handwritten note per step. */
export function HowALessonWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className={`${WRAP} scroll-mt-6 pb-6`}>
      <h2 id="how-title" className="min-w-0 pb-9 font-serif [overflow-wrap:break-word] text-[clamp(2rem,1.5rem+1.5vw,2.5rem)] font-bold tracking-[-0.01em]">
        How a lesson works
      </h2>
      <div className="how-ledger border-b border-rule">
        {ENTRIES.map((e) => (
          <div key={e.note} className="grid border-t border-rule min-[861px]:grid-cols-[190px_minmax(0,1fr)]">
            <div className="pt-7 min-[861px]:pr-7 min-[861px]:pt-11 min-[861px]:text-right">
              <MarginNote>{e.note}</MarginNote>
            </div>
            <div className="grid items-start gap-6 pb-9 pt-3 min-[861px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-[861px]:gap-12 min-[861px]:pb-12 min-[861px]:pl-12 min-[861px]:pt-10">
              <div className="flex flex-col gap-3.5">
                <h3 className="font-serif text-[28px] font-semibold leading-[1.2]">{e.title}</h3>
                <p className="text-[17px] leading-[1.65] text-muted">{e.body}</p>
              </div>
              {e.slip}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
