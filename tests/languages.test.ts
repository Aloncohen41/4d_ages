/*
 * Languages: English and Hebrew. Every word on screen goes through tr(), and every one of them has its Hebrew; dates and ages read the
 * Hebrew way; the lists translate when read; Settings has the choice; Hebrew lays everything out right to left (the app, the website,
 * the book); the tab pager still slides the right way.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { he } from "../src/locales/he";
import { LANGS, localized, resolveLang, setLang, tr, wordList } from "../src/lib/i18n";
import { ageLong, ageShort, formatDate, smartAge } from "../src/lib/date";
import { FOODS } from "../src/lib/foods";
import { KINS } from "../src/lib/kinship";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const walk = (d: string): string[] => readdirSync(join(root, d)).flatMap((f) => (statSync(join(root, d, f)).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
const code = [...walk("app"), ...walk("src")].filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("locales"));

// every tr("…") in the code has its Hebrew
const missing: string[] = [];
for (const f of code) {
  for (const m of read(f).matchAll(/\btr\(("(?:[^"\\]|\\.)*")/g)) {
    const english = JSON.parse(m[1]) as string;
    if (/[A-Za-z]/.test(english) && !(english in he)) missing.push(`${f}: ${english}`);
  }
}
ok(`every word sent to tr() has its Hebrew${missing.length ? ` (missing: ${missing.slice(0, 5).join(" | ")})` : ""}`, missing.length === 0);
// a value may be left out only where the English uses it as a word's ending (photo{1} → photos, {0}{1} → 1st), which Hebrew says in the word
const lost = Object.entries(he).flatMap(([en, h]) => (en.match(/\{\d+\}/g) ?? []).filter((p) => !h.includes(p) && !new RegExp(`[A-Za-z}]\\${p.replace("}", "\\}")}`).test(en) && en !== "Your {0} year with us").map((p) => `${p} in "${en}"`));
ok(`the Hebrew keeps every value of its English, except English word endings${lost.length ? ` (lost: ${lost.slice(0, 3).join(" | ")})` : ""}`, lost.length === 0);

setLang("he");
ok("tr(): the Hebrew, with the values filled in; English for anything not translated", tr("{0}'s family", ["מאיה"]) === "המשפחה של מאיה" && tr("Something brand new") === "Something brand new");
ok("dates and ages the Hebrew way (שנתיים, חודש אחד…), for a boy or a girl alike", formatDate("2025-03-05") === "5 במרץ 2025" && ageLong("2024-09-15", "2026-10-17") === "שנתיים, חודש אחד ויומיים" && ageShort("2026-06-15", "2026-10-17") === "4 חודשים" && smartAge("2024-09-15", "2026-10-17").unit === "שנים");
ok("the built-in lists are read in Hebrew (foods, relationships, word lists)", FOODS.find((f) => f.id === "egg")!.name === "ביצה" && KINS[0].label === "הורה" && wordList(["Sunday", "Monday"]).join(",") === "ראשון,שני" && localized([{ label: "Save" }], ["label"])[0].label === "שמירה");
setLang("en");
ok("…and in English when that's the language", FOODS.find((f) => f.id === "egg")!.name === "Egg" && ageLong("2024-09-15", "2026-10-17") === "2 years, 1 month, 2 days");

ok("English and עברית, Hebrew right to left; the phone's language when there's a translation", LANGS.map((l) => l.id).join() === "en,he" && LANGS[1].rtl && resolveLang("he") === "he" && resolveLang("en") === "en");
const settings = read("app/settings.tsx"), layout = read("app/_layout.tsx");
ok("Settings → Language: same as the phone (or browser), English, עברית; the website reloads, the phone offers to close", /<Section title=\{tr\("Language"\)\}>/.test(settings) && /window\.location\.reload\(\)/.test(settings) && /BackHandler\.exitApp\(\)/.test(settings) && /language: "system"/.test(read("src/lib/store.ts")));
ok("the language and direction are set before anything is drawn: the phone's layout (I18nManager) and the website's (dir)", /applyLanguage\(resolveLang\(language\)\)/.test(layout) && /I18nManager\.forceRTL\(rtl\)/.test(layout) && /document\.documentElement\.dir = rtl \? "rtl" : "ltr"/.test(layout));
ok("a Hebrew book reads right to left too", /isRTL\(\) \? ' dir="rtl" lang="he"'/.test(read("src/lib/bookHtml.ts")));
ok("the tab pager always slides left to right, each page in the language's direction", /style=\{\{ direction: "ltr" \}\}/.test(read("app/(tabs)/_layout.tsx")) && /direction: isRTL\(\) \? "rtl" : "ltr"/.test(read("app/(tabs)/_layout.tsx")));

console.log(fails ? `${fails} FAILED` : "all language tests passed");
if (fails) process.exit(1);
