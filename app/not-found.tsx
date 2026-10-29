import { ButtonLink } from "@/components/ledger";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-14 sm:px-14">
      <p className="text-[15px] text-muted">Page not found</p>
      <h1 className="mt-3 font-serif text-[clamp(2.25rem,6vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
        This page is not in the notebook.
      </h1>
      <p className="mt-5 text-lg leading-relaxed">
        The link may be old, or the lesson may not be written yet. Every chapter, written or not, is listed on the map.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/chapters">Go to the chapter map</ButtonLink>
        <ButtonLink href="/" variant="line">
          Back to the start
        </ButtonLink>
      </div>
    </div>
  );
}
