"use client";

import { Check, Search, X } from "lucide-react";
import { motion, type TargetAndTransition } from "framer-motion";
import type { RowVisual } from "@/engine/playback";
import type { StageRow } from "@/engine/scenes/filter";
import { formatCell, rowColor } from "./format";

const STATUS_LABEL: Record<RowVisual["status"], string> = {
  idle: "",
  checking: "being checked",
  pass: "kept",
  fail: "dropped",
  removed: "dropped",
  emitted: "in result",
};

interface RowBarProps {
  row: StageRow;
  columns: string[];
  visual: RowVisual;
  /** Index of the column the predicate checks. */
  focusColumn: number;
  gridTemplate: string;
  exit: TargetAndTransition;
}

export function RowBar({ row, columns, visual, focusColumn, gridTemplate, exit }: RowBarProps) {
  const { status } = visual;
  const failed = status === "fail";
  const showFocus = status === "checking" || status === "pass" || status === "fail";
  return (
    <motion.li
      layout
      layoutId={`row-${row.rid}`}
      exit={exit}
      className={[
        "relative grid h-7 items-center gap-2 rounded-md border pl-3 pr-2 font-mono text-xs",
        status === "checking" ? "border-text bg-panel" : "border-border bg-panel",
        failed ? "opacity-45" : "",
      ].join(" ")}
      style={{ gridTemplateColumns: gridTemplate }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-1 rounded-full"
        style={{ backgroundColor: rowColor(row.rid) }}
      />
      {row.cells.map((cell, i) => (
        <span
          key={columns[i]}
          className={[
            "truncate tabular-nums",
            failed ? "line-through" : "",
            showFocus && i === focusColumn ? "rounded bg-bg px-1 font-semibold text-text" : "text-text",
          ].join(" ")}
        >
          {formatCell(cell)}
        </span>
      ))}
      <span className="flex h-4 w-4 items-center justify-center" aria-hidden>
        {status === "checking" && <Search size={13} />}
        {status === "pass" && <Check size={14} strokeWidth={3} />}
        {failed && <X size={14} strokeWidth={3} />}
      </span>
      {STATUS_LABEL[status] && <span className="sr-only">{STATUS_LABEL[status]}</span>}
    </motion.li>
  );
}
