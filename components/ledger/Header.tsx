"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";

// Review and My progress join the nav once those pages exist.
const NAV = [{ href: "/chapters", label: "Chapters" }] as const;

export function Header() {
  const pathname = usePathname();
  return (
    <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-5 sm:px-14 sm:pt-7">
      <Link href="/" className="inline-flex min-h-11 items-center font-serif text-[26px] font-semibold italic text-ink no-underline">
        {BRAND_NAME}
      </Link>
      <nav aria-label="Main">
        <ul className="flex flex-wrap gap-x-7 text-[15px]">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                className={[
                  "inline-flex min-h-11 items-center hover:text-ink hover:underline",
                  pathname.startsWith(item.href) ? "text-ink underline" : "text-muted no-underline",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
