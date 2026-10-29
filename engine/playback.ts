import type { RowId, Trace } from "./trace";

export type RowStatus = "idle" | "checking" | "pass" | "fail" | "removed" | "emitted";

export interface RowVisual {
  status: RowStatus;
  /** Column currently being examined on this row, if any. */
  column?: string;
}

/**
 * Folds the ops of steps 0..stepIndex into a per-row visual state. Pure and
 * cumulative, so scrubbing backwards is just recomputing from the start.
 */
export function rowStatesAt(
  trace: Trace,
  rowIds: readonly RowId[],
  stepIndex: number,
): Map<RowId, RowVisual> {
  const state = new Map<RowId, RowVisual>(rowIds.map((id) => [id, { status: "idle" }]));
  const last = Math.min(stepIndex, trace.steps.length - 1);
  for (let i = 0; i <= last; i++) {
    const step = trace.steps[i];
    if (!step) continue;
    // Focus from a previous step doesn't linger once a new step starts.
    for (const [id, v] of state) {
      if (v.status === "checking") state.set(id, { status: "idle" });
    }
    for (const op of step.ops) {
      for (const id of op.rowIds) {
        switch (op.type) {
          case "highlight":
            state.set(id, {
              status: op.verdict === "pass" ? "pass" : "checking",
              column: op.column,
            });
            break;
          case "dim":
            state.set(id, { status: "fail", column: op.column });
            break;
          case "remove":
            state.set(id, { status: "removed" });
            break;
          case "emit":
            state.set(id, { status: "emitted" });
            break;
          // move, link and group belong to scenes that aren't built yet.
          default:
            break;
        }
      }
    }
  }
  return state;
}
