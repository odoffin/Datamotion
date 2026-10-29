import type { ComponentProps } from "react";

type SlipProps = ComponentProps<"div"> & {
  /** Fade the slip away like dried ink (DESIGN.md Motion). */
  gone?: boolean;
};

/** A request slip: bordered sheet with one hard shadow, square corners. */
export function Slip({ gone = false, className = "", children, ...props }: SlipProps) {
  return (
    <div className={`slip ${gone ? "slip-gone" : ""}`} aria-hidden={gone || undefined} {...props}>
      <div className={`border border-ink bg-sheet px-5 pb-7 pt-6 shadow-slip sm:px-7 ${className}`}>
        {children}
      </div>
    </div>
  );
}
