import Link from "next/link";
import type { ComponentProps } from "react";

/** solid and line; the -inverse pair is the same two styles on an ink band. */
export type ButtonVariant = "solid" | "line" | "solid-inverse" | "line-inverse";

// Transitions name their properties so the focus outline never fades in.
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-ink px-[22px] text-[15px] font-semibold no-underline transition-[color,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  solid: "bg-ink text-sheet enabled:hover:bg-ink-strong",
  line: "bg-transparent text-ink enabled:hover:bg-ink enabled:hover:text-sheet",
  "solid-inverse": "border-sheet bg-sheet text-ink enabled:hover:bg-sheet-strong",
  "line-inverse": "border-sheet bg-transparent text-sheet enabled:hover:bg-sheet enabled:hover:text-ink",
};

// Links have no :enabled state, so they take the hovers directly.
const linkHover: Record<ButtonVariant, string> = {
  solid: "hover:bg-ink-strong",
  line: "hover:bg-ink hover:text-sheet",
  "solid-inverse": "hover:bg-sheet-strong",
  "line-inverse": "hover:bg-sheet hover:text-ink",
};

export function buttonClass(variant: ButtonVariant = "solid", extra = ""): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

export function Button({ variant = "solid", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant };

export function ButtonLink({ variant = "solid", className = "", ...props }: ButtonLinkProps) {
  return (
    <Link
      className={buttonClass(variant, `hover:no-underline ${linkHover[variant]} ${className}`)}
      {...props}
    />
  );
}
