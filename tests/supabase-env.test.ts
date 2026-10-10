/* Only the two PUBLIC Supabase values can reach the app: a secret key and the database connection string never can. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const { classifyKey, projectUrl, pickSupabase, build } = require("../plugins/supabaseEnv");
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

// fake keys, made the way Supabase makes them
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (role: string) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase", ref: "abcdefghijklmnop", role, iat: 1, exp: 2 })}.signature-part-123`;
const PUB = "sb_publishable_AbCdEf1234567890_xyz", SECRET = "sb_secret_TOP-SECRET-VALUE-9876543210";
const DB = "postgresql://postgres:s3cr3t-DB-pass@db.abcdefghijklmnop.supabase.co:5432/postgres";

// ---------- telling the keys apart
ok("a new-style publishable key is public", classifyKey(PUB) === "publishable");
ok("a new-style secret key is secret", classifyKey(SECRET) === "secret");
ok("an older anon key (a JWT with role â€œanonâ€) is public", classifyKey(jwt("anon")) === "publishable");
ok("an older service_role key (role â€œservice_roleâ€) is secret", classifyKey(jwt("service_role")) === "secret");
ok("anything else is unknown â€” a user token, text, the database string, nothing", ["authenticated"].every((r) => classifyKey(jwt(r)) === "unknown") && ["", "hello", DB, "a.b.c", "x.y", undefined, null, 42].every((v) => classifyKey(v as any) === "unknown"));
ok("extra spaces or capitals don't hide a secret key", classifyKey("  SB_SECRET_abc  ") === "secret" && classifyKey(`  ${jwt("service_role")}\n`) === "secret");

// ---------- the project URL
ok("a project URL is recognised and tidied (no path, no trailing slash, lower case)", projectUrl("https://AbCdEfGh1234.supabase.co/") === "https://abcdefgh1234.supabase.co" && projectUrl("https://abcdefgh1234.supabase.co/rest/v1/") === "https://abcdefgh1234.supabase.co");
ok("a database address, another website, a dashboard link or plain text is NOT a project URL", [DB, "https://supabase.com/dashboard/project/abcd", "https://example.com", "http://abcdefgh1234.supabase.co", "abcdefgh1234.supabase.co", "", undefined].every((v) => projectUrl(v as any) === ""));

// ---------- picking from an environment, whatever the variables are called
const everything = { supabase_url: "https://abcdefghijklmnop.supabase.co", supabase_publishablekey: PUB, supabase_secretkey: SECRET, supabase_db_connection_string: DB, PATH: "/usr/bin", HOME: "/home/me" };
const a = pickSupabase(everything);
ok("with a typical .env (URL, publishable key, secret key, connection string) it takes exactly the URL and the publishable key", a.url === "https://abcdefghijklmnop.supabase.co" && a.key === PUB && a.urlFrom === "supabase_url" && a.keyFrom === "supabase_publishablekey");
ok("â€¦and notes that a secret key was seen and skipped", a.secretSeen === true);
const result = build({ name: "4D Ages", extra: { eas: { projectId: "p" } } }, everything, () => undefined);
const dump = JSON.stringify(result);
ok("what is built into the app contains the URL and publishable key and NOTHING of the secret key or the connection string", dump.includes(PUB) && dump.includes("abcdefghijklmnop.supabase.co") && !dump.includes("TOP-SECRET") && !dump.includes("s3cr3t") && !dump.includes("postgresql") && !dump.includes("sb_secret"));
ok("the rest of the app's settings are kept (name, existing extra values)", result.name === "4D Ages" && result.extra.eas.projectId === "p" && result.extra.supabaseUrl === a.url && result.extra.supabaseAnonKey === PUB);
ok("no other environment variable (PATH, HOMEâ€¦) is copied in", !dump.includes("/usr/bin") && !dump.includes("/home/me") && Object.keys(result.extra).sort().join() === "eas,supabaseAnonKey,supabaseUrl");

ok("the EXPO_PUBLIC_ names work", (() => { const r = pickSupabase({ EXPO_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co", EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt("anon") }); return r.url !== "" && r.key === jwt("anon"); })());
ok("only the secret key present â†’ NO key is chosen (the app is simply not set up, never given the secret)", (() => { const r = pickSupabase({ SUPABASE_URL: "https://abcdefghijklmnop.supabase.co", SUPABASE_KEY: SECRET }); return r.key === "" && r.secretSeen && r.url !== ""; })());
ok("an ambiguous name like SUPABASE_KEY is judged by its VALUE: the public one is used, the secret one skipped", pickSupabase({ SUPABASE_KEY: PUB }).key === PUB && pickSupabase({ SUPABASE_KEY: jwt("service_role") }).key === "");
ok("two public keys: the EXPO_PUBLIC_ one wins, deterministically", pickSupabase({ SUPABASE_A_KEY: PUB + "A", EXPO_PUBLIC_SUPABASE_ANON_KEY: PUB + "B" }).key === PUB + "B");
ok("a key held in a variable that doesn't mention Supabase is ignored (no scooping up unrelated tokens)", pickSupabase({ SOME_TOKEN: PUB, SUPABASE_URL: "https://abcdefghijklmnop.supabase.co" }).key === "");
ok("a URL held under any name is found by its shape; a website that isn't Supabase is not", pickSupabase({ API_URL: "https://abcdefghijklmnop.supabase.co" }).url !== "" && pickSupabase({ API_URL: "https://example.com", OTHER: "hello" }).url === "");
ok("a custom domain works if it is named SUPABASE_URL", pickSupabase({ SUPABASE_URL: "https://api.myfamily.example/" }).url === "https://api.myfamily.example");
ok("an empty or missing environment gives empty values, not an error", JSON.stringify(pickSupabase({})) === JSON.stringify({ url: "", key: "", urlFrom: "", keyFrom: "", secretSeen: false }) && build({}, undefined as any, () => undefined).extra.supabaseUrl === "");

// ---------- the build says what it did
const logs: string[] = [];
build({}, { SUPABASE_KEY: SECRET }, (m: string) => logs.push(m));
ok("when a secret key is found the build warns, and the warning never prints the key", logs.length >= 1 && /SECRET key/.test(logs[0]) && !logs.join().includes("TOP-SECRET"));
const logs2: string[] = []; build({}, { SUPABASE_URL: "https://abcdefghijklmnop.supabase.co" }, (m: string) => logs2.push(m)); const logs3: string[] = []; build({}, { SUPABASE_X: PUB }, (m: string) => logs3.push(m));
ok("when only one of the two public values is found it says which one is missing and how to name it", /EXPO_PUBLIC_SUPABASE_ANON_KEY/.test(logs2.join()) && /EXPO_PUBLIC_SUPABASE_URL/.test(logs3.join()));
const quiet: string[] = []; build({}, everything, (m: string) => quiet.push(m)); const quiet2: string[] = []; build({}, { SUPABASE_URL: "https://abcdefghijklmnop.supabase.co", SUPABASE_ANON_KEY: PUB }, (m: string) => quiet2.push(m));
ok("a correct setup is silent", quiet2.length === 0);

// ---------- the wiring
const cfg = read("src/config.ts"), sb = read("src/lib/supabase.ts"), sheet = read("src/components/ShareSheet.tsx");
ok("Expo hands app.json to app.config.js, which adds only the two public values", /require\("\.\/plugins\/supabaseEnv"\)/.test(read("app.config.js")) && /build\(config, process\.env\)/.test(read("app.config.js")));
ok("the app reads the two values from its settings; nothing is pasted into code, and no secret-key variable is referenced", /Constants\.expoConfig\?\.extra/.test(cfg) && /supabaseUrl/.test(cfg) && /supabaseAnonKey/.test(cfg) && !/(SECRET|service_role|CONNECTION_STRING|process\.env)/i.test(cfg.replace(/\/\*[\s\S]*?\*\//g, "")));
ok("the app refuses a secret key even if one got in: sharing is off and the screen says why", /classifyKey\(SUPABASE_ANON_KEY\) === "secret"/.test(sb) && /&& !keyIsSecret/.test(sb) && /keyIsSecret/.test(sheet) && /SECRET key/.test(sheet));
ok(".env is ignored by git (so keys are never committed), but the template is not", /^\.env\*$/m.test(read(".gitignore")) && /^!\.env\.example$/m.test(read(".gitignore")));
const ex = read(".env.example");
ok("the template has placeholders only â€” no real-looking key, and the private values are commented out", !/sb_(secret|publishable)_[A-Za-z0-9]/.test(ex) && !/eyJ/.test(ex) && /^# SUPABASE_SECRET_KEY=/m.test(ex) && /^# SUPABASE_DB_CONNECTION_STRING=/m.test(ex) && /EXPO_PUBLIC_SUPABASE_URL=/.test(ex) && /EXPO_PUBLIC_SUPABASE_ANON_KEY=/.test(ex));
ok("the template warns not to give the private values an EXPO_PUBLIC_ name", /EXPO_PUBLIC_ name/.test(ex));
ok("a local .env is allowed only because it is git-ignored", !existsSync(join(root, ".env")) || /^\.env\*$/m.test(read(".gitignore")));
ok("the docs explain .env, the secret-key rule, and restarting the server", /\.env/.test(read("SHARING.md")) && /never go in the app/i.test(read("SHARING.md")) && /expo start -c/.test(read("SHARING.md")) && /EXPO_PUBLIC_SUPABASE_URL/.test(read("SHARING.md")) && !/paste into `SUPABASE_URL` in `src\/config\.ts`/.test(read("SHARING.md")));

// ---------- no URL given: the project URL is worked out from the PUBLIC project reference in the connection string
const awful = "Zx9%q?7@p#/8:ab-UNIQUE";
const pooled = `postgresql://postgres.abcdefghijklmnop:${awful}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`;
const direct = `postgresql://postgres:${awful}@db.abcdefghijklmnop.supabase.co:5432/postgres`;
ok("the project reference is found in a pooler string (user postgres.<ref>) and a direct string (host db.<ref>.supabase.co), even with % ? @ # / : in the password", [pooled, direct].every((c) => require("../plugins/supabaseEnv").refFromConnectionString(c) === "abcdefghijklmnop"));
const derived = pickSupabase({ supabase_secretkey: SECRET, supabase_db_connection_string: pooled });
ok("with only a secret key and a connection string, the URL is derived and still NO key is chosen", derived.url === "https://abcdefghijklmnop.supabase.co" && derived.key === "" && derived.secretSeen && /connection_string/.test(derived.urlFrom));
const leak = JSON.stringify(build({}, { supabase_secretkey: SECRET, supabase_db_connection_string: pooled }, () => undefined));
ok("the derived URL is all that is used: the password, the connection string and the secret key never reach the app", !leak.includes("UNIQUE") && !leak.includes("Zx9") && !leak.includes("postgres") && !leak.includes("TOP-SECRET"));
ok("an explicit URL always beats a derived one", pickSupabase({ SUPABASE_URL: "https://explicitprojectabc.supabase.co", DB: pooled }).url === "https://explicitprojectabc.supabase.co");
ok("text that isn't a Supabase connection string gives no reference", ["", "hello", "postgresql://user:pw@localhost:5432/db", "mysql://postgres.abcdefghijklmnop:pw@host/db", "postgresql://nopassword"].every((v) => require("../plugins/supabaseEnv").refFromConnectionString(v) === ""));
// ---------- "Continue with Google": the web client ID goes in only when it looks like one
const appConfig = require("../app.config.js");
const google = (v?: string) => { const before = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; if (v === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = v; try { return appConfig({ config: { name: "4D Ages", extra: {} } }).extra.googleWebClientId; } finally { if (before === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = before; } };
ok("a Google web client ID from .env reaches the app's settings", google(" 374884084370-abc123def.apps.googleusercontent.com ") === "374884084370-abc123def.apps.googleusercontent.com");
ok("no ID, or something that isn't a Google client ID (a client secret, a URL), leaves Google sign-in off", [undefined, "", "GOCSPX-secretvalue", "https://example.com"].every((v) => google(v) === undefined));
ok("the Google button only shows when the ID is set, and the client secret file can't be committed", /googleReady \? \(/.test(sheet) && /googleReady = isConfigured && GOOGLE_WEB_CLIENT_ID\.length > 0/.test(sb) && /^client_secret\*\.json$/m.test(read(".gitignore")));

console.log(fails ? `${fails} FAILED` : "all Supabase environment tests passed");

