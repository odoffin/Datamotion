/** Row ids are DuckDB's hidden `rowid` values for the source table. */
export type RowId = number;

interface OpBase {
  rowIds: RowId[];
  /** The column the op is about, e.g. the one a predicate checks. */
  column?: string;
}

/**
 * Visual operations a scene step applies to rows. Every op is derived from
 * the real execution of the query, never invented by the UI.
 */
export type Op =
  /** Draw attention to rows. `verdict` marks a completed check. */
  | (OpBase & { type: "highlight"; verdict?: "pass" })
  /** Rows failed a check and fade back. */
  | (OpBase & { type: "dim" })
  /** Rows leave the stage. */
  | (OpBase & { type: "remove" })
  /** Rows travel to another zone of the stage. */
  | (OpBase & { type: "move"; to: string })
  /** Rows connect to rows elsewhere (joins). */
  | (OpBase & { type: "link"; targetRowIds: RowId[] })
  /** Rows gather under a shared key (GROUP BY). */
  | (OpBase & { type: "group"; key: string })
  /** Rows become part of the final result. */
  | (OpBase & { type: "emit" });

export type OpType = Op["type"];

export interface Step {
  id: string;
  narration: string;
  ops: Op[];
}

export interface Trace {
  steps: Step[];
  resultColumns: string[];
  resultRowIds: RowId[];
}

export type SceneType =
  | "filter"
  | "sort"
  | "aggregate"
  | "join"
  | "window"
  | "cte"
  | "subquery";
