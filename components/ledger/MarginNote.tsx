import type { ComponentProps } from "react";

/** A red-pen note in Caveat. Keep it short: six words at most. */
export function MarginNote({ className = "", ...props }: ComponentProps<"span">) {
  return <span className={`font-hand text-[26px] leading-none text-pen ${className}`} {...props} />;
}
