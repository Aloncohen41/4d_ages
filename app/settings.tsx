import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { TYPE } from "../src/theme";
import { accountName, isConfigured, providerOf, reauthenticate, signOut, useSession } from "../src/lib/supabase";
import { ChangeEmailSheet, ChangePasswordSheet, NameSheet } from "../src/components/AccountSheets";
import { Icon, IconName } from "../src/components/Icon";
import { ACCESSIBILITY_URL, CONTACT_EMAIL, COOKIES_URL, LICENCES_URL, PRIVACY_URL, TERMS_URL } from "../src/brand";
import { openCookieSettings } from "../src/lib/cookieConsent";
import { exportMyData } from "../src/lib/dataExport";
import { fileExport } from "../src/lib/fileExport";
import { onWeb } from "../src/lib/onWeb";
import { downloadFile } from "../src/lib/webDownload";
import { HeightUnit, WeightUnit } from "../src/lib/growth";
import { canLock, unlock } from "../src/components/AppLock";
import { deleteAccountData, syncAll } from "../src/lib/sync";
import { Page, Section } from "../src/components/Page";
import { RemindersCard } from "../src/components/RemindersCard";
import { AboutCard } from "../src/components/AboutCard";
import { DriveBackupCard } from "../src/components/DriveBackupCard";
import { Btn, Input, Label, Seg, Sheet } from "../src/components/ui";
import { CHART_SOURCES } from "../src/lib/percentiles";

import { tr } from "../src/lib/i18n";
/** The three tips that used to sit on the Add page, in order. */
export const PHOTO_STEPS = [
  "In the picker, search a name — if you've named them in Google Photos, their photos come up together.",
  "Select many at once — press and hold.",
  "Only the photos you picked are added. Nothing is scanned.",
];

/** The word typed to confirm deleting the account. */
export const DELETE_WORD = "DELETE";

export default function Settings() {
  const t = useTheme();
  const session = useSession();
  const preview = useStore((s) => s.preview);
  const clearSample = useStore((s) => s.clearSample);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"name" | "email" | "password" | null>(null);
  const setShareOpen = useStore((s) => s.setShareOpen);

  // Signing out keeps everything on this phone and in the account: signing back in brings it all back.
  const out = async () => {
    setBusy(true);
    try {
      await syncAll().catch(() => undefined); // anything not yet in the account goes there first
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={tr("Settings")}>
      <Section title={tr("How to add photos")} first>
        <View style={{ gap: 10 }}>
          {PHOTO_STEPS.map((text, i) => (
            <View key={text} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: t.bg2, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 14 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={[TYPE.labelLarge, { color: t.onAccentSoft }]}>{i + 1}</Text>
              </View>
              <Text style={[TYPE.bodyMedium, { flex: 1, color: t.ink2 }]}>{text}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={tr("Backup")}>
        <DriveBackupCard />
      </Section>

      <Section title={tr("Notifications")}>
        <RemindersCard />
      </Section>

      <Section title={tr("Appearance")}>
        <AppearanceChoice />
      </Section>

      <Section title={tr("Growth charts")}>
        <GrowthChartChoice />
      </Section>

      <Section title={tr("Privacy")}>
        <AppLockChoice />
      </Section>

      <Section title={tr("Units")}>
        <UnitsChoice />
      </Section>

      <Section title={tr("About")}>
        <AboutCard />
        <View style={{ marginTop: 12 }}>
          <LinkRow icon="lock" label={tr("Privacy policy")} onPress={() => Linking.openURL(PRIVACY_URL)} />
          <LinkRow icon="info" label={tr("Terms of use")} onPress={() => Linking.openURL(TERMS_URL)} />
          <LinkRow icon="smile" label={tr("Accessibility")} onPress={() => Linking.openURL(ACCESSIBILITY_URL)} />
          <LinkRow icon="info" label={tr("Licences (open-source software, maps and music)")} onPress={() => Linking.openURL(LICENCES_URL)} />
          {onWeb ? <LinkRow icon="lock" label={tr("Cookie policy")} onPress={() => Linking.openURL(COOKIES_URL)} /> : null}
          {onWeb ? <LinkRow icon="settings" label={tr("Cookie settings")} onPress={openCookieSettings} /> : null}
          <LinkRow icon="message-circle" label={tr("Contact us (questions, feedback, privacy)")} value={CONTACT_EMAIL} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} />
        </View>
      </Section>

      <Section title={tr("Account")}>
        {preview ? (
          <>
            <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 12 }]}>{tr("You're exploring the sample family. Leave it to sign in and start your own book.")}</Text>
            <Btn label={tr("Leave the sample family")} kind="soft" icon="logout" onPress={clearSample} />
          </>
        ) : isConfigured && session ? (
          <>
            <LinkRow icon="smile" label={tr("Your name")} value={accountName(session)} onPress={() => setSheet("name")} />
            <LinkRow icon="mail" label={tr("Email")} value={`${session.user.email ?? ""}${providerOf(session) === "google" ? " (Google)" : ""}`} onPress={() => setSheet("email")} />
            {providerOf(session) === "email" ? <LinkRow icon="lock" label={tr("Change password")} onPress={() => setSheet("password")} /> : null}
            <LinkRow icon="user-plus" label={tr("Who can see your memories")} value="Parents, owners and family, by email: invite, remove or block" onPress={() => router.push("/access")} />
            <DownloadMyData />
            <View style={{ height: 14 }} />
            <Btn label={busy ? tr("Signing out…") : tr("Sign out")} kind="soft" icon="logout" disabled={busy} onPress={out} />
            <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{tr("Your books stay in your account. Sign back in to see everything again.")}</Text>
            <Btn label={tr("Remove my data and delete my account")} kind="danger" icon="delete-account" onPress={() => setDeleting(true)} style={{ marginTop: 22 }} />
          </>
        ) : (
          <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>{tr("This build has no sign-in set up, so everything stays on this phone.")}</Text>
        )}
      </Section>

      {deleting ? <DeleteAccountSheet onClose={() => setDeleting(false)} /> : null}
      {sheet === "name" ? <NameSheet onClose={() => setSheet(null)} /> : null}
      {sheet === "email" ? <ChangeEmailSheet onClose={() => setSheet(null)} /> : null}
      {sheet === "password" ? <ChangePasswordSheet onClose={() => setSheet(null)} /> : null}
    </Page>
  );
}

/** Deleting the account: a clear warning, proof it's really you (password, or Google again), and typing DELETE. Only then is anything removed. */
function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const session = useSession();
  const resetAll = useStore((s) => s.resetAll);
  const google = providerOf(session) === "google";
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = word.trim() === DELETE_WORD && (google || password.length > 0);

  const confirm = async () => {
    setBusy(true);
    setErr("");
    try {
      await reauthenticate(google ? undefined : password); // 1. it's really you
      await deleteAccountData(); // 2. the account and its books, in the cloud
      resetAll(); // 3. this phone's copy
      await signOut(); // → the login page
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={busy ? () => undefined : onClose} title={tr("Delete your account")}>
      <View style={{ backgroundColor: t.dangerSoft, borderRadius: 16, padding: 14 }}>
        <Text style={[TYPE.titleSmall, { color: t.danger }]}>{tr("This cannot be undone.")}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink, marginTop: 4 }]}>
          {tr("Your account and your books are deleted: every photo, story, milestone and measurement. You will lose access to the book. A book you share with another parent stays with them.")}
        </Text>
      </View>
      {google ? (
        <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 16 }]}>{tr("To confirm it's you, Google will ask you to choose your account.")}</Text>
      ) : (
        <>
          <Label>{tr("Your password")}</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder={tr("Password")} accessibilityLabel={tr("Your password")} />
        </>
      )}
      <Label>{tr("Type {0} to confirm", [DELETE_WORD])}</Label>
      <Input value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} placeholder={DELETE_WORD} accessibilityLabel={tr("Type {0} to confirm", [DELETE_WORD])} />
      {err ? <Text style={[TYPE.bodyMedium, { color: t.danger, marginTop: 12 }]}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        <Btn label={tr("Cancel")} kind="soft" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
        <Btn label={busy ? tr("Deleting…") : tr("Delete forever")} kind="danger" onPress={confirm} disabled={!ready || busy} style={{ flex: 1.4 }} />
      </View>
    </Sheet>
  );
}

/** Which charts the Growth page's percentiles come from. */
function GrowthChartChoice() {
  const t = useTheme();
  const chart = useStore((s) => s.growthChart);
  const setChart = useStore((s) => s.setGrowthChart);
  return (
    <View>
      <Seg options={CHART_SOURCES.map((c) => ({ id: c.id, label: c.label }))} value={chart} onChange={setChart} />
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{tr("{0}. Percentiles are for information only: ask your health visitor or doctor about growth.", [CHART_SOURCES.find((c) => c.id === chart)?.desc])}</Text>
    </View>
  );
}

/** Light or dark mode: the same as the phone (the default), or always light or always dark. */
function AppearanceChoice() {
  const t = useTheme();
  const appearance = useStore((s) => s.appearance);
  const setAppearance = useStore((s) => s.setAppearance);
  return (
    <View>
      <Seg options={[{ id: "system" as const, label: tr("Same as phone") }, { id: "light" as const, label: tr("Light") }, { id: "dark" as const, label: tr("Dark") }]} value={appearance} onChange={setAppearance} />
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{appearance === "system" ? tr("Dark mode turns on and off with your phone's setting.") : appearance === "dark" ? tr("Always dark, whatever the phone is set to.") : tr("Always light, whatever the phone is set to.")}</Text>
    </View>
  );
}

/** A row in a settings list: an icon, a label, maybe its current value, and a chevron. */
function LinkRow({ icon, label, value, onPress }: { icon: IconName; label: string; value?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line }}>
      <Icon name={icon} size={22} color={t.ink2} />
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{label}</Text>
        {value ? <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={1}>{value}</Text> : null}
      </View>
      <Icon name="chevron-right" size={20} color={t.ink3} />
    </Pressable>
  );
}

/** Centimetres or inches, kilograms or pounds: used everywhere heights, weights and head measurements are shown or typed. */
function UnitsChoice() {
  const t = useTheme();
  const heightUnit = useStore((s) => s.heightUnit);
  const weightUnit = useStore((s) => s.weightUnit);
  const setHeightUnit = useStore((s) => s.setHeightUnit);
  const setWeightUnit = useStore((s) => s.setWeightUnit);
  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 6 }]}>{tr("Height and head")}</Text>
        <Seg options={[{ id: "cm" as HeightUnit, label: tr("Centimetres") }, { id: "in" as HeightUnit, label: tr("Inches") }]} value={heightUnit} onChange={setHeightUnit} />
      </View>
      <View>
        <Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 6 }]}>{tr("Weight")}</Text>
        <Seg options={[{ id: "kg" as WeightUnit, label: tr("Kilograms") }, { id: "lb" as WeightUnit, label: tr("Pounds") }]} value={weightUnit} onChange={setWeightUnit} />
      </View>
    </View>
  );
}

/** App lock: the fingerprint, face or phone PIN to open the app. Turning it on asks once, so you know it works. */
function AppLockChoice() {
  const t = useTheme();
  const on = useStore((s) => s.appLock);
  const setAppLock = useStore((s) => s.setAppLock);
  const [note, setNote] = useState("");
  const toggle = async () => {
    setNote("");
    if (on) {
      if (await unlock("Turn off the app lock")) setAppLock(false);
      return;
    }
    if (!(await canLock())) return setNote(tr("Set up a fingerprint, face or screen lock on this phone first (in the phone's Settings)."));
    if (await unlock("Turn on the app lock")) setAppLock(true);
  };
  return (
    <View>
      <Pressable onPress={toggle} accessibilityRole="switch" aria-checked={on} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 }}>
        <Icon name="lock" size={22} color={t.ink2} />
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{tr("App lock")}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Ask for your fingerprint, face or the phone's PIN to open the app, and again after a minute away.")}</Text>
        </View>
        <View style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: on ? t.accent : t.bg3, borderWidth: on ? 0 : 2, borderColor: t.outline, justifyContent: "center", paddingHorizontal: 4 }}>
          <View style={{ width: on ? 24 : 16, height: on ? 24 : 16, borderRadius: 12, backgroundColor: on ? t.onAccent : t.outline, alignSelf: on ? "flex-end" : "flex-start", marginHorizontal: on ? 0 : 2 }} />
        </View>
      </Pressable>
      {note ? <Text style={[TYPE.bodySmall, { color: t.danger, marginTop: 4 }]}>{note}</Text> : null}
    </View>
  );
}

/**
 * "Download a copy of my data": everything in the account's books, with the photos and videos on this device, in one zip (see
 * dataExport.ts). The phone asks where to save it (Downloads, Drive, a folder); the website downloads it.
 */
function DownloadMyData() {
  const t = useTheme();
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async () => {
    setBusy(true);
    setMsg("");
    try {
      const fx = onWeb ? null : fileExport();
      const dest = fx ? await fx.createDocument(`4D Ages data.zip`, "application/zip") : null;
      if (fx && !dest) return; // chose not to save
      const { uri, fileName } = await exportMyData(setProgress);
      if (onWeb) downloadFile(uri, fileName);
      else if (fx && dest) await fx.copyInto(uri, dest);
      setMsg(onWeb ? tr("✓ Downloaded.") : tr("✓ Saved where you chose."));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tr("Couldn't make the copy. Try again."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  return (
    <View>
      <LinkRow icon="download" label={busy ? progress || "Making your copy…" : tr("Download a copy of my data")} value="Everything in your books, with the photos and videos on this device" onPress={() => !busy && go()} />
      {msg ? <Text style={[TYPE.bodySmall, { color: msg.startsWith("✓") ? t.accentDeep : t.danger, marginTop: 4 }]}>{msg}</Text> : null}
    </View>
  );
}
