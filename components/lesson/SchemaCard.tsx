import type { ColumnType, TableDef } from "@/content/datasets/types";

const TYPE_WORDS: Record<ColumnType, string> = {
  INTEGER: "whole number",
  DOUBLE: "decimal number",
  VARCHAR: "text",
  DATE: "date",
};

/** The table's columns and types, one click from the editor. `framed` draws its own sheet. */
export function SchemaCard({ table, framed = true }: { table: TableDef; framed?: boolean }) {
  return (
    <section aria-labelledby={`schema-${table.name}`} className={`min-w-0 ${framed ? "border border-ink bg-sheet" : ""}`}>
      <h2 id={`schema-${table.name}`} className={`px-4 py-2.5 text-[15px] ${framed ? "border-b-2 border-ink" : "border-b border-rule"}`}>
        <span className="font-serif text-lg font-semibold">{table.name}</span>
        <span className="text-muted"> columns</span>
      </h2>
      <dl className="px-4 py-1 text-sm">
        {table.columns.map((c) => (
          <div key={c.name} className="border-b border-rule py-1.5 last:border-0">
            <dt className="font-mono text-ink">{c.name}</dt>
            <dd className="text-[13px] text-muted">
              <span className="font-mono">{c.type}</span>, {TYPE_WORDS[c.type]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
