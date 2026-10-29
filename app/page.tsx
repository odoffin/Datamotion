import Link from "next/link";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{BRAND_NAME}</h1>
      <p className="text-text-secondary">{BRAND_TAGLINE}</p>
      <Link
        href="/lesson/filter"
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg"
      >
        Start: Filtering rows
      </Link>
    </div>
  );
}
