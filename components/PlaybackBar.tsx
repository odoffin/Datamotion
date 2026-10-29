"use client";

import { Pause, Play, StepBack, StepForward } from "lucide-react";
import { useEffect, useId, type KeyboardEvent } from "react";
import { advance, SPEEDS, usePlayback } from "@/store/playback";

const square =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-ink disabled:cursor-not-allowed disabled:opacity-40";

interface PlaybackBarProps {
  /** How long each step stays on screen at 1x, in ms. */
  durationFor: (stepIndex: number) => number;
  reducedMotion: boolean;
}

export function PlaybackBar({ durationFor, reducedMotion }: PlaybackBarProps) {
  const { stepIndex, totalSteps, playing, speed, toggle, stepBack, stepForward, seek, setSpeed } =
    usePlayback();
  const hintId = useId();

  // Timer: one step per tick while playing.
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(advance, durationFor(stepIndex) / speed);
    return () => window.clearTimeout(id);
  }, [playing, stepIndex, speed, durationFor]);

  // Shortcuts live on the bar only (DESIGN.md), never on the whole page.
  // Buttons keep native Space/Enter; the range keeps native arrows.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const isRange = el instanceof HTMLInputElement && el.type === "range";
    if (e.key === " " && (el === e.currentTarget || isRange)) {
      e.preventDefault();
      if (!reducedMotion) toggle();
    } else if (!isRange && e.key === "ArrowRight") {
      e.preventDefault();
      stepForward();
    } else if (!isRange && e.key === "ArrowLeft") {
      e.preventDefault();
      stepBack();
    }
  };

  const disabled = totalSteps === 0;
  const atEnd = stepIndex >= totalSteps - 1;

  return (
    <div
      role="group"
      aria-label="Playback controls"
      aria-describedby={hintId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-3 px-5 py-3"
    >
      <div className="flex items-center gap-2">
        <button type="button" className={`${square} bg-transparent text-ink`} onClick={stepBack} disabled={disabled || stepIndex === 0} aria-label="Step back">
          <StepBack size={18} aria-hidden />
        </button>
        <button
          type="button"
          className={`${square} bg-ink text-sheet`}
          onClick={toggle}
          disabled={disabled || reducedMotion}
          aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}
        >
          {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
        <button type="button" className={`${square} bg-transparent text-ink`} onClick={stepForward} disabled={disabled || atEnd} aria-label="Step forward">
          <StepForward size={18} aria-hidden />
        </button>
      </div>

      <label className="flex min-h-11 min-w-40 flex-1 items-center gap-3 text-sm text-muted">
        <span className="sr-only">Step</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, totalSteps - 1)}
          value={stepIndex}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={disabled}
          className="h-11 w-full accent-ink"
          aria-valuetext={`Step ${stepIndex + 1} of ${totalSteps}`}
        />
        <span className="shrink-0 font-mono tabular-nums" aria-hidden>
          {totalSteps ? `${stepIndex + 1}/${totalSteps}` : "0/0"}
        </span>
      </label>

      <div role="group" aria-label="Playback speed" className="flex">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            className={[
              "-ml-px min-h-11 min-w-11 border border-ink px-2 font-mono text-sm first:ml-0 first:rounded-l-btn last:rounded-r-btn",
              speed === s ? "bg-ink text-sheet" : "bg-transparent text-ink hover:bg-wash",
            ].join(" ")}
          >
            {s}x
          </button>
        ))}
      </div>

      <p id={hintId} className="sr-only w-full text-[13px] text-muted sm:not-sr-only">
        {reducedMotion
          ? "Reduced motion is on, so it will not autoplay. Step with the buttons, or focus this bar and use the arrow keys."
          : "Focus this bar: Space plays or pauses, arrow keys step."}
      </p>
    </div>
  );
}
