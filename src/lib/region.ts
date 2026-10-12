import { Emergency, emergencyFor } from "./emergency";

/** The phone's country and language, from its settings (null where the phone doesn't say). */
export function phoneRegion(): { region: string | null; language: string | null } {
  try {
    // required here, so the pure modules that use the result can be tested without the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require("expo-localization") as typeof import("expo-localization");
    const l = getLocales()[0];
    return { region: l?.regionCode ?? null, language: l?.languageCode ?? null };
  } catch {
    return { region: null, language: null };
  }
}

/** The ambulance number for where this phone is. */
export const localEmergency = (): Emergency => {
  const { region, language } = phoneRegion();
  return emergencyFor(region, language);
};
