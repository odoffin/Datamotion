export type ColumnType = "INTEGER" | "DOUBLE" | "VARCHAR" | "DATE";

/** Maps a declared SQL column type to the JS value stored in the dataset. */
export type ValueOf<T extends ColumnType> = T extends "INTEGER" | "DOUBLE"
  ? number
  : string;

export interface ColumnDef<T extends ColumnType = ColumnType> {
  readonly name: string;
  readonly type: T;
}

export interface TableDef<
  C extends readonly ColumnDef[] = readonly ColumnDef[],
> {
  readonly name: string;
  readonly columns: C;
  readonly rows: readonly { readonly [K in keyof C]: C[K] extends ColumnDef<infer T> ? ValueOf<T> : never }[];
}

export interface Dataset {
  readonly id: string;
  readonly title: string;
  readonly tables: readonly TableDef[];
}

/** Helper that keeps row tuples checked against the column types. */
export function defineTable<const C extends readonly ColumnDef[]>(
  table: TableDef<C>,
): TableDef<C> {
  return table;
}

export const NUMERIC_TYPES: readonly ColumnType[] = ["INTEGER", "DOUBLE"];

export function numericColumns(dataset: Dataset, tableName: string): string[] {
  const table = dataset.tables.find((t) => t.name === tableName);
  if (!table) return [];
  return table.columns
    .filter((c) => NUMERIC_TYPES.includes(c.type))
    .map((c) => c.name);
}

/** Every table and column name, lower-cased (used by the error pointer). */
export function datasetIdentifiers(dataset: Dataset): string[] {
  return dataset.tables.flatMap((t) => [t.name, ...t.columns.map((c) => c.name)]).map((n) => n.toLowerCase());
}
