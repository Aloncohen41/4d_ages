import "react-native-url-polyfill/auto";
import React from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { classifyKey } from "../../plugins/supabaseEnv";

/** True if the key in the app is a SECRET key. It must never be inside an app (it bypasses every privacy rule), so sharing refuses to start with it. */
export const keyIsSecret = classifyKey(SUPABASE_ANON_KEY) === "secret";
export const isConfigured = SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20 && !keyIsSecret;

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

// Only refresh the login while the app is on screen (recommended by Supabase for React Native)
if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function useSession(): Session | null {
  const [session, setSession] = React.useState<Session | null>(null);
  React.useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("Sharing isn't set up yet.");
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

/** Returns true when signed in straight away; false when the project still wants the email confirmed. */
export async function signUp(email: string, password: string): Promise<boolean> {
  if (!supabase) throw new Error("Sharing isn't set up yet.");
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  return !!data.session;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
