import type { ReactNode } from "react";

const CIRCLE = "M10 20 C6 6 40 1 62 3 C92 5 99 20 91 32 C81 44 30 44 14 36 C5 31 4 24 11 15";
const UNDERLINE = "M3 9 C40 3 90 12 130 6 C160 2 185 8 197 5";

/** A hand-drawn red-pen underline that draws itself once (decorative). */
export function PenUnderline({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <svg
        viewBox="0 0 200 14"
        preserveAspectRatio="none"
        aria-hidden
        className="pen-stroke absolute -bottom-1.5 left-0 h-3.5 w-full overflow-visible fill-none stroke-pen stroke-[4] [stroke-linecap:round]"
      >
        <path pathLength={1} d={UNDERLINE} />
      </svg>
    </span>
  );
}

interface PenCircleProps {
  children: ReactNode;
  /** Stroke colour class, e.g. stroke-pen or stroke-margin. */
  stroke?: string;
  width?: number;
  className?: string;
  /** Draw as it scrolls into view (where supported) instead of on load. */
  onView?: boolean;
}

/** A hand-drawn red-pen circle round a word (decorative; say what it means in text nearby). */
export function PenCircle({ children, stroke = "stroke-pen", width = 2.5, className = "", onView = false }: PenCircleProps) {
  return (
    <span className={`relative inline-block ${onView ? "pen-on-view" : ""} ${className}`}>
      {children}
      <svg
        viewBox="0 0 100 44"
        preserveAspectRatio="none"
        aria-hidden
        className={`pen-stroke pointer-events-none absolute -left-3.5 -top-3 h-[calc(100%+24px)] w-[calc(100%+28px)] overflow-visible fill-none [stroke-linecap:round] ${stroke}`}
        style={{ strokeWidth: width }}
      >
        <path pathLength={1} d={CIRCLE} />
      </svg>
    </span>
  );
}
