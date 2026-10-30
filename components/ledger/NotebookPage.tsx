import type { ComponentProps, ReactNode } from "react";

type NotebookPageProps = ComponentProps<"div"> & {
  /** A few handwritten characters in the margin, like a lesson number: "3.1". */
  margin?: ReactNode;
};

/** Where the three punched holes sit down the left edge. */
const HOLES = ["top-[18%]", "top-1/2", "top-[82%]"];

/**
 * A sheet of notebook paper: ink border and hard shadow like a slip, three
 * punched holes, and the red margin line, with an optional handwritten note
 * in the margin. Content sits to the right of the margin.
 */
export function NotebookPage({ margin, className = "", children, ...props }: NotebookPageProps) {
  return (
    <div className={`relative border border-ink bg-sheet shadow-slip ${className}`} {...props}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-10 border-l-2 border-margin sm:left-14" />
      {HOLES.map((at) => (
        <span
          key={at}
          aria-hidden
          className={`pointer-events-none absolute left-3 size-3.5 -translate-y-1/2 rounded-full border border-rule bg-paper sm:left-4 sm:size-4 ${at}`}
        />
      ))}
      {margin && (
        <span aria-hidden className="absolute left-0 top-4 w-10 text-center font-hand text-[22px] leading-none text-pen sm:w-14 sm:text-[26px]">
          {margin}
        </span>
      )}
      <div className="py-6 pl-14 pr-5 sm:pl-20 sm:pr-7">{children}</div>
    </div>
  );
}
