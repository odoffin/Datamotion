import { ButtonLink } from "@/components/ledger";
import { BRAND_TAGLINE } from "@/lib/brand";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-14">
      <section className="max-w-[720px]">
        <h1 className="font-serif text-[clamp(2.5rem,7vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
          {BRAND_TAGLINE}
        </h1>
        <p className="mt-[22px] text-lg leading-relaxed">
          Write a query, run it on real data, and watch every row get its verdict.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/lesson/filter">Start the filtering lesson</ButtonLink>
        </div>
      </section>
    </div>
  );
}
