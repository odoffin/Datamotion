import type { ReactNode } from "react";
import { Header } from "@/components/ledger";
import { StorageNotice } from "@/components/ledger/StorageNotice";

/** The app pages (map, quiz, lessons) share the Ledger header. The landing page has its own. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <StorageNotice />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
