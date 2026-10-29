import { create } from "zustand";

export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];

interface PlaybackState {
  stepIndex: number;
  totalSteps: number;
  playing: boolean;
  speed: Speed;
  reset: (totalSteps: number, autoplay: boolean) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stepForward: () => void;
  stepBack: () => void;
  seek: (index: number) => void;
  setSpeed: (speed: Speed) => void;
}

const clamp = (i: number, total: number) => Math.max(0, Math.min(i, total - 1));

export const usePlayback = create<PlaybackState>()((set, get) => ({
  stepIndex: 0,
  totalSteps: 0,
  playing: false,
  speed: 1,
  reset: (totalSteps, autoplay) => set({ totalSteps, stepIndex: 0, playing: autoplay && totalSteps > 1 }),
  play: () => {
    const { stepIndex, totalSteps } = get();
    if (totalSteps === 0) return;
    // Pressing play at the end replays from the start.
    set({ playing: true, stepIndex: stepIndex >= totalSteps - 1 ? 0 : stepIndex });
  },
  pause: () => set({ playing: false }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  stepForward: () => set((s) => ({ playing: false, stepIndex: clamp(s.stepIndex + 1, s.totalSteps) })),
  stepBack: () => set((s) => ({ playing: false, stepIndex: clamp(s.stepIndex - 1, s.totalSteps) })),
  seek: (index) => set((s) => ({ playing: false, stepIndex: clamp(index, s.totalSteps) })),
  setSpeed: (speed) => set({ speed }),
}));

/** Advances one step while playing; stops at the last step. */
export function advance() {
  usePlayback.setState((s) => {
    const next = s.stepIndex + 1;
    return next >= s.totalSteps - 1
      ? { stepIndex: Math.max(0, s.totalSteps - 1), playing: false }
      : { stepIndex: next };
  });
}
