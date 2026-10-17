import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Text, View } from "react-native";
import { canLock as canLockDevice, unlock as unlockDevice } from "../lib/deviceLock";
import { Image } from "expo-image";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { WORDMARKS } from "../lib/wordmark";
import { APP_NAME, WORDMARK_ASPECT } from "../brand";
import { TYPE } from "../theme";
import { Btn, dialogName } from "./ui";

import { tr } from "../lib/i18n";
/** After this long away from the app, it asks again. */
export const RELOCK_AFTER_MS = 60 * 1000;

/** Whether this device can lock the app (a fingerprint, face or screen lock is set up), and asking for it (see deviceLock.ts). */
export const canLock = (): Promise<boolean> => canLockDevice();
export const unlock = (reason = `Unlock ${APP_NAME}`): Promise<boolean> => unlockDevice(reason);

/**
 * App lock (Settings → Privacy): with it on, the app is covered until you unlock it with your fingerprint, face or the phone's PIN, when it opens
 * and when you come back to it after a minute away. Nothing of the book is shown behind the cover.
 */
export function AppLock() {
  const t = useTheme();
  const enabled = useStore((s) => s.appLock);
  const hydrated = useStore((s) => s.hydrated);
  const [locked, setLocked] = useState(true);
  const awayAt = useRef<number | null>(null);

  const tryUnlock = useCallback(async () => {
    if (await unlock()) setLocked(false);
  }, []);

  // on opening (once the saved setting is known)
  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) { setLocked(false); return; }
    tryUnlock();
  }, [hydrated, enabled, tryUnlock]);

  // coming back after a while
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (!useStore.getState().appLock) return;
      if (state === "background") awayAt.current = Date.now();
      if (state === "active" && awayAt.current && Date.now() - awayAt.current > RELOCK_AFTER_MS) {
        awayAt.current = null;
        setLocked(true);
        tryUnlock();
      }
    });
    return () => sub.remove();
  }, [tryUnlock]);

  if (!hydrated || !enabled || !locked) return null;
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => undefined} {...dialogName(`${APP_NAME} is locked`)}>
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
        <Image source={WORDMARKS.pink} accessibilityLabel={APP_NAME} style={{ width: 240, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" />
        <Text style={[TYPE.bodyLarge, { color: t.ink2, textAlign: "center" }]}>{tr("{0} is locked.", [APP_NAME])}</Text>
        <Btn label={tr("Unlock")} icon="lock" onPress={tryUnlock} style={{ alignSelf: "stretch" }} />
      </View>
    </Modal>
  );
}
