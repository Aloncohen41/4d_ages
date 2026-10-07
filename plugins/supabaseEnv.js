"use strict";
/*
 * Which Supabase values may go inside the app, found in your environment (.env) — by what they ARE, not by what you named them.
 *
 *   Project URL      https://<ref>.supabase.co          → public, goes in the app
 *   Publishable key  sb_publishable_…  (or a JWT whose role is "anon")  → public, goes in the app
 *   Secret key       sb_secret_…       (or a JWT whose role is "service_role") → NEVER in the app: recognised and skipped
 *   DB connection string (postgresql://…) → its password is never read or used; only the PUBLIC project reference in it is, to work out the
 *                                          project URL when no URL is given
 *
 * Used twice: at build time by app.config.js (to put the two public values into the app), and inside the app (to refuse a secret key
 * if one ever got in). Plain JavaScript with no dependencies, so Node and the phone can both run it.
 */

/** Base64url text → binary string, or null. */
function decode(part) {
  try {
    const t = String(part).replace(/-/g, "+").replace(/_/g, "/");
    const padded = t + "=".repeat((4 - (t.length % 4)) % 4);
    if (typeof atob === "function") return atob(padded);
    if (typeof Buffer !== "undefined") return Buffer.from(padded, "base64").toString("binary");
  } catch (e) { /* not base64 */ }
  return null;
}

/** "publishable" (safe in an app), "secret" (must never be in an app) or "unknown" (not a Supabase API key). */
function classifyKey(value) {
  const k = String(value == null ? "" : value).trim();
  if (/^sb_secret_/i.test(k)) return "secret";
  if (/^sb_publishable_/i.test(k)) return "publishable";
  const parts = k.split(".");
  if (parts.length === 3) {
    const payload = decode(parts[1]);
    if (payload) {
      try {
        const role = JSON.parse(payload).role;
        if (role === "service_role") return "secret";
        if (role === "anon") return "publishable";
      } catch (e) { /* not JSON */ }
    }
  }
  return "unknown";
}

const PROJECT_URL = /^https:\/\/([a-z0-9]{8,40})\.supabase\.co(?:\/.*)?$/i;

/** "https://abcd1234.supabase.co/rest/v1/" → "https://abcd1234.supabase.co"; anything else (a database address, another site) → "". */
function projectUrl(value) {
  const m = PROJECT_URL.exec(String(value == null ? "" : value).trim());
  return m ? "https://" + m[1].toLowerCase() + ".supabase.co" : "";
}

/**
 * The project reference (public — it is the first part of the project URL) inside a Supabase database connection string: either the host
 * "db.<ref>.supabase.co" or the pooler's user name "postgres.<ref>". Only those two pieces are looked at; the password is never read or returned.
 * The password may contain characters (% ? @ # /) that make the string impossible to parse as a normal URL, so it is not parsed as one.
 */
function refFromConnectionString(value) {
  const s = String(value == null ? "" : value).trim();
  const scheme = /^postgres(?:ql)?:\/\//i.exec(s);
  if (!scheme) return "";
  const rest = s.slice(scheme[0].length);
  const at = rest.lastIndexOf("@");
  if (at < 0) return "";
  const user = rest.slice(0, at).split(":")[0];                 // the user name is everything before the first ":"
  const host = rest.slice(at + 1).split(/[:\/?#]/)[0];            // the host is everything after the LAST "@"
  const pooled = /^postgres\.([a-z0-9]{8,40})$/i.exec(user);
  if (pooled) return pooled[1].toLowerCase();
  const direct = /^db\.([a-z0-9]{8,40})\.supabase\.co$/i.exec(host);
  return direct ? direct[1].toLowerCase() : "";
}

/**
 * Finds the two public values in an environment object.
 *  - the URL: any variable whose VALUE is a Supabase project URL (or a variable named …SUPABASE_URL holding another https address, for a custom domain)
 *  - the key: only variables whose NAME mentions "supabase" and whose VALUE is a publishable key — a secret key is never chosen
 * With no URL at all, it is worked out from the project reference in a database connection string (https://<ref>.supabase.co).
 * Variables named EXPO_PUBLIC_… are preferred when there are several.
 */
function pickSupabase(env) {
  const e = env || {};
  const names = Object.keys(e).sort((a, b) => (/^EXPO_PUBLIC_/i.test(a) ? 0 : 1) - (/^EXPO_PUBLIC_/i.test(b) ? 0 : 1) || a.localeCompare(b));
  let url = "", urlFrom = "", key = "", keyFrom = "", secretSeen = false;
  for (const n of names) {
    const u = projectUrl(e[n]);
    if (u) { url = u; urlFrom = n; break; }
  }
  if (!url) {
    for (const n of names) {
      if (/^(EXPO_PUBLIC_)?SUPABASE_URL$/i.test(n) && /^https:\/\//i.test(String(e[n] || "").trim())) { url = String(e[n]).trim().replace(/\/+$/, ""); urlFrom = n; break; }
    }
  }
  if (!url) {
    for (const n of names) {
      const ref = refFromConnectionString(e[n]);
      if (ref) { url = "https://" + ref + ".supabase.co"; urlFrom = n + " (the project reference in it)"; break; }
    }
  }
  for (const n of names) {
    if (!/supabase/i.test(n)) continue;
    const kind = classifyKey(e[n]);
    if (kind === "secret") secretSeen = true;
    else if (kind === "publishable" && !key) { key = String(e[n]).trim(); keyFrom = n; }
  }
  return { url, key, urlFrom, keyFrom, secretSeen };
}

/** The Expo config with the two public values added under `extra` (nothing else from the environment is ever copied in). */
const told = new Set();
/** console.warn, but each different message only once per run (Expo evaluates the config many times while building). */
function sayOnce(message) {
  if (told.has(message)) return;
  told.add(message);
  console.warn(message);
}

function build(config, env, log) {
  const s = pickSupabase(env);
  const say = typeof log === "function" ? log : sayOnce;
  if (s.secretSeen) say("[4D Ages] A Supabase SECRET key was found in your environment and was ignored on purpose - only the publishable key belongs in the app.");
  if (s.url && !s.key) say("[4D Ages] Found your Supabase URL (" + s.urlFrom + ") but no publishable key. Add it to .env as EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  if (s.key && !s.url) say("[4D Ages] Found your Supabase publishable key (" + s.keyFrom + ") but no project URL. Add it to .env as EXPO_PUBLIC_SUPABASE_URL.");
  return Object.assign({}, config, { extra: Object.assign({}, config && config.extra, { supabaseUrl: s.url, supabaseAnonKey: s.key }) });
}

module.exports = { classifyKey, projectUrl, refFromConnectionString, pickSupabase, build };
