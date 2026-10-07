#!/usr/bin/env node
/*
 * Sets the app's next version everywhere it is written:  npm run release:bump  (or: make bump)
 *
 *   npm run release:bump              1.0.0 → 1.0.1   (patch, the default)
 *   npm run release:bump -- minor     1.0.0 → 1.1.0
 *   npm run release:bump -- major     1.0.0 → 2.0.0
 *   npm run release:bump -- 1.4.2     exactly that version
 *
 * The version lives in app.json (what Android shows), src/brand.ts (the About card), package.json and package-lock.json; `npm test` fails
 * when the first two disagree, and the Release workflow refuses a tag that doesn't match app.json. It only edits the files: nothing is
 * committed, tagged or pushed (`make release` does that).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^\d+\.\d+\.\d+$/;

/** "1.2.3" + "minor" → "1.3.0";  + "2.0.0" → "2.0.0";  anything else → null. */
export function nextVersion(current, how = "patch") {
  if (SEMVER.test(how)) return how;
  const [major, minor, patch] = current.split(".").map(Number);
  if (how === "major") return `${major + 1}.0.0`;
  if (how === "minor") return `${major}.${minor + 1}.0`;
  if (how === "patch") return `${major}.${minor}.${patch + 1}`;
  return null;
}

/** Each place the version is written: the file, and the text around it (the files keep their own layout, so only the number changes). */
const PLACES = (v) => [
  ["app.json", /("slug": "[^"]*",\s*"scheme": "[^"]*",\s*"version": ")[^"]*(")/, 1],
  ["src/brand.ts", /(export const APP_VERSION = ")[^"]*(")/, 1],
  ["package.json", /(^\{\s*"name": "[^"]*",\s*"version": ")[^"]*(")/, 1],
  ["package-lock.json", /("name": "4d-ages",\s*"version": ")[^"]*(")/g, 2],
].map(([file, pattern, times]) => ({ file, pattern, times, to: `$1${v}$2` }));

function main() {
  const current = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo.version;
  const next = SEMVER.test(current) ? nextVersion(current, process.argv[2]) : null;
  if (!next) {
    console.error(`✗ Say how to bump ${current}: patch, minor, major, or a version like 1.4.2.`);
    process.exit(1);
  }
  const edits = PLACES(next).map((p) => {
    const before = readFileSync(join(root, p.file), "utf8");
    const found = (before.match(p.pattern) || []).length;
    // A global pattern's match() lists every hit; a single one returns the hit and its groups.
    const hits = p.pattern.global ? found : found ? 1 : 0;
    if (hits !== p.times) {
      console.error(`✗ Expected the version ${p.times} time(s) in ${p.file}, found it ${hits}. Nothing was changed.`);
      process.exit(1);
    }
    return { file: p.file, after: before.replace(p.pattern, p.to) };
  });
  edits.forEach((e) => writeFileSync(join(root, e.file), e.after));
  console.log(`✓ Version ${current} → ${next}  (${edits.map((e) => e.file).join(", ")})\n  Next: make release   — or by hand: commit, then  git tag v${next} && git push origin main v${next}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
