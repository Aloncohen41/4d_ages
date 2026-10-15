// Builds the website into dist/: the app itself, from the same code as the phone app, with the plain pages that live beside it in public/
// (privacy policy, terms, accessibility, licences, deleting an account, and the invite link page /j/). Expo copies public/ as it is.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

execSync("npx expo export --platform web --output-dir dist", { stdio: "inherit" });

// Expo puts the fonts and pictures that come from libraries (the icons, the display font) under dist/assets/node_modules/, but Cloudflare
// Pages never serves a folder named node_modules: every icon and font would come back as the web page instead. They move to
// dist/assets/vendor/, and every mention of the old place is changed to match.
const from = "dist/assets/node_modules";
if (existsSync(from)) {
  renameSync(from, "dist/assets/vendor");
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  let changed = 0;
  for (const f of walk("dist").filter((f) => /\.(js|html|json|css)$/.test(f))) {
    const s = readFileSync(f, "utf8");
    if (!s.includes("assets/node_modules/")) continue;
    writeFileSync(f, s.split("assets/node_modules/").join("assets/vendor/"));
    changed++;
  }
  console.log(`Library fonts and pictures moved to assets/vendor/ (${changed} file${changed === 1 ? "" : "s"} updated)`);
}
console.log("Website built in dist/");
