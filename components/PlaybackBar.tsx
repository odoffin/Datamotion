"use client";

import { Pause, Play, StepBack, StepForward } from "lucide-react";
import { useEffect } from "react";
import { advance, SPEEDS, usePlayback } from "@/store/playback";

const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-md border border-border bg-panel text-text hover:bg-border disabled:opacity-40";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(el.tagName)
  );
}

interface PlaybackBarProps {
  /** How long each step stays on screen at 1x, in ms. */
  durationFor: (stepIndex: number) => number;
  reducedMotion: boolean;
}

export function PlaybackBar({ durationFor, reducedMotion }: PlaybackBarProps) {
  const { stepIndex, totalSteps, playing, speed, toggle, stepBack, stepForward, seek, setSpeed } =
    usePlayback();

  // Timer: one step per tick while playing.
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(advance, durationFor(stepIndex) / speed);
    return () => window.clearTimeout(id);
  }, [playing, stepIndex, speed, durationFor]);

  // Space toggles, arrows step. Native controls keep their own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === " " && !reducedMotion) {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepForward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, stepForward, stepBack, reducedMotion]);

  const disabled = totalSteps === 0;
  const atEnd = stepIndex >= totalSteps - 1;

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border bg-panel px-4 py-3">
      <div className="flex items-center gap-2">
        <button type="button" className={iconButton} onClick={stepBack} disabled={disabled || stepIndex === 0} aria-label="Step back">
          <StepBack size={16} />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-bg disabled:opacity-40"
          onClick={toggle}
          disabled={disabled || reducedMotion}
          aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}
          title={reducedMotion ? "Autoplay is off because your system prefers reduced motion. Use the step buttons or arrow keys." : undefined}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" className={iconButton} onClick={stepForward} disabled={disabled || atEnd} aria-label="Step forward">
          <StepForward size={16} />
        </button>
      </div>

      <label className="flex min-w-40 flex-1 items-center gap-3 text-xs text-text-secondary">
        <span className="sr-only">Scrub through steps</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          value={stepIndex}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-accent"
          aria-valuetext={`Step ${stepIndex + 1} of ${totalSteps}`}
        />
        <span className="shrink-0 tabular-nums" aria-hidden>
          {totalSteps ? `${stepIndex + 1} / ${totalSteps}` : "–"}
        </span>
      </label>

      <div role="group" aria-label="Playback speed" className="flex rounded-md border border-border">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            className={[
              "px-2.5 py-1.5 text-xs tabular-nums first:rounded-l-md last:rounded-r-md",
              speed === s ? "bg-border font-semibold text-text" : "text-text-secondary hover:text-text",
            ].join(" ")}
          >
            {s}x
          </button>
        ))}
      </div>
      {reducedMotion && (
        <p className="w-full text-xs text-text-secondary">
          Reduced motion is on: step through with ← and →.
        </p>
      )}
    </div>
  );
}
