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

module.exports = ({ config }) => withVersionCode(build(config, process.env), process.env);
