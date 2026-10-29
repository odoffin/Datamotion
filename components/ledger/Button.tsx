import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "solid" | "line";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-ink px-[22px] text-[15px] font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  solid: "bg-ink text-sheet enabled:hover:bg-ink-strong",
  line: "bg-transparent text-ink enabled:hover:bg-ink enabled:hover:text-sheet",
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
      className={buttonClass(variant, `hover:no-underline ${variant === "solid" ? "hover:bg-ink-strong" : "hover:bg-ink hover:text-sheet"} ${className}`)}
      {...props}
    />
  );
}
