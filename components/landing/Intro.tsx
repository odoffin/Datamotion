import { BRAND_NAME } from "@/lib/brand";
import { InlineScript } from "./InlineScript";
import { INTRO_SCRIPT } from "./intro-script";

// Waves: a 200-unit period, so flowing by 400 loops without a seam.
const wave = (top: number, depth: number) =>
  `M-200 ${top} q50 -${depth} 100 0${" t100 0".repeat(15)} V400 H-200 Z`;

/**
 * The loading intro (design/reference/Loader.dc.html): ink rises inside the
 * outlined wordmark like water, a pen underline draws, and the sheet lifts
 * away with a wavy edge. It sits before the page in the HTML so nothing of
 * the page can paint first; it is aria-hidden and holds nothing focusable.
 */
export function Intro() {
  return (
    <>
      <InlineScript html={INTRO_SCRIPT} />
      <div className="intro" aria-hidden>
        <svg viewBox="0 0 700 260" className="block h-auto w-[760px] max-w-[90%]">
          <defs>
            <clipPath id="intro-letters">
              <text x="350" y="190" textAnchor="middle" className="intro-word font-serif">
                {BRAND_NAME}
              </text>
            </clipPath>
          </defs>
          {/* The outline is the outer half of a stroke under a paper fill: the variable
              font's glyphs overlap inside, and a plain stroke would draw those seams. */}
          <text
            x="350"
            y="190"
            textAnchor="middle"
            className="intro-word fill-paper stroke-ink font-serif [paint-order:stroke]"
            strokeWidth={4}
          >
            {BRAND_NAME}
          </text>
          <g clipPath="url(#intro-letters)">
            <g className="intro-rise">
              <g className="intro-top">
                <g className="intro-flow-slow opacity-45">
                  <path className="fill-margin" d={wave(14, 22)} />
                </g>
                <g className="intro-flow-fast">
                  <path className="fill-pen" d={wave(24, 26)} />
                </g>
              </g>
            </g>
          </g>
          <path
            className="intro-line fill-none stroke-pen [stroke-linecap:round]"
            pathLength={1}
            strokeWidth={5}
            d="M70 222 C170 210 300 232 420 218 C520 207 600 224 640 214"
          />
        </svg>
        <p className="intro-say px-4 text-center font-hand text-[clamp(1.5rem,6vw,2rem)] leading-none text-pen">type it yourself, watch it run</p>
        <div className="intro-edge">
          <svg width="100%" height="70">
            <defs>
              <pattern id="intro-wave" width="200" height="70" patternUnits="userSpaceOnUse">
                <path className="fill-paper" d="M0 0 H200 V30 Q150 2 100 30 Q50 58 0 30 Z" />
              </pattern>
            </defs>
            <rect width="100%" height="70" fill="url(#intro-wave)" />
          </svg>
        </div>
      </div>
    </>
  );
}
