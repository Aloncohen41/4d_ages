/*
 * Builds the blue and green wordmarks from the pink one, so the logo in the top bar follows the child's colour theme.
 *
 *     node branding/make-wordmarks.mjs
 *
 * The pink wordmark (assets/4d-ages-wordmark.png, made by make-assets.py) runs from rose to peach. Each pixel is taken into CIELAB/LCH (the
 * same maths as src/lib/m3.ts): its lightness is kept, its chroma softened a little, and its hue, measured as an offset from the rose end, is laid onto the
 * theme seed's hue, so the gradient keeps its shape: blue runs to teal, green to mint.
 * Where a colour would fall outside what a screen shows, its chroma is reduced. Alpha (the glow) is kept as it is.
 * Writes assets/4d-ages-wordmark-blue.png and assets/4d-ages-wordmark-green.png.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const SEEDS = { pink: "#d16a92", blue: "#5f8fc2", green: "#67a058" }; // as in src/theme.ts
// per theme: how far and which way the gradient turns from the seed hue (pink turns +40° to peach), and how much of the pink's chroma to keep
const LOOK = { blue: { spread: -0.6, chroma: 0.8 }, green: { spread: 0.5, chroma: 0.85 } };

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

const src = PNG.sync.read(readFileSync(join(assets, "4d-ages-wordmark.png")));
const rose = hueOf(SEEDS.pink);
for (const name of ["blue", "green"]) {
  const target = hueOf(SEEDS[name]);
  const out = new PNG({ width: src.width, height: src.height });
  for (let i = 0; i < src.data.length; i += 4) {
    const [L, C, h] = toLch(src.data[i], src.data[i + 1], src.data[i + 2]);
    const offset = ((h - rose + 540) % 360) - 180; // −180…180 from the rose end
    const [r, g, b] = fromLch(L, C * LOOK[name].chroma, (target + offset * LOOK[name].spread + 360) % 360);
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = src.data[i + 3];
  }
  writeFileSync(join(assets, `4d-ages-wordmark-${name}.png`), PNG.sync.write(out));
  console.log(`assets/4d-ages-wordmark-${name}.png`);
}
