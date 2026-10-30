import type { Dataset, TableDef } from "@/content/datasets/types";

/** Double-quotes an identifier. Callers must still allowlist it. */
export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function sqlLiteral(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number");
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function tableStatements(table: TableDef): string[] {
  const cols = table.columns
    .map((c) => `${quoteIdent(c.name)} ${c.type}`)
    .join(", ");
  const statements = [
    `CREATE OR REPLACE TABLE ${quoteIdent(table.name)} (${cols})`,
  ];
  if (table.rows.length > 0) {
    const values = table.rows
      .map((row) => {
        const cells = table.columns.map((col, i) => {
          const v = row[i] as string | number | null;
          if (v === null) return "NULL";
          return col.type === "DATE"
            ? `DATE ${sqlLiteral(v)}`
            : sqlLiteral(v);
        });
        return `(${cells.join(", ")})`;
      })
      .join(",\n");
    // Rows are inserted in declaration order, so rowid = index in `rows`.
    statements.push(`INSERT INTO ${quoteIdent(table.name)} VALUES\n${values}`);
  }
  return statements;
}

/** Driver-agnostic DDL + DML that materialises a dataset. */
export function datasetStatements(dataset: Dataset): string[] {
  return dataset.tables.flatMap(tableStatements);
}
