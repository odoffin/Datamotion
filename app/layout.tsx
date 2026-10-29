import type { Metadata } from "next";
import { Header } from "@/components/ledger";
import { StorageNotice } from "@/components/ledger/StorageNotice";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s | ${BRAND_NAME}` },
  description: BRAND_TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-hidden bg-paper font-sans text-ink">
        <Header />
        <StorageNotice />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
