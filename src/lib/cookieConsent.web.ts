import { create } from "zustand";
import { RESUME_KEY } from "./resume";

/*
 * The website's cookie and storage choices. What 4D Ages needs to work (signing in, the copy of your books, your pictures kept in the
 * browser, this choice itself) is always on. Two groups are up to you:
 * - preferences: the website remembering which page you were on, to open there next time;
 * - google: Google's own code on our pages for backing up to Google Drive, which sets Google's cookies.
 * Nothing is used for advertising or analytics, so there's nothing else to ask. Asked once, and changed any time (Settings, or the
 * "Cookies" link at the bottom of every page). See public/cookies/ for the policy.
 */
export type CookieGroup = "preferences" | "google";
export interface CookieChoice { preferences: boolean; google: boolean }
interface Saved extends CookieChoice { v: number; at: string }

const KEY = "4dages.cookies";
/** Raised when the choices themselves change, so everyone is asked again. */
const VERSION = 1;

function read(): CookieChoice | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null") as Saved | null;
    return s && s.v === VERSION ? { preferences: !!s.preferences, google: !!s.google } : null;
  } catch {
    return null;
  }
}

const useConsent = create<{ choice: CookieChoice | null; open: boolean }>(() => {
  const choice = read();
  return { choice, open: !choice };
});

export const useCookieChoice = () => useConsent();
export const cookiesAllow = (g: CookieGroup) => !!useConsent.getState().choice?.[g];
export const openCookieSettings = () => useConsent.setState({ open: true });
export const closeCookieSettings = () => useConsent.setState((s) => ({ open: !s.choice }));

export function saveCookieChoice(c: CookieChoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...c, v: VERSION, at: new Date().toISOString() } satisfies Saved));
  } catch {
    /* storage blocked: the choice still holds until the page is closed */
  }
  // turning preferences off forgets what was remembered
  if (!c.preferences) {
    try { localStorage.removeItem(RESUME_KEY); } catch { /* nothing to remove */ }
  }
  useConsent.setState({ choice: c, open: false });
}
