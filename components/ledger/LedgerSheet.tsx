import type { ReactNode } from "react";

interface LedgerSheetProps {
  title: ReactNode;
  /** Right-hand count, e.g. "17 of 40 rows kept". */
  count?: ReactNode;
  children: ReactNode;
  /** Rendered below the ruled rows, outside the margin line. */
  footer?: ReactNode;
  className?: string;
  /** Draw the red margin line (off for wide tables). */
  margin?: boolean;
  "aria-label"?: string;
}

/** A ledger sheet: serif title and count, ruled rows, red margin line at 72px. */
export function LedgerSheet({ title, count, children, footer, className = "", margin = true, ...rest }: LedgerSheetProps) {
  return (
    <section className={`min-w-0 border border-ink bg-sheet ${className}`} aria-label={rest["aria-label"]}>
      <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink py-3 pr-5 text-[15px] ${margin ? "pl-24" : "pl-5"}`}>
        <h2 className="font-serif text-xl font-semibold">{title}</h2>
        {count !== undefined && <span className="text-muted">{count}</span>}
      </div>
      <div className="relative overflow-x-clip">
        {margin && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[72px] z-[1] border-l-2 border-margin" />
        )}
        {children}
      </div>
      {footer}
    </section>
  );
}
