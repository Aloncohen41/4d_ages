/**
 * The one place the app's brand lives. Visible text takes the name from here, and tests check these values against app.json,
 * so the name shown on the phone and the name shown inside the app can't drift apart.
 *
 * Also named for the app, but never shown: the Android app id (`com.alonc.fourdages` in app.json — Android doesn't allow a part of an id to
 * start with a digit) and the saved-data storage key (`4d-ages-v1` in store.ts). Neither should ever change: a different app id installs as a
 * second app, and a different storage key hides every saved memory.
 */
export const APP_NAME = "4D Ages";
export const APP_VERSION = "1.1.5";
export const TAGLINE = "A baby book that grows with them";
/** The one line on the login page, set in the display face (see theme.ts). */
export const LOGIN_TAGLINE = "Keepsake books for the ages.";
/** The website (the app in the browser, with its plain pages in public/): the invite link's page, the privacy policy, the terms, and more. */
export const SITE_URL = "https://4dages.com/";
export const PRIVACY_URL = `${SITE_URL}privacy/`;
export const TERMS_URL = `${SITE_URL}terms/`;
export const DELETE_ACCOUNT_URL = `${SITE_URL}delete-account/`;
export const ACCESSIBILITY_URL = `${SITE_URL}accessibility/`;
export const LICENCES_URL = `${SITE_URL}licences/`;
/** The cookie policy: what the website keeps in your browser, and the choices. */
export const COOKIES_URL = `${SITE_URL}cookies/`;
/** Where questions, feedback and privacy requests go (the legal pages say the same). */
export const CONTACT_EMAIL = "contact@4dages.com";
/** Where feedback and questions go. */
export const FEEDBACK_URL = "https://github.com/Aloncohen41/4d_ages/issues";
/** Where the app looks for a newer version when it opens (the latest GitHub release, with its APK). */
export const LATEST_RELEASE_API = "https://api.github.com/repos/Aloncohen41/4d_ages/releases/latest";
/** The warm cream the splash screen and the loading screen share — sampled from the icon picture's own backdrop, so the hand-over is invisible. */
export const SPLASH_BG = "#FEFBF6";
/** Width (dp) the splash icon is drawn at: Android 12's round splash mask is two-thirds of a 288 dp area, and the art is sized for it. */
export const SPLASH_ICON_WIDTH = 288;
/** Width ÷ height of assets/4d-ages-wordmark.png (the in-app logo), so it is never stretched. A test checks it against the file. */
export const WORDMARK_ASPECT = 1300 / 419;
