/*
 * The legal side, in the app and on the website: a full privacy policy, terms, an accessibility statement and licences; agreeing to them
 * (and consenting to keeping health information) before using an account; reaching them from the sign-in page and Settings; and the
 * rights the policy promises (download a copy, delete) really being there.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LEGAL_VERSION, agreementNow, agreementOf, needsAgreement } from "../src/lib/consent";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
const text = (f: string) => read(f).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const privacy = text("docs/privacy/index.html");
ok("the privacy policy says who runs 4D Ages and how to reach them", /data controller/.test(privacy) && /United Kingdom/.test(privacy) && /__CONTACT_EMAIL__|@/.test(privacy));
ok("…what is kept, why, and the legal reason for each (contract, consent, legitimate interest)", /What we keep/.test(privacy) && /the contract/.test(privacy) && /explicit consent/.test(privacy) && /legitimate interest/.test(privacy));
ok("…that health information is only kept with explicit consent, which can be withdrawn", /health information/i.test(privacy) && /withdraw that consent/.test(privacy));
ok("…children: for adults, and a child's information is added and controlled by their parent", /18 or over/.test(privacy) && /parent or guardian/.test(privacy));
ok("…every service that receives information, and transfers abroad", ["Supabase", "Cloudflare", "Google", "GitHub", "Nominatim", "OpenFreeMap"].every((s) => privacy.includes(s)) && /standard contract clauses/.test(privacy));
ok("…how long things are kept, storage on the device (no tracking cookies), and security", /How long we keep it/.test(privacy) && /30 days/.test(privacy) && /service worker/.test(privacy) && /don't use advertising or analytics cookies/.test(privacy) && /encrypted/.test(privacy));
ok("…the rights (see, download, correct, delete, withdraw, object), one month to reply, and complaining to the ICO", /download a copy/.test(privacy) && /correct/.test(privacy) && /object/.test(privacy) && /within one month/.test(privacy) && /ico\.org\.uk/.test(privacy) && /United States/.test(privacy));
ok("…no selling, no advertising, no profiling, no AI training", /never sell/.test(privacy) && /don't profile you/.test(privacy) && /artificial intelligence/.test(privacy));
ok("…and the in-app wording it points to is the app's own", privacy.includes("Remove my data and delete my account") && read("app/settings.tsx").includes("Remove my data and delete my account") && privacy.includes("Download a copy of my data") && read("app/settings.tsx").includes("Download a copy of my data"));

const terms = text("docs/terms/index.html");
ok("the terms: who can use it (18+), your content stays yours, fair use, health disclaimer, liability, ending, changes, the law (England and Wales)", /18 or over/.test(terms) && /stays yours/.test(terms) && /Using 4D Ages fairly/.test(terms) && /not medical advice/.test(terms) && /death or personal injury/.test(terms) && /delete your account at any time/.test(terms) && /Changes to these terms/.test(terms) && /England and Wales/.test(terms) && /local consumer law/.test(terms));
ok("an accessibility statement (WCAG 2.2 AA), with what isn't perfect and how to tell us", existsSync(join(__dirname, "..", "docs/accessibility/index.html")) && /WCAG\) 2\.2 at level AA/.test(text("docs/accessibility/index.html")) && /isn't perfect yet/.test(text("docs/accessibility/index.html")));
ok("licences for the software, fonts, maps and music", /MIT licence/.test(text("docs/licences/index.html")) && /BSD 3-Clause/.test(text("docs/licences/index.html")) && /SIL Open Font License/.test(text("docs/licences/index.html")) && /OpenStreetMap contributors/.test(text("docs/licences/index.html")) && /CC0/.test(text("docs/licences/index.html")));

// agreeing
const at = "2026-10-15T10:00:00.000Z";
const session = (legal?: unknown) => ({ user: { user_metadata: legal ? { legal } : {} } }) as never;
ok("an account must agree to the current terms, and to keeping health information", needsAgreement(session()) && needsAgreement(session({ version: LEGAL_VERSION - 1, at, health: true })) && needsAgreement(session({ version: LEGAL_VERSION, at, health: false })) && !needsAgreement(session({ version: LEGAL_VERSION, at, health: true })) && !needsAgreement(null));
ok("the agreement is kept with the account, with its date and version", agreementNow(new Date(at)).at === at && agreementNow().version === LEGAL_VERSION && agreementOf(session(agreementNow()))?.health === true);
const login = read("app/login.tsx");
ok("creating an account asks for both (18+ and the terms; health information), and keeps them with the account", /setAgreeTerms/.test(login) && /setAgreeHealth/.test(login) && /Tick both boxes to create your account\./.test(login) && /data: \{ legal: agreementNow\(\) \}/.test(read("src/lib/supabase.ts")));
ok("everyone else (Google, accounts from before) is asked once before going on, or can sign out", /Agree and continue/.test(read("src/components/AgreementGate.tsx")) && /needsAgreement\(session\)/.test(read("src/components/AgreementGate.tsx")) && /<AgreementGate \/>/.test(read("app/_layout.tsx")));
ok("the sign-in page links the terms, the privacy policy and accessibility", /<LegalLinks \/>/.test(login) && /TERMS_URL/.test(read("src/components/LegalLinks.tsx")) && /PRIVACY_URL/.test(read("src/components/LegalLinks.tsx")) && /ACCESSIBILITY_URL/.test(read("src/components/LegalLinks.tsx")));
const settings = read("app/settings.tsx");
ok("Settings: privacy, terms, accessibility, licences, contact, download a copy, delete the account", ["PRIVACY_URL", "TERMS_URL", "ACCESSIBILITY_URL", "LICENCES_URL", "CONTACT_EMAIL", "<DownloadMyData />", "Remove my data and delete my account"].every((x) => settings.includes(x)));
ok("the copy of your data holds the books (as readable data), the files on the device, and a note", /\$\{APP_NAME\} data\.json/.test(read("src/lib/dataExport.ts")) && /media\/\$\{baseName\(uri\)\}/.test(read("src/lib/dataExport.ts")) && /README\.txt/.test(read("src/lib/dataExport.ts")));
ok("the website carries the same pages, with the contact address filled in when it's built", ["privacy", "terms", "accessibility", "licences", "delete-account"].every((p) => read("scripts/build-web.mjs").includes(`"${p}"`)) && /replaceAll\("__CONTACT_EMAIL__", contact\)/.test(read("scripts/build-web.mjs")));

console.log(fails ? `${fails} FAILED` : "all legal tests passed");
if (fails) process.exit(1);
