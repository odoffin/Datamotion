"use client";

/**
 * A script that runs while the server HTML is parsed, before first paint.
 * On the client it renders as text/plain so React never tries to run it again
 * (and does not warn); suppressHydrationWarning accepts the type difference.
 * Pattern from node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
