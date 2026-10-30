/**
 * The "snap": code turns to dust and drifts away, a sweep from left to right
 * like ash in the wind. Browser only. The text is redrawn on a canvas from the
 * real glyphs (their font, colour and place), split into specks, and each
 * speck lifts off when the sweep reaches it. Played backwards, it re-forms.
 */

export interface Dust {
  /** Speck positions (CSS px, relative to the box), colours and motion. */
  specks: Float32Array;
  count: number;
  /** Colour of each speck as "r,g,b". */
  colours: string[];
  width: number;
  height: number;
  /** Extra room above the box for the drift, in CSS px. */
  rise: number;
}

/** Fields per speck in `specks`. */
const F = 8; // x, y, alpha, delay, dx, dy, phase, colour index
const DURATION = 1.9;
const LIFE = 1.05;
const SAMPLE = 2; // device pixels between samples
const RISE = 90;

/**
 * Draws every visible character inside `text` onto a canvas the size of
 * `box`, then samples it into specks. Returns null if nothing was drawn.
 */
export function captureDust(text: HTMLElement, box: HTMLElement): Dust | null {
  const frame = box.getBoundingClientRect();
  const width = Math.ceil(frame.width);
  const height = Math.ceil(frame.height);
  if (!width || !height) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "middle";

  const range = document.createRange();
  const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    const value = node.textContent ?? "";
    if (!el || !value.trim()) continue;
    const style = getComputedStyle(el);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    // One glyph at a time, at the place the browser laid it out (wrapping included).
    for (let i = 0; i < value.length; i++) {
      if (/\s/.test(value[i]!)) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      ctx.fillText(value[i]!, r.left - frame.left, r.top - frame.top + r.height / 2);
    }
  }

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const colours: string[] = [];
  const colourIndex = new Map<string, number>();
  const out: number[] = [];
  for (let y = 0; y < canvas.height; y += SAMPLE) {
    for (let x = 0; x < canvas.width; x += SAMPLE) {
      const p = (y * canvas.width + x) * 4;
      const a = data[p + 3]!;
      if (a < 60) continue;
      const key = `${data[p]},${data[p + 1]},${data[p + 2]}`;
      let ci = colourIndex.get(key);
      if (ci === undefined) {
        ci = colours.length;
        colours.push(key);
        colourIndex.set(key, ci);
      }
      const cx = x / dpr;
      // The sweep crosses the code left to right; each speck leaves a little early or late.
      const delay = (cx / width) * (DURATION - LIFE - 0.15) + Math.random() * 0.15;
      out.push(cx, y / dpr, a / 255, delay, 40 + Math.random() * 110, 25 + Math.random() * 70, Math.random() * Math.PI * 2, ci);
    }
  }
  if (out.length === 0) return null;
  return { specks: Float32Array.from(out), count: out.length / F, colours, width, height, rise: RISE };
}

/**
 * Plays the dust on `canvas` (sized to the box plus room above). Forward: the
 * code blows away. Reverse: the dust gathers back into the code. `ash` is the
 * colour the specks turn as they drift (a token value, read by the caller).
 */
export function playDust(
  canvas: HTMLCanvasElement,
  dust: Dust,
  { reverse = false, ash }: { reverse?: boolean; ash: string },
): Promise<void> {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = dust.width * dpr;
  canvas.height = (dust.height + dust.rise) * dpr;
  canvas.style.width = `${dust.width}px`;
  canvas.style.height = `${dust.height + dust.rise}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve();
  ctx.scale(dpr, dpr);
  const ashRgb = toRgb(ash);
  const { specks, count, colours } = dust;
  const rgb = colours.map((c) => c.split(",").map(Number) as [number, number, number]);

  const draw = (t: number) => {
    ctx.clearRect(0, 0, dust.width, dust.height + dust.rise);
    for (let i = 0; i < count; i++) {
      const o = i * F;
      const p = Math.min(1, Math.max(0, (t - specks[o + 3]!) / LIFE));
      const alpha = specks[o + 2]! * Math.pow(1 - p, 1.4);
      if (alpha <= 0.01) continue;
      const ease = p * p;
      const x = specks[o]! + ease * specks[o + 4]! + Math.sin(p * 6 + specks[o + 6]!) * 4 * p;
      const y = specks[o + 1]! + dust.rise - ease * specks[o + 5]!;
      const [r, g, b] = rgb[specks[o + 7]!]!;
      // Ink turns to ash as it leaves.
      const m = Math.min(1, p * 1.6);
      ctx.fillStyle = `rgba(${r + (ashRgb[0] - r) * m},${g + (ashRgb[1] - g) * m},${b + (ashRgb[2] - b) * m},${alpha})`;
      const size = 1.3 - 0.6 * p;
      ctx.fillRect(x, y, size, size);
    }
  };

  return new Promise((resolve) => {
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const elapsed = (now - start) / 1000;
      const t = reverse ? Math.max(0, DURATION - elapsed) : Math.min(DURATION, elapsed);
      draw(t);
      if (elapsed < DURATION) requestAnimationFrame(tick);
      else {
        ctx.clearRect(0, 0, dust.width, dust.height + dust.rise);
        resolve();
      }
    };
    draw(reverse ? DURATION : 0);
    requestAnimationFrame(tick);
  });
}

/** "rgb(98, 93, 80)" or "#625d50" to [r, g, b]. */
function toRgb(colour: string): [number, number, number] {
  const c = colour.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(c)?.[1];
  if (hex) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const parts = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
