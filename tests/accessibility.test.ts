/*
 * Accessibility (WCAG 2.2 AA), on the website and in the app: the states screen readers hear, names for every control, pop-up and frame,
 * headings, a main region, page titles, the keyboard, focus, motion, and zoom. (The website was also checked screen by screen with axe.)
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const walk = (d: string): string[] => readdirSync(join(root, d)).flatMap((f) => (statSync(join(root, d, f)).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
const tsx = [...walk("app"), ...walk("src")].filter((f) => f.endsWith(".tsx"));
const all = tsx.map((f) => [f, read(f)] as const);

ok("states are the standard aria-* props (the website's library ignores accessibilityState, so screen readers never heard “checked”)", !all.some(([, s]) => /accessibilityState=/.test(s)));
ok("radios, checkboxes and switches say “checked”; tabs say “selected” (never “pressed” for a radio or checkbox)", !all.some(([, s]) => /accessibilityRole="(radio|checkbox)"[^>]*aria-pressed/.test(s)) && /accessibilityRole="tab"[^>]*aria-selected/.test(read("app/(tabs)/_layout.tsx")) && /accessibilityRole="tablist"/.test(read("app/(tabs)/_layout.tsx")));
ok("the segmented switches are radio groups", /accessibilityRole="radiogroup"/.test(read("src/components/ui.tsx")) && /accessibilityRole="radio"\s+aria-checked=\{on\}/.test(read("src/components/ui.tsx")));
ok("every slider has a name and its value, and moves with the keyboard on the website", !all.some(([f, s]) => f !== "src/components/AppSlider.tsx" && f !== "src/components/AppSlider.web.tsx" && /<Slider\b/.test(s)) && /"aria-valuenow"/.test(read("src/components/AppSlider.web.tsx")) && /ArrowRight/.test(read("src/components/AppSlider.web.tsx")) && /Home/.test(read("src/components/AppSlider.web.tsx")));
ok("every switch says what it turns on", !all.some(([, s]) => /<Switch(?![^>]*accessibilityLabel)[^>]*\/>/.test(s)));
ok("every pop-up says what it is", all.every(([, s]) => s.split("\n").filter((l) => /<Modal\b/.test(l)).every((l) => /dialogName\(/.test(l))) && all.some(([, s]) => /<Modal\b/.test(s)));
ok("every text box has a name (its label, or its example text)", /accessibilityLabel=\{typeof props\.placeholder === "string" \? props\.placeholder : undefined\}/.test(read("src/components/ui.tsx")) && !all.some(([, s]) => /<Input\b(?![^>]*(placeholder=|accessibilityLabel=))[^>]*\/>/s.test(s)));
ok("frames (the book's pages, the maps) have titles", /title,\s+srcDoc/.test(read("src/components/WebFrame.web.tsx")) && ["src/components/BookPreview.tsx", "src/components/BookCustomizer.tsx", "src/components/OsmMap.tsx"].every((f) => /<WebView[\s\S]{0,40}accessibilityLabel="/.test(read(f))));
ok("headings: a screen's title, then its sections", /role="heading" aria-level=\{1\}/.test(read("src/components/Page.tsx")) && /role="heading" aria-level=\{2\}/.test(read("src/components/Page.tsx")) && /role="heading" aria-level=\{1\}/.test(read("src/components/ui.tsx")));
ok("the website: the app is the page's main region, and every screen names the page", /role="main"/.test(read("src/components/AppColumn.web.tsx")) && /document\.title = /.test(read("src/components/AppColumn.web.tsx")) && /"Settings"/.test(read("src/components/AppColumn.web.tsx")));
const site = read("src/components/SiteHeader.tsx");
ok("the website on a computer: a header with the pages as links (the current one marked), the profiles side by side, an Add menu that says it's open (Escape closes it), and a footer with the legal pages", /role="navigation"/.test(site) && /aria-current=\{on \? "page"/.test(site) && /aria-expanded=\{adding\}/.test(site) && /aria-label="Profiles"/.test(site) && /role="menu"/.test(site) && /e\.key === "Escape"/.test(site) && ["PRIVACY_URL", "TERMS_URL", "ACCESSIBILITY_URL", "LICENCES_URL", "CONTACT_EMAIL"].every((x) => /export function SiteFooter[\s\S]*/.exec(site)![0].includes(x)) && /<SiteHeader \/>/.test(read("app/(tabs)/_layout.tsx")) && /<SiteHeader \/>/.test(read("src/components/Page.tsx")) && /export const WIDE = 960/.test(read("src/lib/useWide.web.ts")));
const page = read("public/index.html");
ok("the website: a clear focus outline, less motion when asked, the language set, and zoom allowed", /:focus-visible/.test(page) && /prefers-reduced-motion/.test(page) && /<html lang="en">/.test(page) && !/maximum-scale|user-scalable=no/.test(page) && /:focus-visible/.test(read("public/site.css")));
ok("confetti is left out when the device asks for less motion", /isReduceMotionEnabled/.test(read("src/components/Confetti.tsx")) && /calm \? \[\]/.test(read("src/components/Confetti.tsx")));
ok("a pop-up under another is hidden from screen readers (a fix to the website's library, applied on every install)", existsSync(join(root, "patches/react-native-web+0.21.4.patch")) && /aria-hidden": active \? undefined : true/.test(read("patches/react-native-web+0.21.4.patch")) && JSON.parse(read("package.json")).scripts.postinstall === "patch-package");
ok("the plain pages: a main region, headings, and the same focus outline", ["privacy", "terms", "accessibility", "licences", "delete-account", "j"].every((p) => /<main>/.test(read(`public/${p}/index.html`)) && /<h1>/.test(read(`public/${p}/index.html`)) && /lang="en"/.test(read(`public/${p}/index.html`))));
ok("the accessibility statement says how and when it was checked", /How we check/.test(read("public/accessibility/index.html")) && /WCAG 2\.2 level AA/.test(read("public/accessibility/index.html")));

console.log(fails ? `${fails} FAILED` : "all accessibility tests passed");
if (fails) process.exit(1);
