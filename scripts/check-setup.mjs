#!/usr/bin/env node
/*
 * Is this project ready to build?  Runs by itself before `npm run android`, `npm run android:sync` and `npm start` (and on request: npm run check).
 *
 * It looks at what the app actually needs â€” the packages its code imports, the plugins listed in app.json, the picture files app.json points to â€”
 * and checks they are all there, so a missing piece is reported up front, in plain words, instead of as a stack trace halfway through a 10-minute build.
 * Skip it with  SKIP_SETUP_CHECK=1  if it ever gets in your way.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRS = ["app", "src", "modules", "plugins"];
const ROOT_FILES = ["app.config.js"];

/** Libraries that other libraries need but this app never imports directly (what a missing one looks like: a failure deep inside the other library). */
export const COMPANIONS = {
  "@react-navigation/material-top-tabs": ["react-native-tab-view", "react-native-pager-view"],
  "expo-router": ["react-native-screens", "react-native-safe-area-context", "expo-linking", "expo-constants", "react-native-tab-view", "react-native-pager-view"],
};

/** "@expo/vector-icons/MaterialCommunityIcons" â†’ "@expo/vector-icons";  "./local", "node:fs", text that isn't a package name â†’ null. */
export function packageOf(spec) {
  if (!spec || /^[./~]/.test(spec) || spec.startsWith("node:") || spec.startsWith("@/")) return null;
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  if (builtinModules.includes(name)) return null;
  return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name) ? name : null;
}

/** The packages a piece of source code imports (type-only imports disappear at build time and are ignored). */
export function importedPackages(text) {
  const out = new Set();
  const code = String(text).replace(/^\s*(?:import|export)\s+type\b[^;]*;?\s*$/gm, "");
  for (const m of code.matchAll(/(?:from\s+|import\s+|require\(\s*|import\(\s*)["']([^"']+)["']/g)) {
    const name = packageOf(m[1]);
    if (name) out.add(name);
  }
  return out;
}

function sourceFiles(root) {
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry) && !entry.endsWith(".d.ts")) files.push(p);
    }
  };
  SOURCE_DIRS.forEach((d) => walk(join(root, d)));
  ROOT_FILES.forEach((f) => existsSync(join(root, f)) && files.push(join(root, f)));
  return files;
}

/** Every package the project needs in order to build and run. */
export function requiredPackages(root) {
  const need = new Set();
  for (const f of sourceFiles(root)) importedPackages(readFileSync(f, "utf8")).forEach((n) => need.add(n));
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    const main = packageOf(JSON.parse(readFileSync(pkgPath, "utf8")).main);
    if (main) need.add(main);
  }
  const appPath = join(root, "app.json");
  if (existsSync(appPath)) {
    for (const p of JSON.parse(readFileSync(appPath, "utf8")).expo?.plugins ?? []) {
      const name = packageOf(Array.isArray(p) ? p[0] : p);
      if (name) need.add(name);
    }
  }
  for (const [lib, companions] of Object.entries(COMPANIONS)) if (need.has(lib)) companions.forEach((c) => need.add(c));
  return [...need].sort();
}

/** The picture files the app needs: the ones app.json points to (icon, splash, adaptive iconâ€¦) and the ones the code loads with require("â€¦/assets/â€¦"). */
export function referencedFiles(root) {
  const found = new Set();
  const appPath = join(root, "app.json");
  if (existsSync(appPath)) {
    const walk = (v) => {
      if (typeof v === "string") { if (/^\.\/assets\//.test(v)) found.add(v); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(JSON.parse(readFileSync(appPath, "utf8")));
  }
  for (const f of sourceFiles(root)) {
    for (const m of readFileSync(f, "utf8").matchAll(/require\(\s*["']((?:\.\.?\/)+assets\/[^"']+)["']\s*\)/g)) {
      const abs = resolve(dirname(f), m[1]);
      found.add("./" + abs.slice(root.length + 1).replace(/\\/g, "/"));
    }
  }
  return [...found].sort();
}

/** What is wrong, if anything: { packages, files, values }. `hasPackage` and `hasFile` can be replaced in tests. */
export function findProblems(root, hasPackage = (n) => existsSync(join(root, "node_modules", n, "package.json")), hasFile = (p) => existsSync(join(root, p))) {
  const packages = requiredPackages(root).filter((n) => !hasPackage(n));
  const files = referencedFiles(root).filter((p) => !hasFile(p));
  const values = [];
  const appPath = join(root, "app.json");
  if (existsSync(appPath)) {
    const app = JSON.parse(readFileSync(appPath, "utf8")).expo ?? {};
    if (app.scheme && !/^[a-z][a-z0-9+.-]*$/i.test(app.scheme)) values.push(`The link scheme â€œ${app.scheme}â€ in app.json is invalid: it must start with a letter (try â€œfourdagesâ€). Android can't open the app from the development link otherwise.`);
    const id = app.android?.package;
    if (id && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(id)) values.push(`The Android app id â€œ${id}â€ in app.json is invalid: every part must start with a letter (for example com.alonc.fourdages).`);
  }
  return { packages, files, values };
}

export function describeProblems(p) {
  const lines = [];
  if (p.packages.length) lines.push(`Missing packages (${p.packages.length}): ${p.packages.join(", ")}\n  â†’ Run   npm run setup   once. It installs them at the versions that match Expo.`);
  if (p.files.length) lines.push(`Missing picture files: ${p.files.join(", ")}\n  â†’ Unzip the project again (the assets folder didn't come across), or run   npm run brand:assets   (needs Python with pillow).`);
  for (const v of p.values) lines.push(v);
  return lines;
}

function main() {
  if (process.env.SKIP_SETUP_CHECK) return;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const problems = findProblems(root);
  const lines = describeProblems(problems);
  if (!lines.length) { console.log("âœ“ Setup check: everything the app needs is in place."); return; }
  console.error("\nâœ— This project isn't ready to build yet:\n");
  lines.forEach((l) => console.error("  â€¢ " + l.replace(/\n/g, "\n    ") + "\n"));
  console.error("(To skip this check once: set SKIP_SETUP_CHECK=1.)\n");
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) main();

