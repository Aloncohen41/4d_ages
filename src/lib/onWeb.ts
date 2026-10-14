/** True on the website (a browser has a document; the phone app and the tests don't). Needs nothing from React Native. */
export const onWeb = typeof document !== "undefined" && typeof window !== "undefined";
