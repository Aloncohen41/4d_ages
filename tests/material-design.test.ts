/*
 * The Material 3 look: colour roles, type, icons, and the shared components (buttons, text fields, segmented buttons, sheets, navigation bar,
 * top bar, FAB, switches). Reads the source, so the structure is pinned down even though it can't be seen without a phone.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { withAlpha } from "../src/lib/m3";
import { THEMES } from "../src/theme";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const walk = (d: string): string[] => readdirSync(join(root, d)).flatMap((n) => { const p = `${d}/${n}`; return statSync(join(root, p)).isDirectory() ? walk(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : []; });
const tsx = [...walk("app"), ...walk("src")].filter((f) => f.endsWith(".tsx"));
const all = [...walk("app"), ...walk("src")];
const ui = read("src/components/ui.tsx"), layout = read("app/(tabs)/_layout.tsx"), screen = read("src/components/Screen.tsx"), fab = read("src/components/Fab.tsx"), icon = read("src/components/Icon.tsx");

// ---------- colour
ok("withAlpha gives Material's state layers: 12% and 38% as 8-digit hex", withAlpha("#974164", 0.12) === "#9741641f" && withAlpha("#974164", 0.38) === "#97416461" && withAlpha("#974164ff", 1) === "#974164ff" && withAlpha("#000000", 0) === "#00000000");
ok("no leftover colours from the old palette (the plum scrim, old accents); notifications use the new brand colour (the PDF album keeps its own print design)", !all.some((f) => /#1e0f14|#d16a92|#b04a74|#fff8f9/i.test(read(f)) && !f.endsWith("theme.ts") && !f.endsWith("pdf.ts")) && JSON.parse(read("app.json")).expo.plugins.some((p: any) => Array.isArray(p) && p[1]?.color === THEMES.pink.accent));
ok("selected chips, segments and cards are Material's tonal container, never a dark fill with light text", !tsx.some((f) => /\? t\.ink : t\.(card|line)|backgroundColor: t\.ink\b/.test(read(f))) && !tsx.some((f) => /\? t\.bg :|color: t\.bg\b|color=\{t\.bg\}/.test(read(f))));
ok("every file that fills with the selected container also sets its text colour for it", tsx.filter((f) => /t\.chipOn/.test(read(f))).every((f) => /t\.onChipOn/.test(read(f))));
ok("chips are rounded rectangles (Material's), not full pills", !tsx.some((f) => read(f).split("\n").some((l) => /t\.chipOn/.test(l) && /borderRadius: 99/.test(l))));

// ---------- type and fonts
// The UI is set in Roboto. The one exception is the login page's tagline, in an expressive display face (feedback session, LOGIN-05).
ok("the old serif theme is gone (no FONT_SERIF); a display face is loaded only for the login tagline", !all.some((f) => /FONT_SERIF/.test(read(f))) && /useFonts\(\{ \.\.\.ICON_FONT, Fraunces_600SemiBold_Italic \}\)/.test(read("app/_layout.tsx")) && all.filter((f) => /DISPLAY_FONT/.test(read(f))).sort().join() === "app/login.tsx,src/theme.ts");
ok("headings use Material's type scale", /TYPE\.headlineSmall/.test(ui) && /TYPE\.titleLarge/.test(ui) && /TYPE\.labelLarge/.test(ui) && /TYPE\.headlineLarge/.test(screen));
ok("no text is bolder than Roboto's real bold (no 800 / 900 weights)", !tsx.some((f) => /fontWeight: "(800|900)"/.test(read(f))));

// ---------- icons
ok("Material icons: the Material Community set, with a quiet fallback for any missing glyph, and no Feather left", /MaterialCommunityIcons/.test(icon) && !/Feather/.test(icon) && /resolveGlyph/.test(icon) && /circle-small/.test(read("src/lib/iconGlyph.ts")) && /ICON_FONT = MaterialCommunityIcons\.font/.test(icon));
const names = [...icon.matchAll(/(?:^|[ ,{])"?([a-z0-9-]+)"?: "([a-z0-9-]+)"/gm)].map((m) => [m[1], m[2]]);
ok("every icon name maps to a Material glyph name (lower-case, hyphenated)", names.length >= 50 && names.every(([, g]) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(g)));
ok("each navigation destination has an outlined icon and a filled one for when it is selected", ["home", "milestones", "growth", "family", "book", "add"].every((n) => new RegExp(`"nav-${n}":`).test(icon) && new RegExp(`"nav-${n}-on":`).test(icon)));
ok("no emoji left as navigation or menu icons", !/icon: "[^a-z]/.test(layout) && !/ICON: Record<Action, string>/.test(fab) && /Record<Action, IconName>/.test(fab));
ok("every icon used by a screen exists in the map", (() => { const have = new Set(names.map((n) => n[0])); const used = new Set<string>(); for (const f of tsx) for (const m of read(f).matchAll(/<Icon name="([a-z0-9-]+)"/g)) used.add(m[1]); return [...used].every((u) => have.has(u)); })());

// ---------- shared components
ok("buttons: filled (primary), tonal, outlined and tonal-error, 44 dp tall with a full-round shape", /solid: \{ bg: t\.accent, fg: t\.onAccent \}/.test(ui) && /soft: \{ bg: t\.chipOn, fg: t\.onChipOn \}/.test(ui) && /line: \{ bg: "transparent", fg: t\.accent \}/.test(ui) && /danger: \{ bg: t\.dangerSoft, fg: t\.danger \}/.test(ui) && /minHeight: 44/.test(ui) && /borderRadius: 22/.test(ui));
ok("disabled buttons follow Material: container at 12% and label at 38%", /withAlpha\(t\.ink, 0\.12\)/.test(ui) && /withAlpha\(t\.ink, 0\.38\)/.test(ui));
ok("buttons, chips and the navigation bar ripple", (ui.match(/android_ripple/g) || []).length >= 5 && /android_ripple/.test(layout) && /android_ripple/.test(fab));
ok("text fields are outlined, and the outline thickens in the primary colour when focused", /borderColor: focused \? t\.accent : t\.outline/.test(ui) && /onFocus=\{/.test(ui) && /onBlur=\{/.test(ui) && /props\.onFocus\?\.\(e\)/.test(ui) && /cursorColor=\{t\.accent\}/.test(ui));
ok("segmented buttons are one outlined group with the chosen segment tonal", /borderColor: t\.outline/.test(ui) && /on && \{ backgroundColor: t\.chipOn \}/.test(ui) && /accessibilityState=\{\{ selected: on \}\}/.test(ui));
ok("bottom sheets: 28 dp top corners, a 32×4 drag handle, the tonal surface and the standard scrim", /borderTopLeftRadius: 28/.test(ui) && /width: 32, height: 4/.test(ui) && /backgroundColor: t\.card/.test(ui) && /backgroundColor: t\.scrim/.test(ui));
ok("the sheet's close button is an icon, and the old divider under the title is gone", /<Icon name="x"/.test(ui) && !/borderBottomWidth: 1, gap: 10/.test(ui));
ok("the toggle switches are Material's: primary track with a light thumb on, tonal track with an outlined thumb off", (read("src/components/RemindersCard.tsx").match(/thumbColor=\{[^}]*onAccent[^}]*outline\}/g) || []).length === 2);

// ---------- navigation bar, top bar, profile card, FAB
ok("navigation bar: a tonal bar with no border, 74 dp tall", /export const TAB_BAR_HEIGHT = 74/.test(layout) && /backgroundColor: t\.bg2 \}\}>/.test(layout) && !/borderTopWidth/.test(layout));
ok("the selected destination has a 52×30 pill behind its icon that grows as the page arrives, and its icon fills in", /width: 52, height: 30, borderRadius: 15, backgroundColor: t\.chipOn/.test(layout) && /scaleX: on\.interpolate/.test(layout) && /\$\{tab\?\.icon \?\? "nav-home"\}-on/.test(layout) && /color=\{t\.onChipOn\}/.test(layout));
ok("the old sliding line above the bar is gone", !/height: 3, alignItems/.test(layout) && !/cell \* \(n - 1\)/.test(layout));
ok("labels sit under the icons at 11.5 sp, shrink rather than cut off, and the selected one is bold", /adjustsFontSizeToFit/.test(layout) && /fontSize: 11\.5/.test(layout) && /fontWeight: "700"/.test(layout));
const topBar = screen.slice(screen.indexOf("export function TopBar"), screen.indexOf("export function Screen("));
ok("top bar: no divider; children are filter chips (selected = tonal, others outlined); adding a child is a tonal icon button", !/borderBottomWidth/.test(topBar) && /borderColor: t\.chipOn/.test(topBar) && /borderColor: t\.outline/.test(topBar) && /<Icon name="plus"/.test(topBar));
const hero = screen.slice(screen.indexOf("function Hero()"), screen.indexOf("/** Tap the age"));
ok("the profile card is a rounded tonal card inset from the edges (28 dp), with tonal stat tiles", /backgroundColor: t\.accentSoft, borderRadius: 28/.test(hero) && /marginHorizontal: 16/.test(hero) && /stat: \{ flex: 1, borderRadius: 18/.test(screen) && !/borderWidth: 1, paddingVertical: 10/.test(screen));
ok("the FAB is 56 dp with 18 dp corners in the primary colour, its icon turns into a close when open; the menu is tonal pills with icons", /width: 56, height: 56, borderRadius: 18/.test(fab) && /backgroundColor: t\.accent \}\]\}/.test(fab) && /rotate/.test(fab) && /backgroundColor: t\.chipOn/.test(fab) && /<Icon name=\{ICON\[kind\]\}/.test(fab) && /backgroundColor: t\.scrim/.test(fab));
console.log(fails ? `${fails} FAILED` : "all Material 3 design tests passed");
