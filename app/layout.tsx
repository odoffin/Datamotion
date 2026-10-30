import type { Metadata } from "next";
import { SmoothScroll } from "@/components/SmoothScroll";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { fontVariables } from "@/lib/fonts";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s | ${BRAND_NAME}` },
  description: BRAND_TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The landing page's intro script sets data-intro on <html> before React hydrates.
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-paper font-sans text-ink">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
