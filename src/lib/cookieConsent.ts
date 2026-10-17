/*
 * The website's cookie and storage choices (see cookieConsent.web.ts). The phone app has no cookies to ask about: everything is allowed
 * and nothing is asked.
 */
export type CookieGroup = "preferences" | "google";
export interface CookieChoice { preferences: boolean; google: boolean }
export const cookiesAllow = (_g: CookieGroup) => true;
export const useCookieChoice = (): { choice: CookieChoice | null; open: boolean } => ({ choice: { preferences: true, google: true }, open: false });
export function openCookieSettings() {}
export function saveCookieChoice(_c: CookieChoice) {}
export function closeCookieSettings() {}
