"use client";

import { useEffect, useMemo, useRef } from "react";
import { LedgerRow, MarginNote, type Verdict } from "@/components/ledger";
import { rowStatesAt, type RowStatus } from "@/engine/playback";
import { formatNumber, type FilterScene } from "@/engine/scenes/filter";
import { prefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { formatCell } from "./format";

const VERDICT: Record<RowStatus, Verdict | null> = {
  idle: null,
  checking: "checking",
  pass: "kept",
  emitted: "kept",
  fail: "dropped",
  removed: "dropped",
};

/** Summary for the sheet header, e.g. "17 of 40 rows kept". */
export function filterCountText(scene: FilterScene, stepIndex: number): string {
  const { trace, table } = scene;
  const states = rowStatesAt(trace, table.rows.map((r) => r.rid), stepIndex);
  const total = table.rows.length;
  let checked = 0;
  let kept = 0;
  for (const v of states.values()) {
    if (v.status === "pass" || v.status === "emitted") kept++;
    if (v.status !== "idle" && v.status !== "checking") checked++;
  }
  if (scene.mode === "idle" || (scene.mode === "simplified" && !scene.verdicts)) return `${total} rows`;
  if (stepIndex >= trace.steps.length - 1) return `${kept} of ${total} rows kept`;
  if (checked === 0) return `${total} rows`;
  return `${checked} of ${total} checked, ${kept} kept`;
}

/** The orders ledger: every row in place, each gets a verdict as the trace plays. */
interface FilterStageProps {
  scene: FilterScene;
  stepIndex: number;
  /** Show every column under each row instead of the compact line. */
  showDetails: boolean;
}

export function FilterStage({ scene, stepIndex, showDetails }: FilterStageProps) {
  const { table, trace, boundaryValues } = scene;
  const states = useMemo(
    () => rowStatesAt(trace, table.rows.map((r) => r.rid), stepIndex),
    [trace, table.rows, stepIndex],
  );
  const idColumn = table.columns.indexOf("id");
  // The column the learner's condition looks at; otherwise the first one that is not id.
  const focus = scene.focusColumn
    ? table.columns.indexOf(scene.focusColumn)
    : table.columns.findIndex((_, i) => i !== idColumn);
  const list = useRef<HTMLDivElement>(null);

  // Keep the rows being checked in view as the trace advances, scrolling only
  // the ledger's own box ([data-ledger-scroll]) so the page never jumps.
  useEffect(() => {
    const ids = trace.steps[stepIndex]?.ops.find((op) => op.type === "highlight")?.rowIds;
    if (!ids?.length) return;
    const row = (rid: number) => list.current?.querySelector<HTMLElement>(`[data-rid="${rid}"]`);
    const first = row(ids[0]!);
    const last = row(ids[ids.length - 1]!);
    const box = first?.closest<HTMLElement>("[data-ledger-scroll]");
    if (!first || !last || !box) return;
    const b = box.getBoundingClientRect();
    // Bring the whole batch into the box, its first row at the top.
    if (first.getBoundingClientRect().top < b.top || last.getBoundingClientRect().bottom > b.bottom) {
      box.scrollBy({ top: first.getBoundingClientRect().top - b.top - 8, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }, [trace, stepIndex]);

  // Column names sit once in a header; each row holds only its values.
  const shown = showDetails ? [focus, ...table.columns.map((_, i) => i).filter((i) => i !== focus && i !== idColumn)] : [focus];
  const columns = { gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` };

  return (
    <div ref={list} role="list" aria-label={`${table.name} rows`}>
      {/* Screen readers hear each value with its column name instead (sr-only below). */}
      <div
        aria-hidden
        className="sticky top-0 z-[2] grid min-h-11 grid-cols-[72px_minmax(0,1fr)_auto] items-center border-b-2 border-ink bg-sheet font-mono text-sm text-muted"
      >
        <span className="pl-[18px]">
          {idColumn >= 0 ? "id" : "#"}
        </span>
        <span className="grid gap-x-3 pl-4 sm:pl-6" style={columns}>
          {shown.map((ci) => (
            <span key={ci} className={`truncate ${ci === focus ? "font-medium text-ink" : ""}`}>
              {table.columns[ci]}
            </span>
          ))}
        </span>
        <span className="min-w-[5.75rem] pr-3 text-right font-sans sm:min-w-[6.5rem] sm:pr-[18px]">
          Verdict
        </span>
      </div>
      {table.rows.map((row, i) => {
        const verdict = VERDICT[states.get(row.rid)?.status ?? "idle"];
        const value = row.cells[focus];
        const atBoundary =
          typeof value === "number" && boundaryValues.includes(value) && (verdict === "kept" || verdict === "dropped");
        return (
          <LedgerRow
            key={row.rid}
            role="listitem"
            data-rid={row.rid}
            marker={idColumn >= 0 ? formatCell(row.cells[idColumn]) : i + 1}
            verdict={verdict}
          >
            <span className="grid items-baseline gap-x-3 font-mono" style={columns}>
              {shown.map((ci, k) =>
                k === 0 ? (
                  <span key={ci} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="ledger-struck whitespace-nowrap text-[15px] sm:text-lg">
                      <span className="sr-only">{table.columns[ci]} </span>
                      {formatCell(row.cells[ci])}
                    </span>
                    {atBoundary && <MarginNote className="hidden text-[22px] sm:inline">exactly {formatNumber(value)}</MarginNote>}
                  </span>
                ) : (
                  <span key={ci} className="truncate text-[13px] text-muted">
                    <span className="sr-only">{table.columns[ci]} </span>
                    {formatCell(row.cells[ci])}
                  </span>
                ),
              )}
            </span>
          </LedgerRow>
        );
      })}
    </div>
  );
}
