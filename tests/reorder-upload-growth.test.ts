/*
 * October 2026, third round: profiles in any order (phone and website), sharing into the app when it wasn't open, uploading on the website
 * (a button and drag and drop), tagging people however photos come in, and stepping back through earlier measurements on Growth.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { untr } from "./untr";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => untr(readFileSync(join(__dirname, "..", f), "utf8"));

const store = read("src/lib/store.ts"), screen = read("src/components/Screen.tsx"), site = read("src/components/SiteHeader.tsx");
ok("profiles can be put in any order: moved one place at a time", /moveKid: \(id, by\) =>/.test(store) && /\[kids\[i\], kids\[j\]\] = \[kids\[j\], kids\[i\]\]/.test(store));
ok("…on the phone: a long press makes them wiggle with arrows, and Done", /onLongPress=\{\(\) => setArranging\(true\)\}/.test(screen) && /<Wiggle key=\{k\.id\} on=\{arranging\}/.test(screen) && /moveKid\(k\.id, -1\)/.test(screen) && /export function MoveButton/.test(screen));
ok("…on the website too, with a Change the order button as well", /onLongPress=\{\(\) => setArranging\(true\)\}/.test(site) && /Change the order/.test(site) && /<MoveButton dir=\{1\}/.test(site));

const kt = read("modules/share-intake/android/src/main/java/expo/modules/shareintake/ShareIntakeModule.kt");
ok("sharing in when the app wasn't open: picked up once the screen is up, never taken twice", /OnActivityEntersForeground \{/.test(kt) && /synchronized\(this\) \{\s*if \(!isShare\(intent\)\) return emptyList\(\)/.test(kt));
ok("…anything that arrived before the app was listening is collected, and an empty first read is tried again", /const waiting = mod\.takePending\(\)/.test(read("src/lib/shareIntake.ts")) && /tryRead\(opened \? 6 : 0\)/.test(read("src/components/ShareIntakeListener.tsx")));

const drop = read("src/components/DropArea.web.tsx");
ok("the website: Upload opens a window with a place to drag files onto and a Choose files button; nowhere else on the page takes dropped files", /function UploadSheet/.test(site) && /<DropArea onFiles=\{take\}/.test(site) && /chooseFiles\("image\/\*,video\/\*,audio\/\*", true\)/.test(site) && /filesToItems\(files\)/.test(site) && /source: "picker"/.test(site) && /el\.addEventListener\("drop", drop\)/.test(drop) && !/window\.addEventListener\("drop"/.test(drop) && !/DropZone/.test(read("app/_layout.tsx")));
ok("…a family member's photo takes a dropped picture too, and the site's pictures are never dragged out (moving people in the tree)", /<DropArea onFiles=\{dropPhoto\}/.test(read("src/components/MemberSheet.tsx")) && /tagName === "IMG"\) e\.preventDefault\(\)/.test(read("src/components/AppColumn.web.tsx")) && /-webkit-user-drag: none/.test(read("public/index.html")));
ok("…anything that isn't a photo, video or recording is left out by name", /out\.skipped\.push\(file\.name\)/.test(read("src/lib/shareIntake.web.ts")));
const imp = read("src/components/ImportSheet.tsx");
ok("however photos come in (shared, picked, uploaded, dropped), the new-post screen tags who's in them, on every post it makes", /Who's in it\?/.test(imp) && /<TagPicker key=\{child\.id\} childId=\{child\.id\}/.test(imp) && /tagIds: \[\.\.\.new Set\(\[\.\.\.p\.tagIds, \.\.\.tagIds\]\)\]/.test(imp) && /childId \? kids\.find/.test(read("src/components/TagPicker.tsx")));

const gs = read("src/components/GrowthSummary.tsx");
ok("Growth: the date the numbers are from above them; ◀ goes back through earlier measuring days, ▶ (greyed out at the latest) comes forward", /formatDate\(day\)/.test(gs) && /dir < 0 \? at === 0 : back === 0/.test(gs) && /off \? t\.outline : t\.ink/.test(gs) && /e\.date <= day/.test(gs) && /measured \{0\}|measured \$\{/.test(gs));

console.log(fails ? `${fails} FAILED` : "all reorder-upload-growth tests passed");
if (fails) process.exit(1);
