import React, { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { backupNow, driveAvailable, findBackup, restoreFromDrive } from "../lib/driveBackup";
import { formatDate, formatTime, toHHMM } from "../lib/date";
import { TYPE } from "../theme";
import { Btn } from "./ui";

const when = (ms: number) => { const d = new Date(ms); return `${formatDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)}, ${formatTime(toHHMM(d))}`; };

/**
 * Settings → Backup: every book in one file, "4D Ages backup.zip", in your own Google Drive (the photos are kept in your account already). On, it backs up
 * a minute after each change; "Back up now" does it straight away; "Restore from Drive" brings a backup back onto this phone.
 */
export function DriveBackupCard() {
  const t = useTheme();
  const prefs = useStore((s) => s.driveBackup);
  const setPrefs = useStore((s) => s.setDriveBackup);
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState("");
  if (!driveAvailable()) return null;

  const run = async (what: () => Promise<void>) => {
    if (busy) return;
    setBusy("Starting…");
    try {
      await what();
    } catch (e) {
      Alert.alert("Google Drive", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  const backup = () => run(async () => {
    await backupNow(true, setBusy);
    if (!useStore.getState().driveBackup.error) showToast({ title: "Backed up to Google Drive", body: "Your books are saved in “4D Ages backup.zip” in your Drive." });
  });
  const toggle = (on: boolean) => {
    setPrefs({ enabled: on });
    if (on) backup(); // the first backup now, and connects Drive
  };
  const restore = () => run(async () => {
    setBusy("Looking for your backup…");
    const found = await findBackup();
    if (!found) return Alert.alert("No backup yet", "There's no 4D Ages backup in this Google account's Drive yet.");
    await new Promise<void>((resolve, reject) => Alert.alert(
      "Restore from Google Drive?",
      `The backup from ${when(found.savedAt)} (${found.kids} ${found.kids === 1 ? "child" : "children"}, ${found.memories} memories) replaces the books on this phone, and goes back to your account too. Anything added since that backup is lost.`,
      [{ text: "Cancel", style: "cancel", onPress: () => reject(new Error("Restoring was cancelled.")) }, { text: "Restore", style: "destructive", onPress: () => resolve() }],
    ));
    const kids = await restoreFromDrive(setBusy);
    showToast({ title: "Restored from Google Drive", body: `${kids} ${kids === 1 ? "book is" : "books are"} back on this phone.` });
  }).catch(() => undefined);

  const status = busy
    ? busy
    : prefs.error === "needs-google"
      ? "Google Drive needs connecting again. Tap Back up now."
      : prefs.error
        ? `The last backup didn't finish: ${prefs.error}`
        : prefs.lastAt
          ? `Last backup ${when(prefs.lastAt)}${prefs.account ? ` · ${prefs.account}` : ""}`
          : "Not backed up yet.";

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>Back up to Google Drive</Text>
          <Text style={{ color: t.ink3, fontSize: 12.5, lineHeight: 18, marginTop: 3 }}>Every book in one small file, “4D Ages backup.zip”, in your own Google Drive. Photos and videos aren't copied again: they're kept safely in your account and come back with the books. When it's on, it backs up a minute after each change.</Text>
        </View>
        <Switch value={prefs.enabled} onValueChange={toggle} disabled={!!busy} trackColor={{ true: t.accent, false: t.bg3 }} thumbColor={prefs.enabled ? t.onAccent : t.outline} ios_backgroundColor={t.bg3} />
      </View>
      <Text style={[TYPE.bodySmall, { color: prefs.error && !busy ? t.danger : t.ink3, marginTop: 10 }]}>{status}</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Btn label="Back up now" icon="upload" kind="soft" onPress={backup} disabled={!!busy} style={{ flex: 1 }} />
        <Btn label="Restore" icon="download" kind="line" onPress={restore} disabled={!!busy} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
