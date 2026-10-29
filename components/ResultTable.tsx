import { CircleAlert, CircleCheck } from "lucide-react";
import type { RunQueryResult } from "@/lib/engine/db";
import { formatCell } from "./stage/format";

interface ResultTableProps {
  result: RunQueryResult;
  /** Whether the real rows equal the animated result, cell for cell. */
  matchesAnimation: boolean;
}

export function ResultTable({ result, matchesAnimation }: ResultTableProps) {
  if (result.error) {
    return (
      <p role="alert" className="text-sm text-text">
        {result.error}
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        <span className="tabular-nums">
          {result.rows.length} {result.rows.length === 1 ? "row" : "rows"} · {result.ms.toFixed(1)} ms
        </span>
        <span className="flex items-center gap-1 text-text">
          {matchesAnimation ? <CircleCheck size={14} aria-hidden /> : <CircleAlert size={14} aria-hidden />}
          {matchesAnimation ? "Matches the animation" : "Doesn't match the animation"}
        </span>
      </p>
      <div className="min-h-0 overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 bg-panel">
            <tr>
              {result.columns.map((c, i) => (
                <th key={`${c}-${i}`} scope="col" className="border-b border-border px-2 py-1.5 text-left font-semibold text-text-secondary">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, r) => (
              <tr key={r} className="odd:bg-bg even:bg-stage">
                {row.map((cell, c) => (
                  <td key={c} className="px-2 py-1 tabular-nums">
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
