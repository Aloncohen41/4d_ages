/*
 * Builds the in-app logo, in each child's colours, from the supplied picture (branding/4d-ages-wordmark.png):
 *
 *     node branding/make-wordmarks.mjs
 *
 * 1. The pink logo (assets/4d-ages-wordmark.png). The picture is drawn on cream, with a pale sticker outline and a soft glow that are both
 *    nearly the cream's colour, so they can't be cut out cleanly by colour: tried that way, they come out as a speckled, half see-through
 *    white haze that shows on a dark background. Instead the coloured artwork is found (by how saturated each pixel is), and the outline is
 *    redrawn around it: a solid band OUTLINE_PX wide, with a smooth edge and no glow, so the logo reads as a clean sticker on light and dark.
 * 2. The blue and green logos, recoloured from the pink one. Each pixel is taken into CIELAB/LCH (the same maths as src/lib/m3.ts): its
 *    lightness is kept, its chroma softened a little, and its hue, measured as an offset from the rose end, is laid onto the theme seed's
 *    hue, so the gradient keeps its shape: blue runs to teal, green to mint. Out-of-screen colours have their chroma reduced.
 * All three are the same size (WORDMARK_ASPECT in src/brand.ts; the script prints it).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "assets");
const SEEDS = { pink: "#d16a92", blue: "#5f8fc2", green: "#67a058" }; // as in src/theme.ts
// per theme: how far and which way the gradient turns from the seed hue (pink turns +40° to peach), and how much of the pink's chroma to keep
const LOOK = { blue: { spread: -0.6, chroma: 0.8 }, green: { spread: 0.5, chroma: 0.85 } };
const WIDTH = 1300; // the logo's width in assets/
const OUTLINE_PX = 13; // the sticker outline, in the supplied picture's pixels
const OUTLINE = [255, 250, 246]; // its colour: a warm white
const SAT_LO = 40, SAT_HI = 75; // saturation (max − min channel) where a pixel starts and finishes counting as artwork

// ---------------------------------------------------------------- 1. the pink logo
const src = PNG.sync.read(readFileSync(join(here, "4d-ages-wordmark.png")));
const { width: W, height: H } = src;
const N = W * H;
const art = new Float64Array(N); // 0…1: how much each pixel is coloured artwork
for (let p = 0; p < N; p++) {
  const r = src.data[p * 4], g = src.data[p * 4 + 1], b = src.data[p * 4 + 2];
  const t = Math.min(1, Math.max(0, (Math.max(r, g, b) - Math.min(r, g, b) - SAT_LO) / (SAT_HI - SAT_LO)));
  art[p] = t * t * (3 - 2 * t);
}
// the picture's drop shadow is faintly pink in places: drop any patch of "artwork" too small to be part of the logo
const MIN_PATCH = 1500;
{
  const seen = new Uint8Array(N), stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (seen[s] || art[s] < 0.5) continue;
    let top = 0, n = 0;
    const patch = [];
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const p = stack[--top], x = p % W;
      patch.push(p); n++;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q >= 0 && q < N && !seen[q] && art[q] >= 0.5) { seen[q] = 1; stack[top++] = q; }
      }
    }
    if (n < MIN_PATCH) for (const p of patch) art[p] = 0;
  }
}

/** Exact Euclidean distance (in pixels) from every pixel to the nearest artwork pixel (Felzenszwalb & Huttenlocher). */
function distanceToArt() {
  const INF = 1e12, f = new Float64Array(Math.max(W, H)), d = new Float64Array(Math.max(W, H));
  const v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1);
  const pass = (n) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      while ((s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= z[k]) k--;
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  };
  const g = new Float64Array(N);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = art[y * W + x] >= 0.5 ? 0 : INF;
    pass(H);
    for (let y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x];
    pass(W);
    for (let x = 0; x < W; x++) g[y * W + x] = Math.sqrt(d[x]);
  }
  return g;
}
const dist = distanceToArt();

// premultiplied RGBA at the picture's size: the artwork, blended into a solid outline that ends in a one-pixel smooth edge
const big = new Float64Array(N * 4);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let p = 0; p < N; p++) {
  const alpha = Math.min(1, Math.max(0, OUTLINE_PX + 0.5 - dist[p]));
  if (!alpha) continue;
  const a = art[p];
  for (let c = 0; c < 3; c++) big[p * 4 + c] = alpha * (a * src.data[p * 4 + c] + (1 - a) * OUTLINE[c]);
  big[p * 4 + 3] = alpha;
  const x = p % W, y = (p - x) / W;
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}

// crop (with a little room) and shrink to WIDTH by area averaging, which is exact for a downscale
const PAD = 6;
x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(W - 1, x1 + PAD); y1 = Math.min(H - 1, y1 + PAD);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, scale = cw / WIDTH, OH = Math.round(ch / scale);
const pink = new PNG({ width: WIDTH, height: OH });
for (let oy = 0; oy < OH; oy++) {
  const sy0 = oy * scale, sy1 = Math.min(ch, (oy + 1) * scale);
  for (let ox = 0; ox < WIDTH; ox++) {
    const sx0 = ox * scale, sx1 = Math.min(cw, (ox + 1) * scale);
    const acc = [0, 0, 0, 0];
    let area = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
      const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
      for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
        const w = wy * (Math.min(sx + 1, sx1) - Math.max(sx, sx0)), p = ((sy + y0) * W + sx + x0) * 4;
        for (let c = 0; c < 4; c++) acc[c] += w * big[p + c];
        area += w;
      }
    }
    const o = (oy * WIDTH + ox) * 4, al = acc[3] / area;
    for (let c = 0; c < 3; c++) pink.data[o + c] = al > 0 ? Math.round(Math.min(255, acc[c] / acc[3])) : 0;
    pink.data[o + 3] = Math.round(al * 255);
  }
}
writeFileSync(join(assets, "4d-ages-wordmark.png"), PNG.sync.write(pink));
console.log(`assets/4d-ages-wordmark.png  ${WIDTH}x${OH}  WORDMARK_ASPECT = ${WIDTH} / ${OH}`);

// ---------------------------------------------------------------- 2. blue and green
const WHITE = [0.95047, 1, 1.08883];
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const fromLin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const labF = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const labFInv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);

function toLch(r8, g8, b8) {
  const [r, g, b] = [r8, g8, b8].map((c) => toLin(c / 255));
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0];
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2];
  const L = 116 * labF(y) - 16, a = 500 * (labF(x) - labF(y)), bb = 200 * (labF(y) - labF(z));
  return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360];
}
function lchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = WHITE[0] * labFInv(fx), y = WHITE[1] * labFInv(fy), z = WHITE[2] * labFInv(fz);
  return [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
}
const inGamut = (rgb) => rgb.every((c) => c >= -0.0004 && c <= 1.0004);
function fromLch(L, C, h) {
  let rgb = lchToLinear(L, C, h);
  if (!inGamut(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(lchToLinear(L, mid, h))) lo = mid; else hi = mid; }
    rgb = lchToLinear(L, lo, h);
  }
  return rgb.map((c) => Math.round(fromLin(Math.min(1, Math.max(0, c))) * 255));
}
const hueOf = (hex) => toLch(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16))[2];

const rose = hueOf(SEEDS.pink);
for (const name of ["blue", "green"]) {
  const target = hueOf(SEEDS[name]);
  const out = new PNG({ width: pink.width, height: pink.height });
  for (let i = 0; i < pink.data.length; i += 4) {
    const [L, C, h] = toLch(pink.data[i], pink.data[i + 1], pink.data[i + 2]);
    const offset = ((h - rose + 540) % 360) - 180; // −180…180 from the rose end
    const [r, g, b] = fromLch(L, C * LOOK[name].chroma, (target + offset * LOOK[name].spread + 360) % 360);
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = pink.data[i + 3];
  }
  writeFileSync(join(assets, `4d-ages-wordmark-${name}.png`), PNG.sync.write(out));
  console.log(`assets/4d-ages-wordmark-${name}.png`);
}
