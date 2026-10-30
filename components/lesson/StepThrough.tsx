"use client";

import { ArrowRight, Check, Pause, Play, StepBack, StepForward, X } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ledger";
import { formatCell } from "@/components/stage/format";
import { KEEP, VIEW_ROWS, type Explanation, type ExplainStep } from "@/engine/explain";
import { sameQuery } from "@/engine/format";
import type { QueryResult } from "@/engine/query-runner";
import { readOnlyRunner } from "@/lib/engine/db";
import { sqlParts } from "./SqlLine";

/** How long Play stays on each step: long enough to read its sentence. */
const STEP_MS = 2600;

/** Views already fetched (or on their way), by query, so stepping back and forth never runs one twice. */
const views = new Map<string, QueryResult>();
const pending = new Map<string, Promise<QueryResult>>();

function load(sql: string): Promise<QueryResult> {
  const done = views.get(sql);
  if (done) return Promise.resolve(done);
  let p = pending.get(sql);
  if (!p) {
    p = readOnlyRunner.run(sql).then((res) => {
      views.set(sql, res);
      pending.delete(sql);
      return res;
    });
    pending.set(sql, p);
  }
  return p;
}

function useView(sql: string | undefined): QueryResult | null {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!sql || views.has(sql)) return;
    let live = true;
    void load(sql).then(() => {
      if (live) setVersion((v) => v + 1);
    });
    return () => {
      live = false;
    };
  }, [sql]);
  return sql ? (views.get(sql) ?? null) : null;
}

interface Block {
  text: string;
  /** The step these lines belong to, or null for lines between clauses. */
  step: number | null;
  /** Where the block starts in the query. */
  start: number;
}

/**
 * Where each step sits in the query as written. Longer clauses claim their
 * text first, so a subquery inside WHERE is found inside it, not on its own.
 */
function locate(query: string, steps: readonly ExplainStep[]) {
  const ranges: { start: number; end: number; step: number; nested: boolean }[] = [];
  const order = steps.map((s, i) => i).sort((a, b) => steps[b]!.sql.length - steps[a]!.sql.length);
  for (const i of order) {
    const text = steps[i]!.sql;
    for (let at = query.indexOf(text); at >= 0 && text; at = query.indexOf(text, at + 1)) {
      const end = at + text.length;
      const clash = ranges.some((r) => at < r.end && end > r.start && !(at >= r.start && end <= r.end));
      if (clash || ranges.some((r) => r.start === at && r.end === end)) continue;
      ranges.push({ start: at, end, step: i, nested: ranges.some((r) => at >= r.start && end <= r.end) });
      break;
    }
  }
  return ranges;
}

/**
 * The query cut into one block per clause, in the order written, each owned
 * by its step. A query typed on one line still shows one clause per line;
 * text between clauses (WITH, say) gets a plain block of its own.
 */
function blocks(query: string, steps: readonly ExplainStep[]): { list: Block[]; ranges: ReturnType<typeof locate> } {
  const ranges = locate(query, steps);
  const top = ranges.filter((r) => !r.nested).sort((x, y) => x.start - y.start);
  const list: Block[] = [];
  let at = 0;
  const gap = (end: number) => {
    const text = query.slice(at, end);
    const last = list[list.length - 1];
    // The closing ; belongs at the end of the last clause, as it was written.
    if (text.trim() === ";" && last) last.text += text.trimEnd();
    else if (text.trim()) list.push({ text: text.trim(), step: null, start: at + text.indexOf(text.trim()) });
  };
  for (const r of top) {
    gap(r.start);
    list.push({ text: query.slice(r.start, r.end), step: r.step, start: r.start });
    at = r.end;
  }
  gap(query.length);
  return { list, ranges };
}

/** Coloured SQL, with one stretch of it (a subquery being explained) marked. */
function Code({ text, offset, mark, plain, names = [] }: { text: string; offset: number; mark?: { start: number; end: number }; plain: boolean; names?: readonly string[] }) {
  // The columns the step uses get the same highlighter in the query as in the table.
  const lit = new Set(names.map((n) => n.toLowerCase().replace(/^.*\./, "")));
  return sqlParts(text).reduce<{ out: ReactNode[]; at: number }>(
    (acc, part, i) => {
      const start = offset + acc.at;
      const inMark = mark && start >= mark.start && start < mark.end;
      const named = lit.has(part.text.toLowerCase()) && /\S/.test(part.text);
      acc.out.push(
        <span key={i} className={`${plain ? "" : (part.className ?? "")} ${inMark ? "bg-ink/10 rounded-[2px]" : ""} ${named ? "rounded-[2px] bg-marker px-0.5" : ""}`}>
          {part.text}
        </span>,
      );
      acc.at += part.text.length;
      return acc;
    },
    { out: [], at: 0 },
  ).out;
}

const rowKeys = (rows: unknown[][]) => {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = JSON.stringify(r);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
};

/**
 * Does a column header name one of these columns? Exact names first, then the
 * part after the dot; * means every column and o.* every column of o.
 */
function matchesColumn(column: string, names: readonly string[]): boolean {
  const c = column.toLowerCase();
  const tail = (s: string) => s.toLowerCase().replace(/^.*\./, "");
  return names.some((n) => {
    const name = n.toLowerCase();
    if (name === "*" || name === c) return true;
    if (name.endsWith(".*")) return c.startsWith(name.slice(0, -1));
    return !c.includes(".") && tail(name) === c;
  });
}

/** What a step's table shows: its own view, or (for SELECT) the table before it with the kept columns spotlighted. */
export interface Display {
  view: string | undefined;
  /** Leave out the rows an earlier step dropped. */
  onlyKept: boolean;
  /** Columns to spotlight with the highlighter. */
  spotlight: readonly string[];
}

/**
 * The real table a step shows, with a highlighter on what the step uses: the
 * columns it reads (or keeps) and the rows it keeps. Dropped rows are crossed
 * out and faded. Rows that stay slide to their new place; new ones fade in.
 */
function StepTable({ step, display, reducedMotion }: { step: ExplainStep; display: Display; reducedMotion: boolean }) {
  const result = useView(display.view);
  const body = useRef<HTMLTableSectionElement>(null);
  const tops = useRef(new Map<string, number>());
  const marked = !!result && !result.error && result.columns[0] === KEEP;
  // A SELECT shows only the rows that are still in play: the verdicts are already given.
  const keyed = marked && !display.onlyKept;
  const columns = result ? (marked ? result.columns.slice(1) : result.columns) : [];
  const source = result && !result.error ? result.rows.filter((r) => !display.onlyKept || !marked || r[0] === true) : [];
  const rows = source.map((r) => (marked ? r.slice(1) : r));
  const keep = source.map((r) => !keyed || r[0] === true);
  const keys = rowKeys(rows);
  const signature = keys.join("|");

  // FLIP: compare each row's place with where the same row sat on the last step.
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const next = new Map<string, number>();
    for (const tr of el.querySelectorAll<HTMLTableRowElement>("tr[data-key]")) {
      const key = tr.dataset.key!;
      next.set(key, tr.offsetTop);
      const before = tops.current.get(key);
      if (reducedMotion) continue;
      if (before === undefined) {
        tr.classList.remove("step-row-in");
        void tr.offsetWidth;
        tr.classList.add("step-row-in");
      } else if (before !== tr.offsetTop) {
        // Web Animations leave no inline style behind, so a row never sticks halfway.
        tr.animate([{ transform: `translateY(${before - tr.offsetTop}px)` }, { transform: "none" }], { duration: 450, easing: "ease" });
      }
    }
    tops.current = next;
  }, [signature, reducedMotion]);

  if (!display.view) return <p className="px-4 py-4 text-[15px] text-muted">This step has no table of its own to show.</p>;
  if (!result) return <p className="px-4 py-4 text-[15px] text-muted">Fetching the table.</p>;
  if (result.error) return <p className="px-4 py-4 text-[15px] text-muted">This step&apos;s table could not be shown.</p>;
  const lit = columns.map((c) => matchesColumn(c, display.spotlight));
  const anyLit = lit.some(Boolean);
  // Every column spotlighted (SELECT *): a light wash, so the page is not one yellow block.
  const allLit = lit.length > 0 && lit.every(Boolean);
  return (
    <table className="w-full border-collapse font-mono text-sm">
      <caption className="sr-only">
        The table at step {step.label ?? ""}
        {anyLit ? `, with ${columns.filter((_, i) => lit[i]).join(", ")} spotlighted` : ""}
        {keyed ? ", each row marked kept or dropped" : ""}
      </caption>
      <thead className="sticky top-0 z-[1] bg-sheet">
        <tr>
          {columns.map((c, i) => (
            <th
              key={`${c}-${i}`}
              scope="col"
              className={`border-b-2 border-ink px-3 py-2 text-left ${lit[i] ? "bg-marker font-semibold text-ink" : anyLit ? "font-normal text-muted/70" : "font-medium text-muted"}`}
            >
              {c}
            </th>
          ))}
          {keyed && (
            <th scope="col" className="border-b-2 border-ink px-3 py-2 text-right font-sans font-medium text-muted">
              Verdict
            </th>
          )}
        </tr>
      </thead>
      <tbody ref={body}>
        {rows.map((row, r) => {
          const kept = keep[r]!;
          return (
            <tr
              key={keys[r]}
              data-key={keys[r]}
              className={`border-b border-rule ${keyed && kept ? "bg-marker-soft" : ""} ${kept ? "" : "text-muted opacity-60"}`}
            >
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={[
                    "whitespace-pre px-3 py-1.5 align-top tabular-nums",
                    lit[c] && kept ? (allLit ? "bg-marker-soft" : "bg-marker font-semibold text-ink") : "",
                    !lit[c] && anyLit && kept ? "text-muted" : "",
                    kept ? "" : "line-through",
                  ].join(" ")}
                >
                  {formatCell(cell)}
                </td>
              ))}
              {keyed && (
                <td className="px-3 py-1.5 text-right font-sans font-semibold">
                  {kept ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-good">
                      <Check size={14} strokeWidth={3} aria-hidden />
                      kept
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-pen">
                      <X size={14} strokeWidth={3} aria-hidden />
                      {step.label?.startsWith("LIMIT") ? "cut" : "dropped"}
                    </span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
      {rows.length === VIEW_ROWS && (
        <tfoot>
          <tr>
            <td colSpan={columns.length + (keyed ? 1 : 0)} className="px-3 py-2 font-sans text-sm text-muted">
              Showing the first {VIEW_ROWS} rows.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** What the highlighter means at this step, in one plain sentence. */
function legend(step: ExplainStep, display: Display, tableName: string | null): string {
  const cols = display.spotlight.filter((c) => c !== "*");
  const named = cols.length ? cols.join(" and ") : "";
  const label = step.label ?? "";
  if (label === "FROM") return `The whole ${tableName ?? ""} table, before anything else happens.`.replace("  ", " ");
  if (label.endsWith("JOIN")) return `Highlighted: ${named}, the columns that must match.`;
  if (label === "WHERE" || label === "HAVING")
    return `Highlighted: the ${named || "values"} the test looks at, on the ${label === "HAVING" ? "groups" : "rows"} it keeps. Crossed out: the ones it drops.`;
  if (label.startsWith("LIMIT") || label.startsWith("OFFSET")) return "Highlighted: the rows it keeps. Crossed out: the rows it cuts.";
  if (label === "GROUP BY") return `Highlighted: ${named}, the column the groups are made from. One row for each group.`;
  if (label === "ORDER BY") return `Highlighted: ${named}, the column the rows are sorted by.`;
  if (label.startsWith("SELECT") && display.spotlight.includes("*")) return "Highlighted: every column, because * means all of them.";
  if (label.startsWith("SELECT") && step.keeps) return `Highlighted: the columns SELECT keeps (${named}). The rest are left out.`;
  return "";
}

interface StepThroughProps {
  explained: { sql: string; explanation: Explanation } | null;
  /** The text on the slip now; when it differs, the panel says which run it shows. */
  sql: string;
  /** What to say before there is a run to show. */
  empty: string;
  /** The lesson's table before anything ran. */
  preview: { name: string; columns: string[]; rows: unknown[][] } | null;
  /** Each change starts the walk from the first step again (a new run, or "Show me once more"). */
  replay: number;
  reducedMotion: boolean;
}

/**
 * Watch it run: the learner's query beside the table it works on. Each line of
 * the query is a step, numbered in the order the database runs it; choose one
 * (or press Play) and the table shows what that line does: the rows WHERE
 * keeps and drops, the columns it reads, the order ORDER BY puts rows in.
 */
export function StepThrough({ explained, sql, empty, preview, replay, reducedMotion }: StepThroughProps) {
  const [state, setState] = useState({ key: "", step: 0, playing: false });
  const steps = explained?.explanation.steps ?? [];
  const runKey = `${explained?.sql ?? ""}#${replay}`;
  // A new run (or a replay) starts again at the first step, playing unless motion is reduced.
  const fresh = state.key !== runKey;
  const active = fresh ? 0 : Math.min(state.step, Math.max(0, steps.length - 1));
  const playing = fresh ? !reducedMotion && replay > 0 && steps.length > 1 : state.playing;
  const go = (step: number, play = false) => setState({ key: runKey, step: Math.max(0, Math.min(steps.length - 1, step)), playing: play });

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (active >= steps.length - 1) setState({ key: runKey, step: active, playing: false });
      else setState({ key: runKey, step: active + 1, playing: true });
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, active, steps.length, runKey]);

  // Fetch every step's table once the run is read, so stepping never waits.
  useEffect(() => {
    for (const s of explained?.explanation.steps ?? []) if (s.view) void load(s.view);
  }, [explained]);

  if (!explained || steps.length === 0) {
    return (
      <div>
        <p className="border-b border-rule px-5 py-3 text-[15px] leading-relaxed text-muted">{explained ? "This query is more than Watch it run can follow yet. Your result shows what it returned." : empty}</p>
        {preview && preview.rows.length > 0 && (
          <div data-lenis-prevent className="max-h-[min(22rem,45svh)] overflow-auto">
            <table className="w-full border-collapse font-mono text-sm">
              <caption className="px-5 py-2 text-left font-sans text-sm text-muted">The {preview.name} table, before your query runs</caption>
              <thead className="sticky top-0 bg-sheet">
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} scope="col" className="border-b-2 border-ink px-3 py-2 text-left font-medium text-muted">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, r) => (
                  <tr key={r} className="border-b border-rule">
                    {row.map((cell, c) => (
                      <td key={c} className="whitespace-pre px-3 py-1.5 tabular-nums">
                        {formatCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const step = steps[active]!;
  // SELECT that only picks columns: show the table before it, with those columns spotlighted.
  const before = steps[active - 1];
  const display: Display =
    step.keeps && before?.view
      ? { view: before.view, onlyKept: true, spotlight: step.keeps }
      : { view: step.view, onlyKept: false, spotlight: step.reads ?? [] };
  const tableName = steps.find((s) => s.label === "FROM")?.sql.replace(/^\s*from\s+/i, "").split(/\s/)[0] ?? null;
  const explainLit = legend(step, display, tableName);
  const { list, ranges } = blocks(explained.sql.trim(), steps);
  const mark = ranges.find((r) => r.step === active && r.nested);
  // A nested step (a subquery) lights up the block that holds it.
  const lit = mark ? (ranges.find((r) => !r.nested && r.start <= mark.start && r.end >= mark.end)?.step ?? active) : active;

  return (
    <div className="@container">
      {!sameQuery(explained.sql, sql) && (
        <p className="border-b border-rule px-5 py-2.5 text-sm text-muted">Showing your last run. Run again to see your changes.</p>
      )}
      {/* The run order at a glance: each step with the rows it leaves. */}
      <ol aria-label="Steps in run order" className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-rule px-4 py-2.5">
        {steps.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && <ArrowRight size={14} className="text-muted" aria-hidden />}
            <li>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === active ? "step" : undefined}
                className={`flex min-h-11 flex-col justify-center rounded-btn border px-2.5 py-1 text-left leading-tight ${
                  i === active ? "border-ink bg-wash" : i < active ? "border-rule" : "border-rule text-muted"
                }`}
              >
                <span className="text-[13px] font-semibold">
                  {i + 1}. {s.label ?? s.sql.split(/\s+/)[0]!.toUpperCase()}
                </span>
                {s.rows !== undefined && <span className="text-xs text-muted">{s.rows === 1 ? "1 row" : `${s.rows} rows`}</span>}
              </button>
            </li>
          </Fragment>
        ))}
      </ol>

      {/* Side by side when the panel is wide enough, stacked when not. */}
      <div className="grid @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* The query as written, each clause numbered in run order. */}
        <div className="border-b border-rule py-2 @3xl:border-b-0 @3xl:border-r">
          <p className="px-4 pb-1 text-sm text-muted">Your query. Choose a line to see what it does.</p>
          {list.map((b, k) => {
            if (b.step === null) {
              return (
                <pre key={k} className="whitespace-pre-wrap py-0.5 pl-12 pr-3 font-mono text-[14px] leading-relaxed text-muted">
                  {b.text}
                </pre>
              );
            }
            const i = b.step;
            const look = i === lit ? "now" : i < active ? "done" : "later";
            return (
              <button
                key={k}
                type="button"
                onClick={() => go(i)}
                aria-current={i === lit ? "step" : undefined}
                aria-label={`Step ${i + 1} in run order: ${steps[i]!.label ?? ""}. ${b.text.replace(/\s+/g, " ").trim()}`}
                className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)] py-0.5 text-left ${
                  look === "now" ? "bg-wash shadow-[inset_4px_0_0_var(--ink)]" : "hover:bg-wash"
                }`}
              >
                <span aria-hidden className={`pr-2 text-right font-mono text-xs leading-[1.85] ${look === "now" ? "font-semibold text-ink" : "text-muted"}`}>
                  {i + 1}
                </span>
                <code className={`block whitespace-pre-wrap break-words pr-3 font-mono text-[14px] leading-relaxed ${look === "later" ? "text-muted" : "text-ink"}`}>
                  <Code
                    text={b.text}
                    offset={b.start}
                    mark={i === lit ? mark : undefined}
                    plain={look === "later"}
                    names={i === lit ? display.spotlight : []}
                  />
                </code>
              </button>
            );
          })}
        </div>

        {/* The table this step leaves. */}
        <div data-lenis-prevent className="max-h-[min(22rem,45svh)] overflow-auto">
          {explainLit && <p className="border-b border-rule bg-sheet px-3 py-2 font-sans text-sm leading-snug">{explainLit}</p>}
          {/* One table for every step, so rows that stay can slide from where they were. */}
          <StepTable step={step} display={display} reducedMotion={reducedMotion} />
        </div>
      </div>

      <div className="border-t border-rule px-5 py-3">
        <p aria-live="polite" className="text-[15px] leading-relaxed">
          <span className="font-semibold">
            Step {active + 1} of {steps.length}.
          </span>{" "}
          {step.sentence}
        </p>
        {step.count && <p className="mt-0.5 text-sm text-muted">{step.count}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="line" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous step">
            <StepBack size={16} aria-hidden />
          </Button>
          <Button variant="line" onClick={() => (playing ? go(active) : go(active >= steps.length - 1 ? 0 : active, true))}>
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playing ? "Pause" : active >= steps.length - 1 ? "Play again" : "Play"}
          </Button>
          <Button variant="line" onClick={() => go(active + 1)} disabled={active === steps.length - 1} aria-label="Next step">
            <StepForward size={16} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
