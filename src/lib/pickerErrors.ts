/*
 * Android sometimes rebuilds the app's main screen (a font-size, display-size or language change, or memory pressure). When it does,
 * Expo's photo picker is left "unregistered" and rejects every call until the whole app process restarts (expo issue #50386). It surfaces as:
 *   "Attempting to launch an unregistered ActivityResultLauncher … You must ensure the ActivityResultLauncher is registered before calling launch()"
 * Nothing in the app's own code can re-register it, so the app recognises this exact failure and offers a one-tap restart instead of a console error.
 */
export function isPickerRegistrationError(e: unknown): boolean {
  const parts: string[] = [];
  if (typeof e === "string") parts.push(e);
  else if (e && typeof e === "object") {
    const o = e as { message?: unknown; cause?: unknown; code?: unknown };
    if (typeof o.message === "string") parts.push(o.message);
    if (typeof o.cause === "string") parts.push(o.cause);
    else if (o.cause && typeof (o.cause as { message?: unknown }).message === "string") parts.push((o.cause as { message: string }).message);
    try { parts.push(String(e)); } catch { /* not printable */ }
  }
  return /unregistered\s+ActivityResultLauncher/i.test(parts.join("\n"));
}

/** The wording of the one-tap restart offer (kept here so it can be tested and reused). */
export const RESTART_TITLE = "The photo picker needs a quick restart";
export const RESTART_MESSAGE =
  "Android reset the app's photo picker after something changed on the phone (like the font or display size). Restarting fixes it, and you'll come straight back to where you were.";
export const RESTART_MANUAL_TITLE = "Close and reopen the app";
export const restartManualMessage = (appName: string) => `Swipe ${appName} away from your recent apps, then open it again — photos will work.`;
