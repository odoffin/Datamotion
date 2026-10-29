import { Check, Search, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export type Verdict = "kept" | "dropped" | "checking";

type LedgerRowProps = Omit<ComponentProps<"div">, "children"> & {
  /** Shown in the 72px margin column, e.g. the row number. */
  marker: ReactNode;
  children: ReactNode;
  verdict?: Verdict | null;
};

/**
 * One ruled ledger line. States are words plus icons, never colour alone:
 * kept = check + "kept"; dropped = x + "dropped", struck, nudged and dimmed.
 * Mark the text to strike with the `ledger-struck` class.
 */
export function LedgerRow({ marker, children, verdict = null, className = "", ...props }: LedgerRowProps) {
  return (
    <div
      data-verdict={verdict ?? undefined}
      className={[
        "ledger-line grid min-h-[52px] grid-cols-[72px_minmax(0,1fr)_auto] items-center border-b border-rule",
        verdict === "checking" ? "bg-wash shadow-[inset_4px_0_0_var(--ink)]" : "",
        className,
      ].join(" ")}
      {...props}
    >
      <span className="pl-[18px] font-mono text-sm text-muted">{marker}</span>
      <div className="min-w-0 py-2 pl-6 pr-3">{children}</div>
      <span className="min-w-[6.5rem] pr-[18px] text-right text-sm font-semibold">
        {verdict === "kept" && (
          <span className="inline-flex items-center gap-1.5 text-good">
            <Check size={16} strokeWidth={3} aria-hidden />
            kept
          </span>
        )}
        {verdict === "dropped" && (
          <span className="inline-flex items-center gap-1.5 text-pen">
            <X size={16} strokeWidth={3} aria-hidden />
            dropped
          </span>
        )}
        {verdict === "checking" && (
          <span className="inline-flex items-center gap-1.5 text-ink">
            <Search size={15} strokeWidth={2.5} aria-hidden />
            checking
          </span>
        )}
      </span>
    </div>
  );
}
