/*
 * The top bar (app name + child switcher) must stay still while tabs slide, and the child's name/picture must not repeat on every tab.
 * This reads the screens' source: the bar is rendered ONCE above the pager; the profile card is Home-only; other tabs have their own titles.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const layout = read("app/(tabs)/_layout.tsx"), screen = read("src/components/Screen.tsx");
const between = (src: string, from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to));
const screenFn = between(screen, "export function Screen(", "function Hero()");
const topBarFn = between(screen, "export function TopBar()", "export function Screen(");

// ---- the bar is fixed
const ret = layout.slice(layout.indexOf("return (", layout.indexOf("export default function TabsLayout")));
ok("the top bar is rendered by the tabs layout, above the pager (before <Tabs>, not inside it)", /<TopBar \/>/.test(layout) && ret.indexOf("<TopBar />") > -1 && ret.indexOf("<TopBar />") < ret.indexOf("<Tabs"));
ok("…and only once in the whole app", [..."app src".split(" ").flatMap((d) => walk(d))].map((f) => (read(f).match(/<TopBar \/>/g) || []).length).reduce((a, b) => a + b, 0) === 1);
function walk(d: string): string[] { return readdirSync(join(root, d)).flatMap((x) => { const p = join(d, x); return statSync(join(root, p)).isDirectory() ? walk(p) : /\.tsx$/.test(x) ? [p] : []; }); }
ok("the bar holds the 4D Ages wordmark (top-left) and the child switcher", /WORDMARKS\[t\.key\]/.test(topBarFn) && /accessibilityLabel=\{APP_NAME\}/.test(topBarFn) && /kids\.map/.test(topBarFn) && /setActive/.test(topBarFn) && /Add a child/.test(topBarFn));
ok("the bar respects the phone's top inset itself (the pages no longer do)", /insets\.top/.test(topBarFn) && /useSafeAreaInsets/.test(screen));
ok("each tab's page no longer contains the brand row, the child switcher or a sticky header", !/kids\.map|setActive|stickyHeaderIndices|wordmark|APP_NAME/.test(screenFn));
ok("the status bar is set once, in the layout, not per page", /<StatusBar /.test(layout) && !/<StatusBar /.test(screen));

// ---- the profile card is Home-only
ok("the profile card (name, picture, counts) is drawn only when a page asks for it (`hero`)", /\{hero \? <Hero \/> : null\}/.test(screenFn) && (screen.match(/<Hero \/>/g) || []).length === 1);
const tabs = ["index", "milestones", "growth", "family", "book", "add"];
const withHero = tabs.filter((t) => /<Screen hero>/.test(read(`app/(tabs)/${t}.tsx`)));
ok("only Home asks for it (" + withHero.join(",") + ")", withHero.length === 1 && withHero[0] === "index");
ok("every tab still uses the shared page (so scrolling, padding and the welcome screen are consistent)", tabs.every((t) => /<Screen( hero)?>/.test(read(`app/(tabs)/${t}.tsx`))));

// ---- titles: Home shows the name, the others have their own
// only the title expression of each heading counts (a sentence of description may mention the child naturally)
const titlesOf = (t: string) => {
  const src = read(`app/(tabs)/${t}.tsx`), out: string[] = [];
  for (const m of src.matchAll(/<Heading title=(\{`[^`]*`\}|"[^"]*"|\{[^}]*\})/g)) out.push(m[1]);
  for (const m of src.matchAll(/\btitle: ("[^"]*"|`[^`]*`)/g)) out.push(m[1]);
  return out;
};
const others = tabs.filter((t) => t !== "index");
ok("the title finder really sees the titles (so a pass means something)", others.every((t) => titlesOf(t).length > 0) && titlesOf("milestones").length === 3);
const withName = others.flatMap((t) => titlesOf(t).filter((x) => /child\.name|\$\{child/.test(x)).map((x) => `${t}: ${x}`));
ok("no other tab puts the child's name in its title" + (withName.length ? " — found " + withName[0] : ""), withName.length === 0);
ok("Home keeps “<Name>'s Story” as its title", /\{child\.name\}'s Story/.test(read("app/(tabs)/index.tsx")));
const want: Record<string, RegExp> = { milestones: /title: "Milestones"/, growth: /<Heading title="Growth"/, family: /<Heading title="Family"/, book: /<Heading title="Keepsake book"/, add: /<Heading title="Bring their moments in"/ };
ok("each other tab has a plain title of its own (Milestones, Growth, Family, Keepsake book, Bring their moments in)", Object.entries(want).every(([t, re]) => re.test(read(`app/(tabs)/${t}.tsx`))));
ok("Firsts and Lasts (inside the Milestones tab) are titled plainly too", /firsts: \{ title: "Firsts"/.test(read("app/(tabs)/milestones.tsx")) && /lasts: \{ title: "Lasts"/.test(read("app/(tabs)/milestones.tsx")));
console.log(fails ? `${fails} FAILED` : "all top-bar layout tests passed");
