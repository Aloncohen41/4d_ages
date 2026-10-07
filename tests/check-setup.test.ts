/*
 * "Is this project ready to build?" â€” the check that runs before `npm run android`, and the fixes behind the failures seen when building on Windows:
 * libraries missing because `npm run setup` was skipped, an invalid link scheme, picture files that didn't come across, and noisy warnings.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

(async () => {
  const m = await import("../scripts/check-setup.mjs");

  // ---------- reading imports
  ok("a package name is found inside any import form: plain, scoped, sub-path, require, dynamic", ["react-native", "@expo/vector-icons", "expo-router", "zustand", "pg"].every((n) => [...m.importedPackages('import A from "react-native"; import { x } from "@expo/vector-icons/MaterialCommunityIcons"; import "expo-router/entry"; const z = require("zustand"); const p = await import("pg");')].includes(n)));
  ok("local files, node built-ins, aliases and ordinary text are not packages", [...m.importedPackages('import a from "./a"; import b from "../../b"; import c from "node:fs"; import d from "fs"; import e from "@/x"; // from "tonal palettes"')].length === 0);
  ok("type-only imports are ignored (they vanish when the app is built)", [...m.importedPackages('import type { T } from "@react-navigation/native";\nexport type { U } from "some-types";\nimport { real } from "expo-image";')].join() === "expo-image");

  // ---------- what THIS project needs: the very packages that were missing in the build log
  const need: string[] = m.requiredPackages(root);
  const fromTheLog = ["expo-router", "expo-splash-screen", "expo-image-picker", "expo-notifications", "expo-image", "react-native-safe-area-context"];
  ok("it requires every package the build log reported missing: " + fromTheLog.join(", "), fromTheLog.every((n) => need.includes(n)));
  ok("â€¦and the libraries those need (the tab bar's pager and tab view, the router's screens and linking), which are never imported directly", ["react-native-pager-view", "react-native-tab-view", "react-native-screens", "expo-linking", "expo-constants"].every((n) => need.includes(n)));
  ok("â€¦and the app's entry point and the plugins listed in app.json", need.includes("expo-router") && need.includes("expo-splash-screen"));

  // ---------- DRIFT GUARD: nothing the code imports can be left out of the install
  const pkg = JSON.parse(read("package.json"));
  const setupList = pkg.scripts.setup.split("&&")[0].replace(/^\s*expo install\s+/, "").split(/\s+/).filter(Boolean);
  const covered = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies), ...setupList]);
  const gaps = need.filter((n) => !covered.has(n));
  ok("every package the app needs is installed by `npm install` or `npm run setup` â€” nothing falls between the two" + (gaps.length ? " â€” NOT covered: " + gaps.join(", ") : ""), gaps.length === 0);
  ok("setup also installs what Expo's router and the forced-light theme need (react-dom, reanimated, worklets, system-ui)", ["react-dom", "react-native-reanimated", "react-native-worklets", "expo-system-ui"].every((n) => setupList.includes(n)));

  // ---------- picture files
  const files: string[] = m.referencedFiles(root);
  ok("it knows every picture the app needs: the icon, splash, adaptive and notification icons AND the wordmark loaded by the code", ["./assets/icon.png", "./assets/splash-icon.png", "./assets/adaptive-icon.png", "./assets/adaptive-icon-monochrome.png", "./assets/notification-icon.png", "./assets/4d-ages-wordmark.png"].every((f) => files.includes(f)));
  const real = m.findProblems(root, () => true);
  ok("this project, with its packages installed, has no problems at all (pictures present, scheme and app id valid)", real.packages.length === 0 && real.files.length === 0 && real.values.length === 0);

  // ---------- what it reports
  const noPackages = m.findProblems(root, () => false);
  ok("with nothing installed it lists everything missing, and says to run `npm run setup`", noPackages.packages.length === need.length && m.describeProblems(noPackages).join("\n").includes("npm run setup"));
  const noPics = m.findProblems(root, () => true, () => false);
  ok("missing pictures are reported by name, with what to do (unzip again or run the asset script)", noPics.files.length === files.length && /Unzip the project again/.test(m.describeProblems(noPics).join("")) && /brand:assets/.test(m.describeProblems(noPics).join("")));
  const tmp = mkdtempSync(join(tmpdir(), "chk-"));
  const withApp = (expo: object) => { writeFileSync(join(tmp, "app.json"), JSON.stringify({ expo })); return m.findProblems(tmp, () => true, () => true).values; };
  ok("an invalid link scheme (â€œ4dagesâ€, which starts with a digit) is caught and explained", withApp({ scheme: "4dages" }).length === 1 && /must start with a letter/.test(withApp({ scheme: "4dages" })[0]) && withApp({ scheme: "fourdages" }).length === 0);
  ok("an invalid Android app id (a part starting with a digit) is caught", withApp({ android: { package: "com.alonc.4dages" } }).length === 1 && withApp({ android: { package: "com.alonc.fourdages" } }).length === 0);

  // ---------- the real script, as npm runs it
  const proj = join(tmp, "proj"); mkdirSync(join(proj, "scripts"), { recursive: true }); mkdirSync(join(proj, "src"), { recursive: true }); mkdirSync(join(proj, "assets"), { recursive: true });
  cpSync(join(root, "scripts", "check-setup.mjs"), join(proj, "scripts", "check-setup.mjs"));
  writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "x", main: "expo-router/entry" }));
  writeFileSync(join(proj, "app.json"), JSON.stringify({ expo: { scheme: "fourdages", icon: "./assets/icon.png", plugins: ["expo-splash-screen"] } }));
  writeFileSync(join(proj, "src", "a.ts"), 'import { x } from "left-pad-lib"; export const w = require("../assets/logo.png");');
  const run = (env: Record<string, string> = {}) => spawnSync(process.execPath, ["scripts/check-setup.mjs"], { cwd: proj, encoding: "utf8", env: { ...process.env, ...env } });
  const r1 = run();
  ok("run for real in a project with gaps: it stops (exit 1) and names the missing packages and pictures in plain words", r1.status === 1 && /left-pad-lib/.test(r1.stderr) && /expo-router/.test(r1.stderr) && /expo-splash-screen/.test(r1.stderr) && /icon\.png/.test(r1.stderr) && /logo\.png/.test(r1.stderr) && /npm run setup/.test(r1.stderr));
  ok("â€¦and says how to skip the check once", /SKIP_SETUP_CHECK/.test(r1.stderr) && run({ SKIP_SETUP_CHECK: "1" }).status === 0);
  // expo-router needs its companion libraries too, so the fake project gets them as well
  for (const n of ["left-pad-lib", "expo-router", "expo-splash-screen", ...m.COMPANIONS["expo-router"]]) { mkdirSync(join(proj, "node_modules", n), { recursive: true }); writeFileSync(join(proj, "node_modules", n, "package.json"), "{}"); }
  writeFileSync(join(proj, "assets", "icon.png"), "x"); writeFileSync(join(proj, "assets", "logo.png"), "x");
  const r2 = run();
  ok("once everything is there it passes (exit 0) with a one-line confirmation", r2.status === 0 && /everything the app needs is in place/.test(r2.stdout));
  rmSync(tmp, { recursive: true, force: true });

  // ---------- wiring
  const s = pkg.scripts;
  ok("the check runs by itself before start, android and android:sync (and on request: npm run check) â€” but not before setup", ["prestart", "preandroid", "preandroid:sync", "check"].every((k) => s[k] === "node scripts/check-setup.mjs") && !s.presetup);
  ok(".npmrc relaxes the react / react-dom peer conflict, so plain `npm install` and `npx expo install` work without flags", /^legacy-peer-deps=true$/m.test(read(".npmrc")));
  const app = JSON.parse(read("app.json")).expo;
  ok("the link scheme is fourdages (valid), matching what the development link now uses", app.scheme === "fourdages");

  // ---------- the repeated warning
  const { build } = require("../plugins/supabaseEnv");
  const seen: string[] = []; const original = console.warn; console.warn = (...a: unknown[]) => { seen.push(a.join(" ")); };
  try { for (let i = 0; i < 6; i++) build({}, { SUPABASE_SECRET_KEY: "sb_secret_abc" }); } finally { console.warn = original; }
  ok("the secret-key notice is printed once per run, not once per config read (it appeared ~40 times in one build)", seen.length === 1 && /SECRET key/.test(seen[0]));
  ok("â€¦and it is plain ASCII, so a Windows console can't garble the dash (â€œÎ“Ã‡Ã¶â€)", /^[\x20-\x7e]*$/.test(seen[0]));
  console.log(fails ? `${fails} FAILED` : "all setup-check tests passed");
  process.exit(fails ? 1 : 0);
})();

