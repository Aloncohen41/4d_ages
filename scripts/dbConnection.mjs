/*
 * Reading a Supabase database connection string — and a .env file — for the one-time database setup (npm run db:setup).
 *
 * The connection string is deliberately NOT parsed as a URL. Supabase hands you a password that can contain characters such as % ? @ # /,
 * and a connection string with those in it is not a valid URL: a normal URL parser then mistakes the user name for the host. So the string is
 * split by hand instead: the host is whatever follows the LAST "@", the password is whatever sits between the first ":" and that "@".
 */

/** A .env file as { NAME: value }, plus the line numbers that were not NAME=VALUE (a bare value, for instance). Values are never logged. */
export function parseEnvText(text) {
  const env = {};
  const ignored = [];
  String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(line);
    if (!m) { ignored.push(i + 1); return; }
    let v = m[2].trim();
    if (v.length > 1 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    env[m[1]] = v;
  });
  return { env, ignored };
}

/** The first value that is a database connection string, with the variable it came from. */
export function findConnectionString(env) {
  for (const [name, value] of Object.entries(env)) if (/^postgres(?:ql)?:\/\//i.test(String(value).trim())) return { name, value: String(value).trim() };
  return null;
}

/** Splits a connection string into its parts without treating it as a URL. Throws a plain-English message if it can't. */
export function parseConnection(raw) {
  const s = String(raw ?? "").trim().replace(/^["']|["']$/g, "");
  const scheme = /^postgres(?:ql)?:\/\//i.exec(s);
  if (!scheme) throw new Error("That doesn't look like a database connection string (it should start with postgresql://).");
  const rest = s.slice(scheme[0].length);
  const at = rest.lastIndexOf("@");
  if (at < 0) throw new Error("The connection string has no “user:password@host” part.");
  const userinfo = rest.slice(0, at);
  const colon = userinfo.indexOf(":");
  if (colon < 0) throw new Error("The connection string has no password in it.");
  const user = userinfo.slice(0, colon);
  let password = userinfo.slice(colon + 1);
  if (/^\[[^\]]*password[^\]]*\]$/i.test(password)) throw new Error("The connection string still has the placeholder [YOUR-PASSWORD]. Put your database password in its place.");
  // a password written with %XX escapes (every % followed by two hex digits) is decoded; anything else is used exactly as written
  let decoded = false;
  if (password.includes("%") && !/%(?![0-9a-fA-F]{2})/.test(password)) {
    try { password = decodeURIComponent(password); decoded = true; } catch { /* leave as written */ }
  }
  const m = /^([^:/?#]+)(?::(\d+))?(?:\/([^?#]*))?(?:[?#].*)?$/.exec(rest.slice(at + 1));
  if (!m) throw new Error("Couldn't read the host and port from the connection string.");
  return {
    host: m[1], port: Number(m[2] || 5432), user, password, database: m[3] || "postgres",
    passwordWasDecoded: decoded,
    specialCharacters: [...password].filter((c) => !/[A-Za-z0-9]/.test(c)).length,
  };
}

/** What may be shown on screen: everything except the password itself. */
export function describeConnection(c) {
  return { host: c.host, port: c.port, user: c.user, database: c.database, passwordLength: c.password.length, specialCharacters: c.specialCharacters, passwordWasDecoded: c.passwordWasDecoded };
}

/** The project reference (public) from the pooler user name "postgres.<ref>" or the host "db.<ref>.supabase.co". */
export function projectRef(c) {
  const pooled = /^postgres\.([a-z0-9]{8,40})$/i.exec(c.user);
  if (pooled) return pooled[1].toLowerCase();
  const direct = /^db\.([a-z0-9]{8,40})\.supabase\.co$/i.exec(c.host);
  return direct ? direct[1].toLowerCase() : "";
}

/** A plain-English reason for a failed connection or query. */
export function friendlyError(e) {
  const code = e && e.code, msg = String((e && e.message) || e);
  if (code === "28P01" || /password authentication failed/i.test(msg)) return "The database rejected the password. If you reset it in Supabase, update it in your .env connection string.";
  if (/tenant or user not found/i.test(msg)) return "The connection pooler didn't recognise the user name or region. Copy the connection string again from Supabase → Connect (use the Session pooler or Transaction pooler string).";
  if (code === "ENOTFOUND") return "Couldn't find the database host. Check the connection string and your internet connection.";
  if (["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) return "Couldn't reach the database. The direct connection (db.<project>.supabase.co) needs IPv6, which some networks lack — use the Session pooler string from Supabase → Connect instead, or paste supabase/schema.sql into Supabase's SQL Editor.";
  if (/certificate/i.test(msg)) return "The database's security certificate wasn't accepted.";
  return msg;
}
