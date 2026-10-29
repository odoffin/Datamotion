import { CircleAlert, CircleCheck, History } from "lucide-react";
import type { ResultVerdict } from "@/lib/lesson-status";
import type { RunQueryResult } from "@/lib/engine/db";
import { formatCell } from "./stage/format";

export function resultCountText(result: RunQueryResult): string {
  if (result.error) return "No result";
  const n = result.rows.length;
  return `${n} ${n === 1 ? "row" : "rows"} in ${result.ms.toFixed(1)} ms`;
}

interface ResultTableProps {
  result: RunQueryResult;
  /** A verdict line above the rows, e.g. whether they meet the goal. */
  verdict?: ResultVerdict | null;
}

/** DuckDB's actual output for the learner's query. */
export function ResultTable({ result, verdict }: ResultTableProps) {
  if (result.error) {
    return (
      <p role="alert" className="px-5 py-4 text-base text-pen">
        {result.error}
      </p>
    );
  }
  return (
    <>
      {verdict && (
        <p
          className={`flex items-center gap-2 px-5 py-3 text-[15px] font-semibold ${
            verdict.tone === "ok" ? "text-good" : verdict.tone === "bad" ? "text-pen" : "text-ink"
          }`}
        >
          {verdict.tone === "ok" && <CircleCheck size={16} aria-hidden />}
          {verdict.tone === "bad" && <CircleAlert size={16} aria-hidden />}
          {verdict.tone === "stale" && <History size={16} aria-hidden />}
          {verdict.text}
        </p>
      )}
      {/* Rows from an older query stay readable but visibly out of date. */}
      <div className={`max-h-[28rem] overflow-auto border-t border-rule ${verdict?.tone === "stale" ? "opacity-60" : ""}`}>
        <table className="w-full border-collapse font-mono text-sm">
          <thead className="sticky top-0 bg-sheet">
            <tr>
              {result.columns.map((c, i) => (
                <th key={`${c}-${i}`} scope="col" className="border-b-2 border-ink px-5 py-2 text-left font-medium text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, r) => (
              <tr key={r} className="border-b border-rule">
                {row.map((cell, c) => (
                  <td key={c} className="whitespace-nowrap px-5 py-2 tabular-nums">
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
