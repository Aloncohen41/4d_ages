import Constants from "expo-constants";

/**
 * Your Supabase project URL and publishable (anon) key. You don't edit this file: put them in `.env` (see SHARING.md) and `app.config.js` hands
 * them to the app at build time. Both are public by design — the database rules (schema.sql) keep each family's data private.
 * A secret / service_role key is never accepted (see plugins/supabaseEnv.js).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseAnonKey?: string };

export const SUPABASE_URL: string = extra.supabaseUrl ?? "";
export const SUPABASE_ANON_KEY: string = extra.supabaseAnonKey ?? "";
