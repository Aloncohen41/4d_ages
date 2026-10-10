// Adds your Supabase project URL and publishable key (from .env) to the app's settings. Expo reads app.json first and hands it to this file.
// Only those two public values are copied; the secret key and the database connection string are never read into the app.
const { build } = require("./plugins/supabaseEnv");

// The Release workflow numbers each build (ANDROID_VERSION_CODE), so Android accepts every release as an update of the one before.
// Without it (a build on your own computer) the versionCode in app.json is used.
function withVersionCode(config, env) {
  const code = Number(env.ANDROID_VERSION_CODE);
  if (!Number.isInteger(code) || code < 1) return config;
  return Object.assign({}, config, { android: Object.assign({}, config.android, { versionCode: code }) });
}

// "Continue with Google": the WEB client ID from Google Cloud (see SHARING.md). Public like the Supabase values; only an ID of the right shape is copied.
const GOOGLE_CLIENT_ID = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
function withGoogle(config, env) {
  const id = String(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "").trim();
  if (!GOOGLE_CLIENT_ID.test(id)) return config;
  return Object.assign({}, config, { extra: Object.assign({}, config.extra, { googleWebClientId: id }) });
}

module.exports = ({ config }) => withGoogle(withVersionCode(build(config, process.env), process.env), process.env);
