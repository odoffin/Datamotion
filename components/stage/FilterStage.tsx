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
  const { table, trace, spec } = scene;
  const states = useMemo(
    () => rowStatesAt(trace, table.rows.map((r) => r.rid), stepIndex),
    [trace, table.rows, stepIndex],
  );
  const focus = table.columns.indexOf(spec.column);
  const idColumn = table.columns.indexOf("id");
  const list = useRef<HTMLDivElement>(null);

  // Keep the rows being checked in view as the trace advances.
  useEffect(() => {
    const first = trace.steps[stepIndex]?.ops.find((op) => op.type === "highlight")?.rowIds[0];
    if (first === undefined) return;
    list.current
      ?.querySelector(`[data-rid="${first}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [trace, stepIndex]);

  return (
    <div ref={list} role="list" aria-label={`${spec.table} rows`}>
      {table.rows.map((row, i) => {
        const verdict = VERDICT[states.get(row.rid)?.status ?? "idle"];
        const value = row.cells[focus];
        const atBoundary = value === spec.threshold && (verdict === "kept" || verdict === "dropped");
        return (
          <LedgerRow
            key={row.rid}
            role="listitem"
            data-rid={row.rid}
            marker={idColumn >= 0 ? formatCell(row.cells[idColumn]) : i + 1}
            verdict={verdict}
            className="scroll-mt-4 [scroll-margin-bottom:calc(var(--playback-h,0px)+8px)]"
          >
            <p className="flex flex-wrap items-baseline gap-x-3 font-mono">
              <span className="ledger-struck whitespace-nowrap text-[15px] sm:text-lg">
                {spec.column} {formatCell(value)}
              </span>
              {atBoundary && <MarginNote className="text-[22px]">exactly {formatNumber(spec.threshold)}</MarginNote>}
            </p>
            {showDetails && (
              <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[13px] text-muted">
                {table.columns.map((c, ci) =>
                  ci === focus || ci === idColumn ? null : (
                    <span key={c}>
                      {c} {formatCell(row.cells[ci])}
                    </span>
                  ),
                )}
              </p>
            )}
          </LedgerRow>
        );
      })}
    </div>
  );
}
