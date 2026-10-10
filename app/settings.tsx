import React, { useState } from "react";
import { Text, View } from "react-native";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { TYPE } from "../src/theme";
import { isConfigured, providerOf, reauthenticate, signOut, useSession } from "../src/lib/supabase";
import { deleteAccountData, syncAll } from "../src/lib/sync";
import { Page, Section } from "../src/components/Page";
import { RemindersCard } from "../src/components/RemindersCard";
import { AboutCard } from "../src/components/AboutCard";
import { Btn, Input, Label, Sheet } from "../src/components/ui";

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

      <Section title="Notifications">
        <RemindersCard />
      </Section>

      <Section title="About">
        <AboutCard />
      </Section>

      <Section title="Account">
        {preview ? (
          <>
            <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 12 }]}>You're exploring the sample family. Leave it to sign in and start your own book.</Text>
            <Btn label="Leave the sample family" kind="soft" icon="logout" onPress={clearSample} />
          </>
        ) : isConfigured && session ? (
          <>
            <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>Signed in as</Text>
            <Text style={[TYPE.bodyLarge, { color: t.ink, marginBottom: 12 }]} numberOfLines={1}>{session.user.email}</Text>
            <Btn label={busy ? "Signing out…" : "Sign out"} kind="soft" icon="logout" disabled={busy} onPress={out} />
            <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>Your books stay in your account. Sign back in to see everything again.</Text>
            <Btn label="Remove my data and delete my account" kind="danger" icon="delete-account" onPress={() => setDeleting(true)} style={{ marginTop: 22 }} />
          </>
        ) : (
          <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>This build has no sign-in set up, so everything stays on this phone.</Text>
        )}
      </Section>

      {deleting ? <DeleteAccountSheet onClose={() => setDeleting(false)} /> : null}
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
