/* Branding guard: two supplied pictures are the only sources; every generated image is referenced, fits Android's safe zone, and matches the splash colour. */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { inflateSync } from "node:zlib";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const png = (f: string) => { const b = readFileSync(join(root, f)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25], sig: b.subarray(0, 8).toString("hex") }; };

/** A small PNG reader (8-bit, not interlaced) so the test can look at the actual pixels. */
function decode(f: string) {
  const b = readFileSync(join(root, f)); const w = b.readUInt32BE(16), h = b.readUInt32BE(20), ch = b[25] === 6 ? 4 : b[25] === 2 ? 3 : 0;
  const parts: Buffer[] = []; for (let o = 8; o < b.length;) { const len = b.readUInt32BE(o), type = b.subarray(o + 4, o + 8).toString(); if (type === "IDAT") parts.push(b.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = inflateSync(Buffer.concat(parts)), stride = w * ch, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0, up = y ? px[(y - 1) * stride + x] : 0, c = x >= ch && y ? px[(y - 1) * stride + x - ch] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      const pred = ft === 0 ? 0 : ft === 1 ? a : ft === 2 ? up : ft === 3 ? (a + up) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      px[y * stride + x] = (src[x] + pred) & 255;
    }
  }
  return { w, h, ch, px, at: (x: number, y: number) => Array.from(px.subarray(y * stride + x * ch, y * stride + x * ch + ch)) };
}

const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo;
const brand = readFileSync(join(root, "src/brand.ts"), "utf8");
const brandConst = (n: string) => (brand.match(new RegExp(`export const ${n}\\s*=\\s*([^;]+);`)) || [])[1]?.trim();
const SPLASH_BG = (brandConst("SPLASH_BG") || "").replace(/"/g, "");
const splash = app.plugins.find((p: any) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];
const notif = app.plugins.find((p: any) => Array.isArray(p) && p[0] === "expo-notifications")[1];
const refs: Record<string, string> = { icon: app.icon, adaptive: app.android.adaptiveIcon.foregroundImage, themed: app.android.adaptiveIcon.monochromeImage, splash: splash.image, notification: notif.icon };
const WORDMARK = "assets/4d-ages-wordmark.png";

ok("every image named in app.json exists and is a real PNG", Object.values(refs).every((p) => existsSync(join(root, p)) && png(p).sig === "89504e470d0a1a0a"));

// nothing unreferenced in assets/
const walk = (d: string): string[] => readdirSync(d).flatMap((x) => { const p = join(d, x); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(x) ? [p] : []; });
const code = ["app", "src"].flatMap((d) => walk(join(root, d))).map((f) => readFileSync(f, "utf8")).join("\n");
const used = (name: string) => JSON.stringify(app).includes(name) || code.includes(name);
const assets = readdirSync(join(root, "assets"));
ok("no unused image is left in assets/ (" + assets.join(", ") + ")", assets.every(used));
ok("the in-app logo (top-left of every screen) and the splash icon are used by screens", used("4d-ages-wordmark.png") && used("splash-icon.png"));

const sq = (f: string, n: number) => { const p = png(f); return p.w === n && p.h === n; };
ok("icon 1024² and opaque", sq(refs.icon, 1024) && png(refs.icon).colorType === 2);
ok("adaptive icon 1024² and opaque", sq(refs.adaptive, 1024) && png(refs.adaptive).colorType === 2);
ok("splash icon 1024²", sq(refs.splash, 1024));
ok("themed (monochrome) icon 1024² with transparency", sq(refs.themed, 1024) && png(refs.themed).colorType === 6);
ok("notification icon 96² with transparency", sq(refs.notification, 96) && png(refs.notification).colorType === 6);

// the in-app logo keeps its proportions (the app draws it with brand.ts's aspect ratio)
const wm = png(WORDMARK), aspect = wm.w / wm.h;
const declared = Function(`return ${brandConst("WORDMARK_ASPECT")}`)();
ok(`the in-app logo is transparent and its proportions (${aspect.toFixed(4)}) match src/brand.ts (${declared.toFixed(4)})`, wm.colorType === 6 && Math.abs(aspect - declared) < 0.002 && wm.w >= 900);
const wmPix = decode(WORDMARK);
ok("the in-app logo's corners are transparent (its cream backdrop was removed)", [[2, 2], [wmPix.w - 3, 2], [2, wmPix.h - 3], [wmPix.w - 3, wmPix.h - 3]].every(([x, y]) => wmPix.at(x, y)[3] === 0));

// one cream everywhere: the splash colour, the icon pictures' backdrop and the loading screen must match, so there are no seams
const hex = SPLASH_BG.replace("#", ""), bg = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const close = (p: number[]) => [0, 1, 2].every((i) => Math.abs(p[i] - bg[i]) <= 2);
ok(`splash colour ${SPLASH_BG} is used by the splash screen, the adaptive icon and src/brand.ts`, /^#[0-9a-f]{6}$/i.test(SPLASH_BG) && splash.backgroundColor.toLowerCase() === SPLASH_BG.toLowerCase() && app.android.adaptiveIcon.backgroundColor.toLowerCase() === SPLASH_BG.toLowerCase());
for (const k of ["splash", "adaptive", "icon"] as const) {
  const d = decode(refs[k]);
  ok(`${refs[k]}: its edges are exactly the splash cream (no visible rectangle or seam)`, [[0, 0], [d.w - 1, 0], [0, d.h - 1], [d.w - 1, d.h - 1], [d.w >> 1, 0], [0, d.h >> 1]].every(([x, y]) => close(d.at(x, y))));
}
ok("splash image is drawn at the size the artwork was fitted to (Android 12's round mask)", splash.imageWidth === Number(brandConst("SPLASH_ICON_WIDTH")) && splash.resizeMode === "contain");

// The artwork — every card with its cream outline, but not the soft glow — measured on the real pixels. The outlines are the whitest
// thing in the picture and the glow lies outside the stack's outermost outline, so: take the cream strokes that aren't the empty
// backdrop, thicken them to bridge the gaps where cards overlap, fill what they enclose, and shrink back.
function artwork(f: string, r: number) {
  const d = decode(f), W = d.w, H = d.h, N = W * H;
  const cream = new Uint8Array(N);
  for (let i = 0; i < N; i++) cream[i] = Math.min(d.px[i * d.ch], d.px[i * d.ch + 1], d.px[i * d.ch + 2]) >= 230 ? 1 : 0;
  const flood = (allowed: Uint8Array, seeds: number[]) => { const seen = new Uint8Array(N), st = seeds.filter((i) => allowed[i]); st.forEach((i) => (seen[i] = 1)); while (st.length) { const i = st.pop() as number, x = i % W, y = (i / W) | 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && allowed[j] && !seen[j]) { seen[j] = 1; st.push(j); } } return seen; };
  const backdrop = flood(cream, [0]);                                     // the empty cream around everything
  const outlines = new Uint8Array(N); for (let i = 0; i < N; i++) outlines[i] = cream[i] && !backdrop[i] ? 1 : 0;
  const grow = (a: Uint8Array) => { // dilate by a (2r+1) square: rows, then columns, with running sums
    const t = new Uint8Array(N), o = new Uint8Array(N);
    for (let y = 0; y < H; y++) { const cs = new Int32Array(W + 1); for (let x = 0; x < W; x++) cs[x + 1] = cs[x] + a[y * W + x]; for (let x = 0; x < W; x++) t[y * W + x] = cs[Math.min(W, x + r + 1)] - cs[Math.max(0, x - r)] > 0 ? 1 : 0; }
    for (let x = 0; x < W; x++) { const cs = new Int32Array(H + 1); for (let y = 0; y < H; y++) cs[y + 1] = cs[y] + t[y * W + x]; for (let y = 0; y < H; y++) o[y * W + x] = cs[Math.min(H, y + r + 1)] - cs[Math.max(0, y - r)] > 0 ? 1 : 0; }
    return o;
  };
  const thick = grow(outlines);
  const empty = new Uint8Array(N); for (let i = 0; i < N; i++) empty[i] = thick[i] ? 0 : 1;
  const outside = flood(empty, [0, W - 1, N - W, N - 1]);                 // fill holes: what the thick outlines enclose is the artwork
  const filled = new Uint8Array(N); for (let i = 0; i < N; i++) filled[i] = outside[i] ? 0 : 1;
  const inv = new Uint8Array(N); for (let i = 0; i < N; i++) inv[i] = filled[i] ? 0 : 1;
  const shrunk = grow(inv);                                               // erode = grow the complement
  let x0 = W, x1 = -1, y0 = H, y1 = -1, far = 0;
  for (let i = 0; i < N; i++) if (!shrunk[i]) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); far = Math.max(far, Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2) / W); }
  return { dx: ((x0 + x1) / 2 / W - 0.5) * 100, dy: ((y0 + y1) / 2 / H - 0.5) * 100, far };
}
const STRICT = 66 / 108 / 2; // Android's strict safe circle: 66 dp of the 108 dp icon = 0.3056 of the canvas (the 72 dp visible mask is 0.333)
for (const k of ["adaptive", "splash"] as const) {
  const m = artwork(refs[k], 6);
  ok(`${refs[k]}: the artwork (outlines included) fits Android's STRICT safe circle — reaches ${m.far.toFixed(4)} ≤ ${STRICT.toFixed(4)} of the canvas`, m.far <= STRICT);
  // sideways is measured on crisp edges, so it is tight; the top edge is faint (little glow there), so up/down gets more room
  ok(`${refs[k]}: the artwork is centred — off by ${m.dx.toFixed(2)}% across and ${m.dy.toFixed(2)}% down (the old placement was +1.42% right and −2.69% up)`, Math.abs(m.dx) <= 0.6 && Math.abs(m.dy) <= 1.5);
}
const mi = artwork(refs.icon, 8);
ok(`${refs.icon}: the full-bleed icon's artwork is centred — off by ${mi.dx.toFixed(2)}% across and ${mi.dy.toFixed(2)}% down, and clear of the edges (reaches ${mi.far.toFixed(3)})`, Math.abs(mi.dx) <= 1.0 && Math.abs(mi.dy) <= 2 && mi.far <= 0.46);
// the saturated parts of the artwork must sit inside the strict circle too
const farthest = (f: string, isArt: (p: number[]) => boolean) => { const d = decode(f); let far = 0, n = 0; for (let y = 0; y < d.h; y += 2) for (let x = 0; x < d.w; x += 2) if (isArt(d.at(x, y))) { n++; far = Math.max(far, Math.hypot(x - d.w / 2, y - d.h / 2) / d.w); } return { far, n }; };
const dist = (p: number[]) => Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]);
for (const k of ["adaptive", "splash"] as const) { const r = farthest(refs[k], (p) => dist(p) > 70); ok(`${refs[k]}: even the strongly coloured parts stay inside the strict circle (farthest ${r.far.toFixed(3)} ≤ ${STRICT.toFixed(3)})`, r.n > 1000 && r.far <= STRICT); }
const sil = (f: string) => { const d = decode(f); let allWhite = true, far = 0, seen = 0; for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const p = d.at(x, y); if (p[3] > 0) { seen++; if (p[0] !== 255 || p[1] !== 255 || p[2] !== 255) allWhite = false; far = Math.max(far, Math.hypot(x + 0.5 - d.w / 2, y + 0.5 - d.h / 2) / d.w); } } return { allWhite, far, seen }; };
const nIcon = sil(refs.notification), tIcon = sil(refs.themed);
ok("notification icon is a pure white silhouette (the shape is only in the alpha)", nIcon.allWhite && nIcon.seen > 1500);
ok("themed icon is a pure white silhouette inside the strict safe circle (" + tIcon.far.toFixed(3) + " ≤ " + STRICT.toFixed(3) + ")", tIcon.allWhite && tIcon.seen > 10000 && tIcon.far <= STRICT);

// ---- the themed-icon glyph (what a Pixel tints with the wallpaper colour). A launcher draws it in ONE colour, so it must be simple:
// whole shapes, clean gaps between them, no specks, and some breathing room inside the launcher's circle.
function glyphShapes(f: string) {
  const d = decode(f), W = d.w, H = d.h, N = W * H, on = new Uint8Array(N);
  for (let i = 0; i < N; i++) on[i] = d.px[i * d.ch + 3] > 127 ? 1 : 0;
  const label = new Int32Array(N), areas: number[] = [], bounds: number[][] = [];
  for (let i = 0; i < N; i++) {
    if (!on[i] || label[i]) continue;
    const id = areas.length + 1, st = [i]; label[i] = id; let area = 0; const edge: number[] = [];
    while (st.length) { const j = st.pop() as number, x = j % W, y = (j / W) | 0; area++; let border = false;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) { if (k < 0 || !on[k]) { border = true; continue; } if (!label[k]) { label[k] = id; st.push(k); } }
      if (border) edge.push(j); }
    areas.push(area); bounds.push(edge);
  }
  return { W, H, areas, bounds };
}
const gl = glyphShapes(refs.themed);
ok(`themed glyph: ${gl.areas.length} whole shapes (card stack, child's head, heart) and no specks — the smallest is ${Math.min(...gl.areas)} px`, gl.areas.length >= 4 && gl.areas.length <= 7 && Math.min(...gl.areas) >= 3000);
let tight = Infinity;
for (let a = 0; a < gl.bounds.length; a++) for (let b = a + 1; b < gl.bounds.length; b++) { const A = gl.bounds[a].filter((_, i) => i % 2 === 0), B = gl.bounds[b].filter((_, i) => i % 2 === 0);
  for (const p of A) { const px = p % gl.W, py = (p / gl.W) | 0; for (const q of B) { const dx = px - (q % gl.W), dy = py - ((q / gl.W) | 0), d2 = dx * dx + dy * dy; if (d2 < tight) tight = d2; } } }
tight = Math.sqrt(tight);
ok(`themed glyph: every gap between layers is at least 15 px of 1024 (tightest ${tight.toFixed(1)} px ≈ ${(tight / 1024 * 108).toFixed(1)} dp), so none closes up at launcher size`, tight >= 15);
ok(`themed glyph has breathing room: it reaches ${tIcon.far.toFixed(3)} of the canvas, not crammed against the circle (0.22–0.26; the visible circle is 0.333)`, tIcon.far >= 0.22 && tIcon.far <= 0.26);
ok("the notification icon is the same glyph: several whole shapes, pure white", glyphShapes(refs.notification).areas.length >= 3 && nIcon.allWhite);

// the two supplied pictures are the only sources
ok("the two supplied pictures and the generator are kept in branding/", existsSync(join(root, "branding/4d-ages-icon.jpg")) && existsSync(join(root, "branding/4d-ages-wordmark.png")) && existsSync(join(root, "branding/make-assets.py")));
ok("no earlier logo source is left behind", readdirSync(join(root, "branding")).sort().join() === "4d-ages-icon.jpg,4d-ages-wordmark.png,make-assets.py,make-wordmarks.mjs");
ok("there is a wordmark for every child theme, the same size as the original (so WORDMARK_ASPECT holds for each)", ["blue", "green"].every((c) => { const p = png(`assets/4d-ages-wordmark-${c}.png`), o = png(WORDMARK); return p.w === o.w && p.h === o.h; }));
ok("the logo follows the child's colour: every place that shows it picks the themed wordmark", ["src/components/Screen.tsx", "src/components/AboutCard.tsx"].every((f) => { const s = readFileSync(join(root, f), "utf8"); return /WORDMARKS\[t\.key\]/.test(s) && !/4d-ages-wordmark\.png/.test(s); }));
const skip = new Set(["node_modules", "assets", "branding", ".git"]); const strays: string[] = [];
const scan = (d: string) => readdirSync(d).forEach((x) => { const p = join(d, x); if (skip.has(x)) return; statSync(p).isDirectory() ? scan(p) : /\.(png|jpe?g|svg|webp|gif|ico)$/i.test(x) && strays.push(relative(root, p)); });
scan(root);
ok("no other image files anywhere in the project" + (strays.length ? " — found " + strays.join(", ") : ""), strays.length === 0);
console.log(fails ? `${fails} FAILED` : "all branding tests passed");
