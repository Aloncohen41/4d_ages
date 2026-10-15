/*
 * Google Drive access for the backup, on the phone: Google sign-in on the phone, asking for Drive only for files the app makes. And moving
 * the backup file up and down. See driveAuth.web.ts for the website.
 */
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import * as LegacyFS from "expo-file-system/legacy";
import { File, Paths } from "expo-file-system";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export class NeedsGoogle extends Error {
  constructor() {
    super("Connect Google Drive again: tap Back up now.");
  }
}

/** A Drive access token. Asks the parent to pick an account and allow Drive only when `interactive` (a tap); in the background it never asks. */
export async function driveToken(interactive: boolean): Promise<{ accessToken: string; email: string } | null> {
  let user = GoogleSignin.getCurrentUser();
  if (!user) {
    const quiet = await GoogleSignin.signInSilently().catch(() => null);
    if (quiet && quiet.type === "success") user = quiet.data;
  }
  if (!user) {
    if (!interactive) throw new NeedsGoogle();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    user = res.data;
  }
  if (!user.scopes?.includes(DRIVE_SCOPE)) {
    if (!interactive) throw new NeedsGoogle();
    const res = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
    if (!res || !isSuccessResponse(res)) return null;
    user = res.data;
  }
  const { accessToken } = await GoogleSignin.getTokens();
  return { accessToken, email: user.user.email };
}

/** Sends the backup's bytes to Drive (PATCH to an upload address). Returns the HTTP status. */
export async function uploadBytes(url: string, bytes: Uint8Array, accessToken: string, name: string): Promise<number> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.write(bytes);
  const res = await LegacyFS.uploadAsync(url, file.uri, {
    httpMethod: "PATCH",
    uploadType: LegacyFS.FileSystemUploadType.BINARY_CONTENT,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/zip" },
  });
  return res.status;
}

/** Downloads a file from Drive: its bytes, or the HTTP status when it failed. */
export async function downloadBytes(url: string, accessToken: string): Promise<Uint8Array | number> {
  const dest = new File(Paths.cache, "drive-restore.zip");
  if (dest.exists) dest.delete();
  const res = await LegacyFS.downloadAsync(url, dest.uri, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.status >= 300 ? res.status : dest.bytesSync();
}
