import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { GOOGLE_WEB_CLIENT_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import { classifyKey } from "../../plugins/supabaseEnv";
import { parseAuthCallback } from "./authLink";

/** True if the key in the app is a SECRET key. It must never be inside an app (it bypasses every privacy rule), so sign-in refuses to start with it. */
export const keyIsSecret = classifyKey(SUPABASE_ANON_KEY) === "secret";
export const isConfigured = SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20 && !keyIsSecret;

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // the session is kept on the phone, so you stay signed in across restarts until you sign out
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

/** Where the verification email sends you back: this app (the scheme in app.json). Must be listed in Supabase → Authentication → URL Configuration. */
export const AUTH_REDIRECT = "fourdages://auth-callback";

/* ---------- the session, shared by the whole app ---------- */

interface AuthState {
  /** False until the saved session has been read, so the app never flashes the login page for someone who is signed in. */
  ready: boolean;
  session: Session | null;
}
export const useAuthStore = create<AuthState>(() => ({ ready: !supabase, session: null }));

if (supabase) {
  supabase.auth.getSession().then(({ data }) => useAuthStore.setState({ ready: true, session: data.session })).catch(() => useAuthStore.setState({ ready: true }));
  supabase.auth.onAuthStateChange((_event, session) => useAuthStore.setState({ ready: true, session }));
  // Only refresh the login while the app is on screen (recommended by Supabase for React Native)
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const useSession = (): Session | null => useAuthStore((s) => s.session);
export const useAuthReady = (): boolean => useAuthStore((s) => s.ready);

/** "google" for someone who signed in with Google, else "email". */
export const providerOf = (session: Session | null): "google" | "email" =>
  session?.user.app_metadata?.provider === "google" || (session?.user.identities ?? []).some((i) => i.provider === "google") ? "google" : "email";

const need = () => {
  if (!supabase) throw new Error("Sign-in isn't set up in this build. See SHARING.md.");
  return supabase;
};

/* ---------- email and password ---------- */

/** Supabase's own wording for the usual mistakes, said plainly. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them, or create an account.";
  if (/email not confirmed/i.test(message)) return "Your email isn't verified yet. Tap the button in the email we sent you, or send it again below.";
  if (/user already registered/i.test(message)) return "There's already an account with this email. Sign in instead.";
  if (/password should be at least/i.test(message)) return "Choose a password of at least 6 characters.";
  return message;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await need().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendly(error.message));
}

/**
 * Creates an account. With email verification on (the default), Supabase sends an email whose button opens the app signed in,
 * and nothing can be reached until then: the result is "verify". Without verification the account is signed in at once: "signed-in".
 */
export async function signUp(email: string, password: string): Promise<"verify" | "signed-in"> {
  const { data, error } = await need().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: AUTH_REDIRECT } });
  if (error) throw new Error(friendly(error.message));
  // an existing, verified address comes back with no identities (Supabase hides whether it exists): treat it as "sign in instead"
  if (data.user && !data.session && (data.user.identities ?? []).length === 0) throw new Error(friendly("User already registered"));
  return data.session ? "signed-in" : "verify";
}

export async function resendVerification(email: string): Promise<void> {
  const { error } = await need().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: AUTH_REDIRECT } });
  if (error) throw new Error(friendly(error.message));
}

/** The verification email's button reopens the app with the sign-in in the link: finish it here. True if it signed in. */
export async function completeAuthLink(url: string): Promise<boolean> {
  const link = parseAuthCallback(url);
  if (!link || !supabase) return false;
  if (link.error) throw new Error(link.error);
  if (link.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    if (error) throw new Error(friendly(error.message));
    return true;
  }
  if (link.accessToken && link.refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    if (error) throw new Error(friendly(error.message));
    return true;
  }
  return false;
}

/* ---------- Google ---------- */

/** "Sign in with Google" is offered when sign-in is set up and a Google web client ID is in .env. */
export const googleReady = isConfigured && GOOGLE_WEB_CLIENT_ID.length > 0;
if (googleReady) GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/** The ID token for the Google account the parent picks, or null if they closed the picker. */
async function googleIdToken(): Promise<string | null> {
  if (!googleReady) throw new Error("Google sign-in isn't set up in this build.");
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    if (!res.data.idToken) throw new Error("Google didn't send a sign-in token. Check the web client ID in .env.");
    return res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error("Google Play services is missing or out of date on this phone.");
    }
    throw e;
  }
}

/**
 * Signs in with the Google account on the phone: Google hands back an ID token for our web client, and Supabase turns it into a session.
 * Returns false when the parent closes the account picker. (The Android client in Google Cloud, which matches the app id and signing key,
 * is what lets Google trust this app; its ID is not needed here.)
 */
export async function signInWithGoogle(): Promise<boolean> {
  const token = await googleIdToken();
  if (!token) return false;
  const { error } = await need().auth.signInWithIdToken({ provider: "google", token });
  if (error) throw new Error(friendly(error.message));
  return true;
}

/* ---------- proving it's really you (before deleting the account) ---------- */

/** Checks the password again (email accounts) or asks Google again (Google accounts). The session itself is not changed. */
export async function reauthenticate(password?: string): Promise<void> {
  const sb = need();
  const { data } = await sb.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("Please sign in again first.");
  if (providerOf(session) === "google") {
    if (googleReady) await GoogleSignin.signOut().catch(() => undefined); // so Google asks which account, instead of answering silently
    const token = await googleIdToken();
    if (!token) throw new Error("Choose your Google account to confirm it's you.");
    const { data: again, error } = await sb.auth.signInWithIdToken({ provider: "google", token });
    if (error) throw new Error(friendly(error.message));
    if (again.user?.id !== session.user.id) throw new Error("That's a different Google account. Choose the one you signed in with.");
    return;
  }
  if (!password) throw new Error("Enter your password.");
  const { error } = await sb.auth.signInWithPassword({ email: session.user.email ?? "", password });
  if (error) throw new Error(/invalid login credentials/i.test(error.message) ? "That password isn't right." : friendly(error.message));
}

export async function signOut(): Promise<void> {
  if (googleReady) await GoogleSignin.signOut().catch(() => undefined); // so the next Google sign-in asks which account
  await supabase?.auth.signOut();
}
