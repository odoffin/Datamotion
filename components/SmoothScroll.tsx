"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Smooth wheel and trackpad scrolling (Lenis). Native scrolling stays for
 * keyboard, touch and screen readers; it is off with reduced motion, and it
 * pauses while the landing intro covers the page. Inner scroll boxes opt out
 * with data-lenis-prevent.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, anchors: true });
    const html = document.documentElement;
    const sync = () => (html.hasAttribute("data-intro") ? lenis.stop() : lenis.start());
    sync();
    const watch = new MutationObserver(sync);
    watch.observe(html, { attributes: true, attributeFilter: ["data-intro"] });
    return () => {
      watch.disconnect();
      lenis.destroy();
    };
  }, []);
  return null;
}
