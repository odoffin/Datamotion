"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useMemo } from "react";
import { rowStatesAt } from "@/engine/playback";
import type { FilterScene } from "@/engine/scenes/filter";
import { formatCell } from "./format";
import { RowBar } from "./RowBar";

export function FilterStage({ scene, stepIndex }: { scene: FilterScene; stepIndex: number }) {
  const { table, trace, spec } = scene;
  const states = useMemo(
    () => rowStatesAt(trace, table.rows.map((r) => r.rid), stepIndex),
    [trace, table.rows, stepIndex],
  );
  const focusColumn = table.columns.indexOf(spec.column);
  // Each column is at least as wide as its widest value, so data never truncates.
  const gridTemplate = useMemo(() => {
    const widths = table.columns.map((_, i) =>
      Math.max(2, ...table.rows.map((r) => formatCell(r.cells[i]).length)),
    );
    return `${widths.map((w) => `minmax(${w + 1}ch, 1fr)`).join(" ")} 1rem`;
  }, [table]);
  const emittedIds = new Set(
    [...states].filter(([, v]) => v.status === "emitted").map(([id]) => id),
  );
  const source = table.rows.filter((r) => {
    const s = states.get(r.rid)?.status;
    return s !== "removed" && s !== "emitted";
  });
  const result = table.rows.filter((r) => emittedIds.has(r.rid));

  const header = (
    <div
      className="grid gap-2 pl-3 pr-2 font-mono text-[11px] text-text-secondary"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {table.columns.map((c) => (
        <span key={c} className={c === spec.column ? "truncate font-semibold text-text" : "truncate"}>
          {c}
        </span>
      ))}
      <span />
    </div>
  );

  // Rows heading to the result exit instantly; the result copy animates from
  // here via the shared layoutId. Dropped rows fade and slide out.
  const exitFor = (rid: number) =>
    emittedIds.has(rid) ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -48 };

  return (
    <motion.div layoutScroll className="absolute inset-0 grid grid-cols-1 content-start gap-4 overflow-auto p-4 md:grid-cols-2">
      <LayoutGroup>
        <section aria-label={`${spec.table} table`} className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {spec.table} · {source.length} {source.length === 1 ? "row" : "rows"}
          </h3>
          {header}
          <ul className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {source.map((row) => (
                <RowBar
                  key={row.rid}
                  row={row}
                  columns={table.columns}
                  visual={states.get(row.rid) ?? { status: "idle" }}
                  focusColumn={focusColumn}
                  gridTemplate={gridTemplate}
                  exit={exitFor(row.rid)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
        <section aria-label="Result" className="flex min-w-0 flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            result · {result.length} {result.length === 1 ? "row" : "rows"}
          </h3>
          {header}
          <ul className="flex min-h-16 flex-col gap-1 rounded-md border border-dashed border-border p-1">
            <AnimatePresence initial={false}>
              {result.map((row) => (
                <RowBar
                  key={row.rid}
                  row={row}
                  columns={table.columns}
                  visual={{ status: "emitted" }}
                  focusColumn={focusColumn}
                  gridTemplate={gridTemplate}
                  exit={{ opacity: 0, transition: { duration: 0 } }}
                />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      </LayoutGroup>
    </motion.div>
  );
}
