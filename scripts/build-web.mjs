// Builds the website into dist/ (for Cloudflare Pages): the app itself, from the same code as the phone app, plus the plain pages that
// live beside it (privacy policy, terms, deleting an account, and the short invite link page /j/), taken from docs/ so there's one copy.
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";

execSync("npx expo export --platform web --output-dir dist", { stdio: "inherit" });
for (const page of ["privacy", "terms", "accessibility", "licences", "delete-account", "j", "img", "site.css"]) {
  if (existsSync(`docs/${page}`)) cpSync(`docs/${page}`, `dist/${page}`, { recursive: true });
}
// the invite card's picture comes from this site when it's on its own domain
const j = "dist/j/index.html";
if (existsSync(j)) writeFileSync(j, readFileSync(j, "utf8").replace(/https:\/\/aloncohen41\.github\.io\/4d_ages\/img\//g, "/img/"));
// the contact address on the legal pages (set CONTACT_EMAIL where the site is built, e.g. in Cloudflare's settings)
const contact = (process.env.CONTACT_EMAIL || "").trim();
for (const page of ["privacy", "terms", "accessibility"]) {
  const f = `dist/${page}/index.html`;
  if (!existsSync(f)) continue;
  if (contact) writeFileSync(f, readFileSync(f, "utf8").replaceAll("__CONTACT_EMAIL__", contact));
}
if (!contact) console.warn("[4D Ages] CONTACT_EMAIL isn't set: the legal pages still show __CONTACT_EMAIL__. Set it before going live.");
console.log("Website built in dist/");
