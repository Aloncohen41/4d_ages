import { useEffect } from "react";
import { onWeb } from "../lib/onWeb";
import { Alert, AppState, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CURRENT_VERSION, Release, latestRelease, shouldOffer } from "../lib/updateCheck";

const LATER_KEY = "4d-ages-update-later";
/** Back in the app after this long, it looks again. */
const RECHECK_MS = 6 * 60 * 60 * 1000;

/** Offers a newer version (the latest GitHub release) when the app opens. Shows nothing otherwise. */
export function UpdatePrompt() {
  if (onWeb) return null; // the website is always the newest version
  useEffect(() => {
    let alive = true;
    let lastCheck = 0;
    const check = async () => {
      lastCheck = Date.now();
      const release = await latestRelease();
      let later: { version: string; at: number } | null = null;
      try {
        const raw = await AsyncStorage.getItem(LATER_KEY);
        later = raw ? JSON.parse(raw) : null;
      } catch {
        later = null;
      }
      if (alive && release && shouldOffer(release, CURRENT_VERSION, later, Date.now())) offer(release);
    };
    check();
    const sub = AppState.addEventListener("change", (state) => { if (state === "active" && Date.now() - lastCheck > RECHECK_MS) check(); });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return null;
}

/** "Version 1.0.7 is available": Update downloads the APK, which installs over this version and keeps everything. */
export function offer(release: Release) {
  Alert.alert(
    `Version ${release.version} is available`,
    `You have ${CURRENT_VERSION}. The update installs over this version and keeps everything on your phone. After it downloads, open the file to install it.`,
    [
      { text: "Later", style: "cancel", onPress: () => { AsyncStorage.setItem(LATER_KEY, JSON.stringify({ version: release.version, at: Date.now() })).catch(() => undefined); } },
      { text: "Update", onPress: () => { Linking.openURL(release.apkUrl).catch(() => Linking.openURL(release.pageUrl).catch(() => undefined)); } },
    ],
  );
}
