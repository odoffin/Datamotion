import type { ComponentProps } from "react";

/** A request slip: bordered sheet with one hard shadow, square corners. */
export function Slip({ className = "", children, ...props }: ComponentProps<"div">) {
  return (
    <div {...props}>
      <div className={`border border-ink bg-sheet px-5 pb-7 pt-6 shadow-slip sm:px-7 ${className}`}>
        {children}
      </div>
    </div>
  );
}
