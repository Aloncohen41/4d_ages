/* Icons must always show: the "missing glyph → dot" safety net can never turn good icons into dots. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveGlyph, usableGlyphMap, SANITY_GLYPHS } from "../src/lib/iconGlyph";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

const real = Object.fromEntries([...SANITY_GLYPHS, "home-outline", "star-outline", "chart-line", "account-group"].map((g, i) => [g, 61000 + i]));
ok("a normal glyph list: a name that exists is used as it is", resolveGlyph("home-outline", real) === "home-outline" && resolveGlyph("star", real) === "star");
ok("a name that is really missing from a normal list gets the quiet dot (not a “?” box)", resolveGlyph("no-such-icon", real) === "circle-small");
ok("if the library gives no list at all, every name is trusted — icons still show", ["home", "image-plus", "anything"].every((g) => [undefined, null, 0, "", false].every((raw) => resolveGlyph(g, raw) === g)));
ok("if the list is empty, or a list/array, or keyed some other way, every name is trusted", [{}, [], ["home", "star"], { 0: "home" }, { icons: { home: 1 } }, { HOME: 1, STAR: 2 }].every((raw) => resolveGlyph("chart-line", raw) === "chart-line" && usableGlyphMap(raw) === null));
ok("the list must contain several icons every Material set has before it is believed (4 of the 6 checks)", usableGlyphMap({ home: 1, star: 2, magnify: 3 }) === null && usableGlyphMap({ home: 1, star: 2, magnify: 3, plus: 4 }) !== null);
ok("a wrong guess about the list can NOT turn every icon into a dot (the failure this guards against)", ["nav-home", "home-outline", "chart-line", "book-open-variant", "delete-outline"].every((g) => resolveGlyph(g, { someOtherShape: true }) === g));
ok("no glyph given → the quiet dot, not a crash", resolveGlyph(undefined, real) === "circle-small");

// ---------- the wiring
const icon = read("src/components/Icon.tsx");
ok("the Icon component uses the safe check, and reads the list the way the newer library documents (getRawGlyphMap), once", /resolveGlyph\(MAP\[name\], glyphs\(\)\)/.test(icon) && /getRawGlyphMap/.test(icon) && /glyphListRead/.test(icon));
ok("the unsafe check is gone (a bare `in glyphMap` test on the component)", !/glyph in known/.test(icon) && !/\.glyphMap\?:/.test(icon.replace(/set\.glyphMap/g, "")) );
ok("the three least certain names were replaced with ones that exist in every version of the set", /calendar-blank-outline/.test(icon) && /delete-outline/.test(icon) && /"add-photo": "image-plus"/.test(icon) && !/calendar-month-outline|trash-can-outline|image-plus-outline/.test(icon));
console.log(fails ? `${fails} FAILED` : "all icon-glyph tests passed");
