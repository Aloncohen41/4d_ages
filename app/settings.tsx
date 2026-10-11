import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { TYPE } from "../src/theme";
import { accountName, isConfigured, providerOf, reauthenticate, signOut, useSession } from "../src/lib/supabase";
import { ChangeEmailSheet, ChangePasswordSheet, NameSheet } from "../src/components/AccountSheets";
import { Icon, IconName } from "../src/components/Icon";
import { FEEDBACK_URL, PRIVACY_URL, TERMS_URL } from "../src/brand";
import { HeightUnit, WeightUnit } from "../src/lib/growth";
import { canLock, unlock } from "../src/components/AppLock";
import { deleteAccountData, syncAll } from "../src/lib/sync";
import { Page, Section } from "../src/components/Page";
import { RemindersCard } from "../src/components/RemindersCard";
import { AboutCard } from "../src/components/AboutCard";
import { DriveBackupCard } from "../src/components/DriveBackupCard";
import { Btn, Input, Label, Seg, Sheet } from "../src/components/ui";
import { CHART_SOURCES } from "../src/lib/percentiles";

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
    <Page title="Settings">
      <Section title="How to add photos" first>
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

      <Section title="Backup">
        <DriveBackupCard />
      </Section>

      <Section title="Notifications">
        <RemindersCard />
      </Section>

      <Section title="Appearance">
        <AppearanceChoice />
      </Section>

      <Section title="Growth charts">
        <GrowthChartChoice />
      </Section>

      <Section title="Privacy">
        <AppLockChoice />
      </Section>

      <Section title="Units">
        <UnitsChoice />
      </Section>

      <Section title="About">
        <AboutCard />
        <View style={{ marginTop: 12 }}>
          <LinkRow icon="lock" label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <LinkRow icon="info" label="Terms of use" onPress={() => Linking.openURL(TERMS_URL)} />
          <LinkRow icon="message-circle" label="Send feedback or ask a question" onPress={() => Linking.openURL(FEEDBACK_URL)} />
        </View>
      </Section>

      <Section title="Account">
        {preview ? (
          <>
            <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 12 }]}>You're exploring the sample family. Leave it to sign in and start your own book.</Text>
            <Btn label="Leave the sample family" kind="soft" icon="logout" onPress={clearSample} />
          </>
        ) : isConfigured && session ? (
          <>
            <LinkRow icon="smile" label="Your name" value={accountName(session)} onPress={() => setSheet("name")} />
            <LinkRow icon="mail" label="Email" value={`${session.user.email ?? ""}${providerOf(session) === "google" ? " (Google)" : ""}`} onPress={() => setSheet("email")} />
            {providerOf(session) === "email" ? <LinkRow icon="lock" label="Change password" onPress={() => setSheet("password")} /> : null}
            <LinkRow icon="user-plus" label="Who can see your children" value="Parents and family, by email: invite, remove or block" onPress={() => router.push("/access")} />
            <View style={{ height: 14 }} />
            <Btn label={busy ? "Signing out…" : "Sign out"} kind="soft" icon="logout" disabled={busy} onPress={out} />
            <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>Your books stay in your account. Sign back in to see everything again.</Text>
            <Btn label="Remove my data and delete my account" kind="danger" icon="delete-account" onPress={() => setDeleting(true)} style={{ marginTop: 22 }} />
          </>
        ) : (
          <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>This build has no sign-in set up, so everything stays on this phone.</Text>
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
    <Sheet visible onClose={busy ? () => undefined : onClose} title="Delete your account">
      <View style={{ backgroundColor: t.dangerSoft, borderRadius: 16, padding: 14 }}>
        <Text style={[TYPE.titleSmall, { color: t.danger }]}>This cannot be undone.</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink, marginTop: 4 }]}>
          Your account and your books are deleted: every photo, story, milestone and measurement. You will lose access to the book. A book you share
          with another parent stays with them.
        </Text>
      </View>
      {google ? (
        <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 16 }]}>To confirm it's you, Google will ask you to choose your account.</Text>
      ) : (
        <>
          <Label>Your password</Label>
          <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Password" accessibilityLabel="Your password" />
        </>
      )}
      <Label>{`Type ${DELETE_WORD} to confirm`}</Label>
      <Input value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} placeholder={DELETE_WORD} accessibilityLabel={`Type ${DELETE_WORD} to confirm`} />
      {err ? <Text style={[TYPE.bodyMedium, { color: t.danger, marginTop: 12 }]}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        <Btn label="Cancel" kind="soft" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
        <Btn label={busy ? "Deleting…" : "Delete forever"} kind="danger" onPress={confirm} disabled={!ready || busy} style={{ flex: 1.4 }} />
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
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{CHART_SOURCES.find((c) => c.id === chart)?.desc}. Percentiles are for information only: ask your health visitor or doctor about growth.</Text>
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
      <Seg options={[{ id: "system" as const, label: "Same as phone" }, { id: "light" as const, label: "Light" }, { id: "dark" as const, label: "Dark" }]} value={appearance} onChange={setAppearance} />
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{appearance === "system" ? "Dark mode turns on and off with your phone's setting." : appearance === "dark" ? "Always dark, whatever the phone is set to." : "Always light, whatever the phone is set to."}</Text>
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
        <Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 6 }]}>Height and head</Text>
        <Seg options={[{ id: "cm" as HeightUnit, label: "Centimetres" }, { id: "in" as HeightUnit, label: "Inches" }]} value={heightUnit} onChange={setHeightUnit} />
      </View>
      <View>
        <Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 6 }]}>Weight</Text>
        <Seg options={[{ id: "kg" as WeightUnit, label: "Kilograms" }, { id: "lb" as WeightUnit, label: "Pounds" }]} value={weightUnit} onChange={setWeightUnit} />
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
    if (!(await canLock())) return setNote("Set up a fingerprint, face or screen lock on this phone first (in the phone's Settings).");
    if (await unlock("Turn on the app lock")) setAppLock(true);
  };
  return (
    <View>
      <Pressable onPress={toggle} accessibilityRole="switch" accessibilityState={{ checked: on }} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 }}>
        <Icon name="lock" size={22} color={t.ink2} />
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.bodyLarge, { color: t.ink }]}>App lock</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Ask for your fingerprint, face or the phone's PIN to open the app, and again after a minute away.</Text>
        </View>
        <View style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: on ? t.accent : t.bg3, borderWidth: on ? 0 : 2, borderColor: t.outline, justifyContent: "center", paddingHorizontal: 4 }}>
          <View style={{ width: on ? 24 : 16, height: on ? 24 : 16, borderRadius: 12, backgroundColor: on ? t.onAccent : t.outline, alignSelf: on ? "flex-end" : "flex-start", marginHorizontal: on ? 0 : 2 }} />
        </View>
      </Pressable>
      {note ? <Text style={[TYPE.bodySmall, { color: t.danger, marginTop: 4 }]}>{note}</Text> : null}
    </View>
  );
}
