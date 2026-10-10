import "react-native-url-polyfill/auto";
import React from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { GOOGLE_WEB_CLIENT_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
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

/** "Continue with Google" is offered only when sharing is set up and a Google web client ID is in .env. */
export const googleReady = isConfigured && GOOGLE_WEB_CLIENT_ID.length > 0;
if (googleReady) GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/**
 * Signs in with the Google account on the phone: Google hands back an ID token for our web client, and Supabase turns it into a session.
 * Returns false when the parent closes the account picker. (The Android client in Google Cloud, which matches the app id and signing key,
 * is what lets Google trust this app; its ID is not needed here.)
 */
export async function signInWithGoogle(): Promise<boolean> {
  if (!supabase || !googleReady) throw new Error("Google sign-in isn't set up yet.");
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return false;
    const token = res.data.idToken;
    if (!token) throw new Error("Google didn't send a sign-in token. Check the web client ID in .env.");
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return false;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error("Google Play services is missing or out of date on this phone.");
    }
    throw e;
  }
}

export async function signOut(): Promise<void> {
  if (googleReady) await GoogleSignin.signOut().catch(() => undefined); // so the next Google sign-in asks which account
  await supabase?.auth.signOut();
}
