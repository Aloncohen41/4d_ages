import { tr } from "./i18n";
/*
 * Confetti that behaves like the real thing: paper pieces burst out of the middle of the screen in every direction, air slows them almost at
 * once, gravity takes over, and each piece flutters side to side and turns over as it falls (so it flashes thin, then wide). The flight is
 * worked out ahead of time and sampled into keyframes, so it plays smoothly on the phone's animation thread. Pure, for tests.
 */

export type PieceShape = "rect" | "square" | "circle" | "streamer";

export interface Piece {
  shape: PieceShape;
  colour: string;
  w: number;
  h: number;
  delay: number; // ms
  /** Keyframes (0..1 of the piece's flight): where it is, how it's turned, and how much it has flipped over (1 = face on, 0 = edge on). */
  times: number[];
  x: number[];
  y: number[];
  spin: number[]; // degrees
  flip: number[]; // scale, -1..1 (the back shows when negative)
}

/** Rich party colours, in pairs that read well on light and dark screens. */
export const CONFETTI_COLOURS = ["#ff5d8f", "#ffb627", "#2ec4b6", "#3a86ff", "#8338ec", "#ff6b35", "#06d6a0", "#ffd60a", "#ef476f", "#118ab2", "#f15bb5", "#ffffff"];

export const CONFETTI_MS = 4600;
const SAMPLES = 64; // enough to follow every flutter and flip (at least 7 a turn)

/** A small, repeatable random number source (so a burst can be tested). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * One burst: `count` pieces from the middle of a `width` × `height` screen, thrown out in every direction (a little more upwards, as a
 * popper would), in two waves a moment apart.
 */
export function burst(width: number, height: number, count = 340, random: () => number = Math.random): Piece[] {
  const cx = width / 2;
  const cy = height * 0.48;
  const scale = Math.min(width, height) / 400; // bigger screens, bigger throw
  const out: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const r = random;
    const kind = r();
    const shape: PieceShape = kind < 0.52 ? "rect" : kind < 0.74 ? "square" : kind < 0.9 ? "circle" : "streamer";
    const size = (9 + r() * 10) * Math.max(1, scale * 0.9);
    const w = shape === "streamer" ? size * 0.45 : shape === "rect" ? size * 1.15 : size;
    const h = shape === "streamer" ? size * 3.2 : shape === "rect" ? size * 0.55 : size;
    const wave = i < count * 0.72 ? 0 : 1;
    const delay = wave * 220 + r() * 120;
    // the throw: every direction, faster for some, a lift upwards; lighter shapes feel the air more
    const angle = r() * Math.PI * 2;
    // spread evenly over the screen (not a hollow ring): slow throws fill the middle, fast ones reach the edges and a little beyond
    const speed = (120 + Math.sqrt(r()) * 1250) * scale * (wave ? 0.7 : 1) * (Math.abs(Math.cos(angle)) > 0.7 ? 0.8 : 1);
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed - (260 + r() * 340) * scale;
    const drag = shape === "circle" ? 2.6 : shape === "streamer" ? 3.6 : 3.1 + r() * 0.8;
    const gravity = 980 * scale * (shape === "circle" ? 0.85 : 0.62);
    const sway = (14 + r() * 26) * scale; // flutter, side to side
    const swayHz = 0.9 + r() * 1.3;
    const phase = r() * Math.PI * 2;
    const spinRate = (r() < 0.5 ? -1 : 1) * (90 + r() * 420); // degrees a second
    const flipHz = 0.8 + r() * 1.0; // paper turns over about once or twice a second
    let x = cx + (r() - 0.5) * 24;
    let y = cy + (r() - 0.5) * 24;
    const life = (CONFETTI_MS - delay) / 1000;
    const steps = 240;
    const dt = life / steps;
    const times: number[] = [], xs: number[] = [], ys: number[] = [], spins: number[] = [], flips: number[] = [];
    for (let k = 0, s = 0; k <= steps; k++) {
      const t = k * dt;
      if (k === Math.round((s * steps) / SAMPLES)) {
        // the flutter grows as the piece slows down (it's carried by the air instead of thrown)
        const calm = Math.min(1, t / 0.9);
        times.push(s / SAMPLES);
        xs.push(x + Math.sin(phase + t * swayHz * Math.PI * 2) * sway * calm - cx);
        ys.push(y - cy);
        spins.push(spinRate * t);
        flips.push(Math.cos(phase + t * flipHz * Math.PI * 2));
        s++;
      }
      const k1 = Math.exp(-drag * dt);
      vx *= k1;
      vy = vy * k1 + gravity * dt;
      // falling paper doesn't keep speeding up: it settles at a gentle drift
      const terminal = (shape === "circle" ? 260 : 170) * scale;
      if (vy > terminal) vy = terminal + (vy - terminal) * 0.9;
      x += vx * dt;
      y += vy * dt;
    }
    out.push({ shape, colour: CONFETTI_COLOURS[Math.floor(r() * CONFETTI_COLOURS.length)], w, h, delay, times, x: xs, y: ys, spin: spins, flip: flips });
  }
  return out;
}

/* ---------------- when to celebrate ---------------- */

/** Birthdays to celebrate today: a child's or a pet's real birthday (a pet's own "dog years" don't count), and a pet's gotcha day. */
export function celebrationsToday(kids: { id: string; name: string; birth: string; kind?: string; expecting?: boolean; gotchaDay?: string; role?: string }[], today: string): { id: string; childId: string; text: string }[] {
  const out: { id: string; childId: string; text: string }[] = [];
  const md = today.slice(5);
  for (const k of kids) {
    if (k.expecting) continue;
    const years = Number(today.slice(0, 4)) - Number(k.birth.slice(0, 4));
    // a 29 February birthday is celebrated on the 28th in other years
    const bday = k.birth.slice(5) === "02-29" && !isLeap(Number(today.slice(0, 4))) ? "02-28" : k.birth.slice(5);
    if (years >= 1 && bday === md) out.push({ id: `bday-${k.id}-${today.slice(0, 4)}`, childId: k.id, text: tr("Happy {0}{1} birthday, {2}!", [years, suffix(years), k.name]) });
    if (k.kind === "pet" && k.gotchaDay) {
      const g = Number(today.slice(0, 4)) - Number(k.gotchaDay.slice(0, 4));
      if (g >= 1 && k.gotchaDay.slice(5) === md) out.push({ id: `gotcha-${k.id}-${today.slice(0, 4)}`, childId: k.id, text: tr("{0} {1} since {2} came home!", [g, g === 1 ? "year" : "years", k.name]) });
    }
  }
  return out;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const suffix = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
