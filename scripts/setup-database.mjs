#!/usr/bin/env node
/*
 * One-time database setup for sharing between parents:  npm run db:setup
 *   npm run db:setup -- --dry-run   checks your .env without connecting
 *   npm run db:setup -- --try       applies the schema and runs every check inside a transaction, then undoes it (nothing is changed)
 *
 * Reads the database connection string from your .env (any variable whose value starts with postgresql://), applies supabase/schema.sql
 * (safe to run again), then checks that the tables, the privacy rules, the functions and the private "media" bucket are all in place.
 * Runs on YOUR computer only. The app never sees the connection string, and the password is never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describeConnection, findConnectionString, friendlyError, parseConnection, parseEnvText, projectRef } from "./dbConnection.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes("--dry-run");
const trial = process.argv.includes("--try");
const say = (s = "") => console.log(s);
const fail = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1); };

// 1. the .env file (in the folder you run this from: the project folder)
const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) fail(`There is no .env file in ${process.cwd()}.\nCopy .env.example to .env, put your database connection string in it, and run this again.`);
const { env, ignored } = parseEnvText(readFileSync(envPath, "utf8"));
if (ignored.length) say(`Note: line${ignored.length > 1 ? "s" : ""} ${ignored.join(", ")} of .env ${ignored.length > 1 ? "are" : "is"} not NAME=VALUE and was skipped (if it's a password written on its own line, you can delete it).`);

// 2. the connection string
const found = findConnectionString(env);
if (!found) fail("No database connection string found in .env (a value starting with postgresql://). In Supabase: Connect → copy the Session pooler string.");
let conn;
try { conn = parseConnection(found.value); } catch (e) { fail(e.message); }
const d = describeConnection(conn);
say(`Database    ${d.host}:${d.port}  (user ${d.user}, database ${d.database})   ← from ${found.name}`);
say(`Password    ${d.passwordLength} characters${d.specialCharacters ? `, ${d.specialCharacters} of them symbols — sent exactly as written` : ""}${d.passwordWasDecoded ? " (decoded from %XX escapes)" : ""}`);
const ref = projectRef(conn);
if (ref) say(`Project     https://${ref}.supabase.co`);

// 3. the schema
const schemaPath = resolve(here, "../supabase/schema.sql");
if (!existsSync(schemaPath)) fail(`Couldn't find ${schemaPath}.`);
const sql = readFileSync(schemaPath, "utf8");
say(`Schema      supabase/schema.sql (${sql.length.toLocaleString("en")} characters)`);
if (dry) {
  say("\nDry run: nothing was sent. Run `npm run db:setup` (without --dry-run) to apply the schema.");
  process.exit(0);
}

// 4. connect
let pg;
try { pg = (await import("pg")).default; } catch { fail("The `pg` package isn't installed yet. Run `npm install`, then try again."); }
const { Client } = pg;
async function open(ssl) {
  const client = new Client({ host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl, connectionTimeoutMillis: 15000 });
  await client.connect();
  return client;
}
let client;
try {
  try { client = await open(true); }
  catch (e) {
    // Supabase's certificate authority isn't in Node's built-in list; the connection is still encrypted
    if (!/certificate/i.test(String(e.message))) throw e;
    say("Note       using an encrypted connection without checking Supabase's certificate chain (normal for a one-time setup).");
    client = await open({ rejectUnauthorized: false });
  }
} catch (e) { fail(`Couldn't connect: ${friendlyError(e)}`); }

// 5. apply, then check
try {
  say(trial ? "\nTrying the schema (in a transaction that is undone at the end)…" : "\nApplying the schema…");
  if (trial) await client.query("begin");
  await client.query(sql);
  say(trial ? "✓ It applies cleanly.\n" : "✓ Applied.\n");
  const tables = ["children", "child_members", "invites", "memories", "custom_defs", "relatives", "classics", "reactions", "child_blocks"];
  const t = await client.query("select table_name from information_schema.tables where table_schema='public' and table_name = any($1)", [tables]);
  const rls = await client.query("select relname from pg_class where relnamespace='public'::regnamespace and relrowsecurity and relname = any($1)", [tables]);
  const fns = await client.query("select proname from pg_proc where pronamespace='public'::regnamespace and proname in ('is_member','is_editor','can_see_memory','create_invite','join_child','delete_my_account','parent_count','remove_member','set_member_people','can_see_post','block_email','unblock_email','delete_child','check_invite','max_parents')");
  const cols = await client.query("select table_name || '.' || column_name as c from information_schema.columns where table_schema='public' and (table_name, column_name) in (('children','gender'),('relatives','nickname'),('relatives','description'),('memories','head_cm'),('child_members','people'),('invites','role'),('invites','people'),('memories','health_kind'),('children','expecting'),('invites','email'),('memories','end_date'),('children','kind'),('children','species'),('children','gotcha_day'),('relatives','child_ref'))");
  const b = await client.query("select public from storage.buckets where id='media'");
  const checks = [
    [`all ${tables.length} tables exist`, t.rowCount === tables.length],
    ["privacy rules (row-level security) are ON for every table", rls.rowCount === tables.length],
    ["the sharing functions exist (membership, invites, the two-parent limit, removing someone, reactions, deleting a profile or an account, checking an invite, up to six owners for a pet)", fns.rowCount === 15],
    ["the newer columns exist (gender; nickname and description; head circumference; who sees what; health log; expecting; invites for one email; how long a symptom lasted; pets; which profile a family member is)", cols.rowCount === 15],
    ["the private “media” bucket exists and is NOT public", b.rowCount === 1 && b.rows[0].public === false],
  ];
  for (const [label, okay] of checks) say(`${okay ? "✓" : "✗"} ${label}`);
  if (trial) {
    await client.query("rollback");
    say("\nTrial only: everything was undone, nothing changed. Run `npm run db:setup` to apply it.");
  }
  if (checks.some(([, okay]) => !okay)) fail("The schema ran, but something it should have created isn't there. Paste supabase/schema.sql into Supabase's SQL Editor to see the exact error.");
} catch (e) {
  fail(`The schema didn't apply: ${friendlyError(e)}`);
} finally {
  await client.end().catch(() => {});
}

// 6. what's left
const hasKey = Object.values(env).some((v) => /^sb_publishable_/i.test(v));
say("\nDone. Three things only you can do in the Supabase dashboard:");
say(`  1. ${hasKey ? "✓ publishable key found in .env" : "Copy the PUBLISHABLE key (Project Settings → API Keys) into .env as EXPO_PUBLIC_SUPABASE_ANON_KEY"}`);
say("  2. Authentication → Sign In / Providers → Email → keep “Confirm email” ON (new accounts verify their email)");
say("  3. Authentication → URL Configuration → Redirect URLs → add  fourdages://auth-callback  (the email's button opens the app)");
