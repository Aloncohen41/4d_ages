/*
 * npm run db:setup: reads a Supabase connection string whose password contains characters that break URLs (% ? @ # /), reports it without
 * ever printing the password, and applies the schema. (Everything here uses a made-up password and never touches a network.)
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

(async () => {
  const { parseConnection, describeConnection, findConnectionString, parseEnvText, projectRef, friendlyError } = await import("../scripts/dbConnection.mjs");
  const PW = "Zx9%q?7@p#/8:ab-UNIQUE";
  const pooled = `postgresql://postgres.abcdefghijklmnop:${PW}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`;

  // ---------- the connection string
  const c = parseConnection(pooled);
  ok("a pooler string with % ? @ # / : in the password is read correctly: host, port, user and database come out right", c.host === "aws-1-eu-central-1.pooler.supabase.com" && c.port === 6543 && c.user === "postgres.abcdefghijklmnop" && c.database === "postgres");
  const urlHost = (() => { try { return new URL(pooled).hostname; } catch { return "(refuses to read it)"; } })();
  ok("…and the password is exactly what was written (a normal URL parser gets this wrong: it refuses the string, or takes the user name for the host)", c.password === PW && urlHost !== c.host);
  ok("the project reference is found", projectRef(c) === "abcdefghijklmnop");
  const direct = parseConnection(`postgresql://postgres:${PW}@db.abcdefghijklmnop.supabase.co:5432/postgres`);
  ok("a direct connection string works the same way (host db.<ref>.supabase.co)", direct.host === "db.abcdefghijklmnop.supabase.co" && direct.port === 5432 && direct.user === "postgres" && projectRef(direct) === "abcdefghijklmnop");
  ok("a password that IS percent-encoded is decoded (p%40ss%3Fw → p@ss?w); one that merely contains a % is left alone", parseConnection("postgresql://u:p%40ss%3Fw@h.example:5432/db").password === "p@ss?w" && parseConnection("postgresql://u:p%40ss%3Fw@h.example:5432/db").passwordWasDecoded && parseConnection("postgresql://u:100%yes@h.example/db").password === "100%yes");
  ok("defaults: no port → 5432, no database → postgres; a ?query on the end is ignored", (() => { const x = parseConnection("postgresql://u:pw@h.example"); const y = parseConnection("postgresql://u:pw@h.example:6543/mydb?sslmode=require"); return x.port === 5432 && x.database === "postgres" && y.port === 6543 && y.database === "mydb" && y.host === "h.example"; })());
  ok("plain-English errors for strings that can't be used (not a connection string, no password, the [YOUR-PASSWORD] placeholder, no host part)", [["hello", /start with postgresql/], ["postgresql://u@host/db", /no “user:password@host”|no password/], ["postgresql://u:[YOUR-PASSWORD]@host/db", /placeholder/], ["postgresql://justtext", /user:password@host/]].every(([s, re]: any) => { try { parseConnection(s); return false; } catch (e: any) { return re.test(e.message); } }));
  ok("what may be shown on screen has everything but the password", (() => { const d = describeConnection(c); return !JSON.stringify(d).includes("UNIQUE") && !JSON.stringify(d).includes("Zx9") && d.passwordLength === PW.length && d.specialCharacters === 7 && d.host === c.host; })());

  // ---------- the .env file
  const text = "Zx9%bare-password-on-its-own-line\n\n# a comment\nexport A=1\nB = \"two words\"\nC='x'\nD=value # trailing comment\nsupabase_db_connection_string=" + pooled + "\n";
  const { env, ignored } = parseEnvText(text.replace(/\\n/g, "\n"));
  ok("a .env is read like Node and Expo read it: comments, export, quotes and trailing comments handled", env.A === "1" && env.B === "two words" && env.C === "x" && env.D === "value");
  ok("a line that isn't NAME=VALUE (a password written on its own) is skipped and reported by line number only", ignored.join() === "1" && !JSON.stringify(env).includes("bare-password"));
  ok("the connection string is found by what it is, whatever the variable is called", findConnectionString(env)?.name === "supabase_db_connection_string" && findConnectionString({ X: "hello" }) === null);
  ok("a Windows file (CRLF) and a leading byte-order mark are handled", parseEnvText("\uFEFFA=1\r\nB=2\r\n").env.A === "1" && parseEnvText("A=1\r\nB=2\r\n").env.B === "2");

  // ---------- friendly failures
  ok("a wrong password, a bad pooler user, an unreachable network and a missing host each get a plain-English reason", /rejected the password/.test(friendlyError({ code: "28P01", message: "x" })) && /user name or region/.test(friendlyError({ message: "Tenant or user not found" })) && /IPv6/.test(friendlyError({ code: "ETIMEDOUT", message: "x" })) && /Couldn't find the database host/.test(friendlyError({ code: "ENOTFOUND", message: "x" })));

  // ---------- the whole script, run for real as a dry run (no network, no pg needed)
  const dir = mkdtempSync(join(tmpdir(), "dbsetup-"));
  try {
    writeFileSync(join(dir, ".env"), `${PW}\nsupabase_secretkey=sb_secret_NEVER-PRINT-ME\nsupabase_db_connection_string=${pooled}\n`);
    const run = spawnSync(process.execPath, [join(root, "scripts", "setup-database.mjs"), "--dry-run"], { cwd: dir, encoding: "utf8" });
    const out = run.stdout + run.stderr;
    ok("dry run: it succeeds and shows the host, port, user, project and schema", run.status === 0 && /aws-1-eu-central-1\.pooler\.supabase\.com:6543/.test(out) && /user postgres\.abcdefghijklmnop/.test(out) && /https:\/\/abcdefghijklmnop\.supabase\.co/.test(out) && /supabase\/schema\.sql/.test(out));
    ok("dry run: it points out the stray bare line, and says the symbols are sent exactly as written", /line 1 of \.env/.test(out) && /sent exactly as written/.test(out));
    ok("dry run: the password, the secret key and the connection string are NEVER printed", !out.includes("UNIQUE") && !out.includes("Zx9") && !out.includes("NEVER-PRINT-ME") && !out.includes("sb_secret") && !out.includes("postgresql://"));
    ok("dry run: it says nothing was sent", /nothing was sent/i.test(out));
    const none = mkdtempSync(join(tmpdir(), "dbsetup-"));
    const noEnv = spawnSync(process.execPath, [join(root, "scripts", "setup-database.mjs"), "--dry-run"], { cwd: none, encoding: "utf8" });
    ok("with no .env it stops with a clear message instead of a crash", noEnv.status === 1 && /no \.env file/i.test(noEnv.stderr));
    writeFileSync(join(none, ".env"), "supabase_secretkey=sb_secret_x\n");
    const noConn = spawnSync(process.execPath, [join(root, "scripts", "setup-database.mjs"), "--dry-run"], { cwd: none, encoding: "utf8" });
    ok("with no connection string in .env it says how to get one", noConn.status === 1 && /No database connection string/.test(noConn.stderr) && !noConn.stderr.includes("sb_secret"));
    writeFileSync(join(none, ".env"), "db=postgresql://u:[YOUR-PASSWORD]@h.example:5432/postgres\n");
    const placeholder = spawnSync(process.execPath, [join(root, "scripts", "setup-database.mjs"), "--dry-run"], { cwd: none, encoding: "utf8" });
    ok("a connection string still holding the [YOUR-PASSWORD] placeholder is caught before anything is sent", placeholder.status === 1 && /placeholder/.test(placeholder.stderr));
    rmSync(none, { recursive: true, force: true });
  } finally { rmSync(dir, { recursive: true, force: true }); }

  // ---------- the wiring
  const pkg = JSON.parse(read("package.json")), script = read("scripts/setup-database.mjs");
  ok("npm run db:setup exists, and pg is installed for it (as a development tool, not part of the app)", pkg.scripts["db:setup"] === "node scripts/setup-database.mjs" && !!pkg.devDependencies.pg && !pkg.dependencies.pg);
  ok("the script applies the schema and then CHECKS it: tables, row-level security, the three functions, and the private media bucket", /await client\.query\(sql\)/.test(script) && /relrowsecurity/.test(script) && /'is_member','create_invite','join_child'/.test(script) && /storage\.buckets/.test(script) && /\.public === false/.test(script));
  ok("it tries a verified connection first and only falls back (with a visible note) if the certificate chain isn't recognised", /open\(true\)/.test(script) && /rejectUnauthorized: false/.test(script) && /without checking Supabase's certificate chain/.test(script));
  ok("the password is passed to the database as a plain field, never written into a URL, and never printed", /password: conn\.password/.test(script) && !/console\.(log|error)\([^)]*conn\.password/.test(script) && !/say\([^)]*conn\.password/.test(script));
  ok("the docs explain it: the broken-connection-string problem, db:setup, and the two dashboard steps", /db:setup/.test(read("SHARING.md")) && /percent|% ? @/.test(read("SHARING.md")) && /Confirm email/.test(read("SHARING.md")) && /db:setup/.test(read("README.md")));
  console.log(fails ? `${fails} FAILED` : "all database-setup tests passed");
  process.exit(fails ? 1 : 0);
})();
