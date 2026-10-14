// Builds the website into dist/ (for Cloudflare Pages): the app itself, from the same code as the phone app, plus the plain pages that
// live beside it (privacy policy, terms, deleting an account, and the short invite link page /j/), taken from docs/ so there's one copy.
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";

execSync("npx expo export --platform web --output-dir dist", { stdio: "inherit" });
for (const page of ["privacy", "terms", "delete-account", "j", "img", "site.css"]) {
  if (existsSync(`docs/${page}`)) cpSync(`docs/${page}`, `dist/${page}`, { recursive: true });
}
// the invite card's picture comes from this site when it's on its own domain
const j = "dist/j/index.html";
if (existsSync(j)) writeFileSync(j, readFileSync(j, "utf8").replace(/https:\/\/aloncohen41\.github\.io\/4d_ages\/img\//g, "/img/"));
console.log("Website built in dist/");
