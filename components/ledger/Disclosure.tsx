"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "./Button";

interface DisclosureProps {
  children: ReactNode;
  openLabel?: string;
  closeLabel?: string;
}

/** Hides a long explanation behind "Read the long version". */
export function Disclosure({
  children,
  openLabel = "Read the long version",
  closeLabel = "Hide the long version",
}: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-6">
      <Button variant="line" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {open ? closeLabel : openLabel}
      </Button>
      <div id={id} hidden={!open}>
        {open && (
          <div className="rise mt-6 space-y-3.5 border-l-2 border-ink pl-5 text-base leading-[1.7]">{children}</div>
        )}
      </div>
    </div>
  );
}
