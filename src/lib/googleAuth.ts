/*
 * Google sign-in on the phone: Android's own account picker hands back an ID token for our web client, which Supabase turns into a session.
 * (The website signs in with Google by going to Google and back instead; see googleAuth.web.ts.)
 */
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";

export const googleMode: "token" | "redirect" = "token";

export function configureGoogle(webClientId: string) {
  GoogleSignin.configure({ webClientId });
}

/** The ID token for the Google account the parent picks, or null if they closed the picker. */
export async function googleIdToken(): Promise<string | null> {
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

/** So the next Google sign-in asks which account, instead of answering silently. */
export async function googleSignOut(): Promise<void> {
  await GoogleSignin.signOut().catch(() => undefined);
}
