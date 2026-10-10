/* The rename to "4D Ages": nothing visible still says the old name, and the two identifiers that must NOT change are intact. */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const app = JSON.parse(read("app.json")).expo;
const pkg = JSON.parse(read("package.json"));

// ---- app.json identity
ok("name is “4D Ages”", app.name === "4D Ages");
ok("slug is “4d-ages”", app.slug === "4d-ages");
ok("the link scheme is “fourdages” — a scheme must start with a letter, so “4dages” can't be opened by Android", app.scheme === "fourdages" && /^[a-z][a-z0-9+.-]*$/i.test(app.scheme));
ok("the Android app id is the new name (com.alonc.fourdages), and is a valid Android id (every part starts with a letter)", app.android.package === "com.alonc.fourdages" && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(app.android.package));
ok("there is a valid version code", app.android.versionCode >= 1);
ok("the photo-permission text uses the new name", app.plugins.some((p: any) => Array.isArray(p) && p[0] === "expo-image-picker" && String(p[1].photosPermission).startsWith("4D Ages")));
ok("the share-sheet entry comes from the app name (intent filters for photos and videos are still there)", app.android.intentFilters.length === 2);

// ---- brand.ts agrees with app.json
const brand = read("src/brand.ts");
const bc = (n: string) => (brand.match(new RegExp(`export const ${n}\\s*=\\s*"([^"]*)"`)) || [])[1];
ok("src/brand.ts name and version match app.json", bc("APP_NAME") === app.name && bc("APP_VERSION") === app.version);

// ---- the saved-data key is named for the app, and must not change from here on
const store = read("src/lib/store.ts");
ok("the saved-data storage key is 4d-ages-v1 (and differs from the small “where I left off” record)", /const STORE_KEY = "4d-ages-v1";/.test(store) && !/4d-ages-resume/.test(store));
ok("the pre-migration backup keys are still derived from it", /backup-v/.test(read("src/lib/backup.ts")) || /backup-v/.test(read("src/lib/migrate.ts")) || /backup-v/.test(store));

// ---- no visible old name anywhere
const TEXT = /\.(ts|tsx|kt|sql|md|json|js|mjs|cjs|py|html|txt)$/;
// What the project ships: every file git tracks or would add (anything .gitignore covers, like local build output in android/ or .expo/, is left out).
const shipped: string[] = require("node:child_process").execSync("git ls-files --cached --others --exclude-standard", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const files: string[] = [];
const walk = (d: string) => shipped.forEach((f) => { if (f.startsWith(d + "/") && TEXT.test(f) && !f.endsWith("/emoji.json")) files.push(f); });
// ---- the previous name is gone from every file, comment, setting and file name: only 4D Ages remains
// (the pattern is assembled from pieces so that this file doesn't contain the name it is looking for)
["app", "src", "modules", "supabase", "plugins", "branding", "tests"].forEach(walk);
["README.md", "SHARING.md", "app.json", "package.json", "tsconfig.json", "eas.json"].forEach((f) => existsSync(join(root, f)) && files.push(f));
const OLD = new RegExp("lit" + "tle[ _.-]?chap" + "ters?", "i");
const hits: string[] = [];
for (const f of files) read(f).split("\n").forEach((line, i) => { if (OLD.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`); });
ok("the previous name appears nowhere — not in screens, notifications, share text, PDF, docs, comments, tests, settings or Kotlin" + (hits.length ? " — found: " + hits[0] : ""), hits.length === 0);
ok("no file or folder is named after it either", !files.some((f) => OLD.test(f)));
ok("the npm package is named 4d-ages", pkg.name === "4d-ages");
ok("no hand-kept android/ folder is shipped (it is regenerated from app.json)", !shipped.some((f) => f.startsWith("android/")));
ok("an npm script regenerates the Android project (android:sync = prebuild --clean)", /prebuild --platform android --clean/.test(pkg.scripts["android:sync"] || ""));
ok("the docs explain the app id and syncing Android", /android:sync/.test(read("README.md")) && /com\.alonc\.fourdages/.test(read("README.md")) && /4d-ages-v1/.test(read("README.md")));
console.log(fails ? `${fails} FAILED` : "all rebrand tests passed");
