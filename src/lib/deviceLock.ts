import * as LocalAuthentication from "expo-local-authentication";

import { tr } from "./i18n";
/*
 * Checking it's you before the app opens (the app lock): the phone's fingerprint, face or PIN. See deviceLock.web.ts for the website.
 */

/** Whether this phone can lock the app: it has a fingerprint, face or screen lock set up. */
export async function canLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Ask for the fingerprint, face or the phone's PIN. True when it's you. */
export async function unlock(reason: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false, cancelLabel: tr("Cancel") });
    return r.success;
  } catch {
    return false;
  }
}
