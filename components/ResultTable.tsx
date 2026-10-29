import { CircleAlert, CircleCheck } from "lucide-react";
import type { RunQueryResult } from "@/lib/engine/db";
import { formatCell } from "./stage/format";

export function resultCountText(result: RunQueryResult): string {
  if (result.error) return "No result";
  const n = result.rows.length;
  return `${n} ${n === 1 ? "row" : "rows"} in ${result.ms.toFixed(1)} ms`;
}

interface ResultTableProps {
  result: RunQueryResult;
  /** Whether the real rows equal the animated result, cell for cell. */
  matchesAnimation: boolean;
}

/** DuckDB's actual output, shown under the animation as proof. */
export function ResultTable({ result, matchesAnimation }: ResultTableProps) {
  if (result.error) {
    return (
      <p role="alert" className="px-5 py-4 text-base text-pen">
        {result.error}
      </p>
    );
  }
  return (
    <>
      <p className={`flex items-center gap-2 px-5 py-3 text-[15px] font-semibold ${matchesAnimation ? "text-good" : "text-pen"}`}>
        {matchesAnimation ? <CircleCheck size={16} aria-hidden /> : <CircleAlert size={16} aria-hidden />}
        {matchesAnimation ? "Matches the ledger above, row for row" : "Does not match the ledger above"}
      </p>
      <div className="max-h-[28rem] overflow-auto border-t border-rule">
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
