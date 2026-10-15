// Builds the website into dist/: the app itself, from the same code as the phone app, with the plain pages that live beside it in public/
// (privacy policy, terms, accessibility, licences, deleting an account, and the invite link page /j/). Expo copies public/ as it is.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

execSync("npx expo export --platform web --output-dir dist", { stdio: "inherit" });

// Expo puts the fonts and pictures that come from libraries (the icons, the display font) under dist/assets/node_modules/, but Cloudflare
// Pages never serves a folder named node_modules: every icon and font would come back as the web page instead. They move to
// dist/assets/vendor/, and every mention of the old place is changed to match.
const from = "dist/assets/node_modules";
if (existsSync(from)) {
  renameSync(from, "dist/assets/vendor");
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  let changed = 0;
  const renamed = [];
  for (const f of walk("dist").filter((f) => /\.(js|html|json|css)$/.test(f))) {
    const s = readFileSync(f, "utf8");
    if (!s.includes("assets/node_modules/")) continue;
    const next = s.split("assets/node_modules/").join("assets/vendor/");
    writeFileSync(f, next);
    changed++;
    // the app's code is kept by browsers for a year under its name (see public/_headers), so a changed file needs a new name too
    if (f.startsWith(join("dist", "_expo"))) {
      const name = f.split(/[\\/]/).pop();
      const fresh = name.replace(/\.js$/, `-${createHash("sha1").update(next).digest("hex").slice(0, 8)}.js`);
      renameSync(f, join(f, "..", fresh));
      renamed.push([name, fresh]);
    }
  }
  for (const f of walk("dist").filter((f) => /\.(html|json|js)$/.test(f))) {
    let s = readFileSync(f, "utf8");
    let touched = false;
    for (const [a, b] of renamed) if (s.includes(a)) { s = s.split(a).join(b); touched = true; }
    if (touched) writeFileSync(f, s);
  }
  console.log(`Library fonts and pictures moved to assets/vendor/ (${changed} file${changed === 1 ? "" : "s"} updated${renamed.length ? `, ${renamed.map(([, b]) => b).join(", ")}` : ""})`);
}
console.log("Website built in dist/");
