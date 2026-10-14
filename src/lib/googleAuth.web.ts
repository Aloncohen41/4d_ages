/*
 * Google sign-in on the website: the page goes to Google and comes back signed in (Supabase's "Sign in with Google"), so there's no token to
 * hand over here. The site's address must be listed in Supabase (Authentication → URL Configuration) and in the Google web client.
 */
export const googleMode: "token" | "redirect" = "redirect";
export function configureGoogle(_webClientId: string) {}
export async function googleIdToken(): Promise<string | null> {
  return null;
}
export async function googleSignOut(): Promise<void> {}
