"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

interface TabListProps<T extends string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Prefix for tab and panel ids, from useId(). */
  idBase: string;
  label: string;
  className?: string;
  /** "index": notebook divider tabs that stand up from the page; the chosen one joins it. */
  variant?: "underline" | "index";
}

export const tabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
export const panelId = (idBase: string, id: string) => `${idBase}-panel-${id}`;

/**
 * Ledger tabs (WAI-ARIA tabs, automatic activation): arrow keys, Home and End
 * move between tabs. The chosen tab is marked by weight and an ink rule, not
 * colour alone.
 */
export function TabList<T extends string>({ tabs, value, onChange, idBase, label, className = "", variant = "underline" }: TabListProps<T>) {
  const list = useRef<HTMLDivElement>(null);
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    const next =
      e.key === "ArrowRight" ? (i + 1) % tabs.length
      : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length
      : e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = tabs[next]!.id;
    onChange(id);
    list.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idBase, id))}`)?.focus();
  };
  return (
    <div ref={list} role="tablist" aria-label={label} className={`flex flex-wrap ${variant === "index" ? "gap-1.5 px-2 pt-2.5" : ""} ${className}`}>
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(idBase, t.id)}
            aria-controls={panelId(idBase, t.id)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={move}
            className={
              variant === "index"
                ? [
                    // Divider tabs: the chosen one is the same paper as the page and covers its top rule.
                    "relative -mb-[2px] inline-flex min-h-11 items-center gap-1.5 rounded-t-[4px] border-2 px-2.5 text-[15px] sm:gap-2 sm:px-4",
                    selected
                      ? "z-[1] border-ink border-b-sheet bg-sheet font-semibold text-ink"
                      : "border-rule border-b-ink bg-paper text-muted hover:text-ink",
                  ].join(" ")
                : [
                    "inline-flex min-h-11 items-center gap-1.5 border-b-[3px] px-3 text-[15px] sm:gap-2 sm:px-5",
                    selected ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
                  ].join(" ")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  idBase: string;
  id: string;
  selected: boolean;
  children: ReactNode;
  className?: string;
}

/** Stays mounted while hidden, so playback keeps its place when you look at another tab. */
export function TabPanel({ idBase, id, selected, children, className = "" }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idBase, id)}
      aria-labelledby={tabId(idBase, id)}
      hidden={!selected}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
