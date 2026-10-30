import { Header } from "@/components/ledger";
import { NotFoundContent } from "@/components/not-found/NotFoundContent";

// Unknown URLs render outside the (app) layout, so this one brings the header.
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col">
        <NotFoundContent />
      </main>
    </>
  );
}
