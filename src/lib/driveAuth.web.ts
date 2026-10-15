/*
 * Google Drive access for the backup, on the website: Google's own sign-in for browsers (Google Identity Services) opens a small Google window
 * the first time, asking to allow Drive only for files 4D Ages makes. The permission lasts about an hour; the automatic backup uses it while it
 * lasts and otherwise waits for the next "Back up now", as on the phone. The website's address must be listed in the Google web client.
 */
import { GOOGLE_WEB_CLIENT_ID } from "../config";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export class NeedsGoogle extends Error {
  constructor() {
    super("Connect Google Drive again: tap Back up now.");
  }
}

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface GoogleOAuth {
  accounts: { oauth2: { initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }) => TokenClient } };
}

let held: { accessToken: string; email: string; until: number } | null = null;

function loadGoogle(): Promise<GoogleOAuth> {
  const w = window as unknown as { google?: GoogleOAuth };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error("Google's sign-in didn't load.")));
    s.onerror = () => reject(new Error("Google's sign-in couldn't be reached. Check your connection."));
    document.head.appendChild(s);
  });
}

export async function driveToken(interactive: boolean): Promise<{ accessToken: string; email: string } | null> {
  if (held && Date.now() < held.until) return { accessToken: held.accessToken, email: held.email };
  if (!interactive) throw new NeedsGoogle(); // a browser can't ask Google in the background
  const google = await loadGoogle();
  const answer = await new Promise<TokenResponse | null>((resolve) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: `${DRIVE_SCOPE} email`,
      callback: (r) => resolve(r),
      error_callback: () => resolve(null), // the Google window was closed
    });
    client.requestAccessToken();
  });
  if (!answer?.access_token) return null;
  const me = (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${answer.access_token}` } })
    .then((r) => r.json())
    .catch(() => ({}))) as { email?: string };
  held = { accessToken: answer.access_token, email: me.email ?? "", until: Date.now() + ((answer.expires_in ?? 3600) - 120) * 1000 };
  return { accessToken: held.accessToken, email: held.email };
}

export async function uploadBytes(url: string, bytes: Uint8Array, accessToken: string, _name: string): Promise<number> {
  const res = await fetch(url, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/zip" }, body: new Blob([bytes as BlobPart]) });
  if (res.status === 401) held = null;
  return res.status;
}

export async function downloadBytes(url: string, accessToken: string): Promise<Uint8Array | number> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) held = null;
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : res.status;
}
