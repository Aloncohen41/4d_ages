import { lightScheme, toneOf, contrast, colorAt, hueChromaOf } from "../src/lib/m3";
import { THEMES, THEME_ORDER, TYPE } from "../src/theme";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };

// ---------- the colour maths
ok("tone is CIELAB lightness: white is 100 and black is 0, mid grey ≈ 53", Math.abs(toneOf("#ffffff") - 100) < 0.1 && toneOf("#000000") < 0.1 && Math.abs(toneOf("#777777") - 50) < 1.5);
const hues = [10, 90, 180, 270, 350];
ok("a colour made at a tone has that tone, for every hue (within 1)", hues.every((h) => [10, 30, 40, 50, 80, 90, 96, 98].every((t) => Math.abs(toneOf(colorAt(t, 40, h)) - t) < 1)));
ok("a colour keeps its hue when made (within a few degrees)", hues.every((h) => { const hc = hueChromaOf(colorAt(60, 40, h)); const d = Math.abs(((hc.hue - h + 540) % 360) - 180); return d < 4; }));
ok("a colour too vivid for a screen at that tone is reduced to fit, never broken (no invalid hex)", ["#ffffff", ...hues.map((h) => colorAt(95, 90, h)), ...hues.map((h) => colorAt(15, 90, h))].every((x) => /^#[0-9a-f]{6}$/.test(x)));
ok("contrast: black on white is 21:1, same colour is 1:1", Math.abs(contrast("#000000", "#ffffff") - 21) < 0.05 && Math.abs(contrast("#777777", "#777777") - 1) < 0.001);

// ---------- the three themes
ok("there are three themes, each with its own palette", THEME_ORDER.length === 3 && new Set(THEME_ORDER.map((k) => THEMES[k].accent)).size === 3 && new Set(THEME_ORDER.map((k) => THEMES[k].bg)).size === 3);
ok("every token is a valid colour", THEME_ORDER.every((k) => Object.entries(THEMES[k]).filter(([n]) => !["key", "label", "swatch"].includes(n)).every(([, v]) => /^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(v as string))));
ok("the roles sit at Material's tones: primary 40, container 90, on-container 10, surface 98, on-surface 10", THEME_ORDER.every((k) => { const t = THEMES[k]; return Math.abs(toneOf(t.accent) - 40) < 1.2 && Math.abs(toneOf(t.accentSoft) - 90) < 1.2 && Math.abs(toneOf(t.onAccentSoft) - 10) < 1.2 && Math.abs(toneOf(t.bg) - 98) < 1.2 && Math.abs(toneOf(t.ink) - 10) < 1.2; }));
ok("the surfaces step up in tone like Material's containers: surface > low > container > highest", THEME_ORDER.every((k) => { const t = THEMES[k]; return toneOf(t.bg) > toneOf(t.card) && toneOf(t.card) > toneOf(t.bg2) && toneOf(t.bg2) > toneOf(t.surfaceHigh) && toneOf(t.surfaceHigh) > toneOf(t.bg3); }));
ok("each theme's colour comes from its own hue (pink reads warm, blue cool, green between)", (() => { const h = (k: any) => hueChromaOf(THEMES[k as "pink"].accent).hue; return (h("pink") > 330 || h("pink") < 20) && h("blue") > 230 && h("blue") < 270 && h("green") > 110 && h("green") < 160; })());

// ---------- legibility: WCAG AA on every pairing the screens use
const pairs = (t: any): [string, string, string, number][] => [
  ["text on the page", t.ink, t.bg, 7], ["text on a card", t.ink, t.card, 7], ["text on a tonal area", t.ink, t.bg2, 7],
  ["secondary text on the page", t.ink2, t.bg, 7], ["secondary text on a card", t.ink2, t.card, 7],
  ["muted text on the page", t.ink3, t.bg, 4.5], ["muted text on a card", t.ink3, t.card, 4.5], ["muted text on a tonal area", t.ink3, t.bg2, 4.5],
  ["hint text on the page", t.ink4, t.bg, 4.5], ["hint text on a card", t.ink4, t.card, 4.5],
  ["button text on the primary colour", t.onAccent, t.accent, 4.5], ["text on a primary container", t.onAccentSoft, t.accentSoft, 7],
  ["emphasis text on a primary container", t.accentDeep, t.accentSoft, 4.5], ["primary-coloured text on the page", t.accent, t.bg, 4.5], ["primary-coloured text on a card", t.accent, t.card, 4.5],
  ["selected chip text", t.onChipOn, t.chipOn, 7], ["error text on the page", t.danger, t.bg, 4.5], ["error text on its container", t.danger, t.dangerSoft, 4.5], ["text on an error button", t.onDanger, t.danger, 4.5],
  ["snackbar text", t.onInverse, t.inverse, 7], ["text in a menu or dialog", t.ink, t.surfaceHigh, 7],
];
for (const k of THEME_ORDER) {
  const bad = pairs(THEMES[k]).filter(([, fg, bg, min]) => contrast(fg, bg) < min).map(([n, fg, bg, min]) => `${n} ${contrast(fg, bg).toFixed(2)}<${min}`);
  ok(`${k}: every text/background pairing is legible (AA, most AAA)` + (bad.length ? " — " + bad.join("; ") : ""), bad.length === 0);
}
ok("borders are quiet (soft divider) while outlines are clearly visible (≥ 3:1 for form fields)", THEME_ORDER.every((k) => contrast(THEMES[k].line, THEMES[k].bg) < 2 && contrast(THEMES[k].outline, THEMES[k].bg) >= 3));

// ---------- type scale
ok("the type scale is Material's: 16 sp titles at weight 500, 14 sp labels at 500, 14 sp body at 400, 22 sp title large, 24 sp headline small", TYPE.titleMedium.fontSize === 16 && TYPE.titleMedium.fontWeight === "500" && TYPE.labelLarge.fontSize === 14 && TYPE.labelLarge.fontWeight === "500" && TYPE.bodyMedium.fontSize === 14 && TYPE.bodyMedium.fontWeight === "400" && TYPE.titleLarge.fontSize === 22 && TYPE.headlineSmall.fontSize === 24);
ok("every style has a line height at least as tall as its text", Object.values(TYPE).every((s: any) => s.lineHeight >= s.fontSize));
console.log(fails ? `${fails} FAILED` : "all Material 3 colour and type tests passed");
