// Adds your Supabase project URL and publishable key (from .env) to the app's settings. Expo reads app.json first and hands it to this file.
// Only those two public values are copied; the secret key and the database connection string are never read into the app.
const { build } = require("./plugins/supabaseEnv");

module.exports = ({ config }) => build(config, process.env);
