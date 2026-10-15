import React, { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { APP_NAME, PRIVACY_URL, TERMS_URL } from "../brand";
import { needsAgreement } from "../lib/consent";
import { saveAgreement, signOut, useSession } from "../lib/supabase";
import { Btn, dialogName } from "./ui";
import { Icon } from "./Icon";
import { LegalLinks } from "./LegalLinks";

/**
 * Before anything else, once signed in: agreeing to the terms and the privacy policy, and consenting to keeping health information. Asked
 * once (for accounts made before this, or with Google), and again only when the terms change. "Create account" asks on its own form and
 * keeps the agreement with the new account, so this doesn't ask twice.
 */
export function AgreementGate() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const needed = needsAgreement(session);
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!needed) return null;
  const box = (on: boolean, set: (v: boolean) => void, children: React.ReactNode) => (
    <Pressable onPress={() => set(!on)} accessibilityRole="checkbox" aria-checked={on} style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}>
      <Icon name={on ? "check-square" : "square"} size={24} color={on ? t.accent : t.ink3} />
      <Text style={[TYPE.bodyMedium, { color: t.ink, flex: 1 }]}>{children}</Text>
    </Pressable>
  );
  const link = (label: string, url: string) => <Text onPress={() => Linking.openURL(url)} style={{ color: t.accentDeep, textDecorationLine: "underline" }}>{label}</Text>;
  const agree = async () => {
    setBusy(true);
    setErr("");
    try {
      await saveAgreement();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined} statusBarTranslucent {...dialogName("Before you go on")}>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, maxWidth: 560, width: "100%", alignSelf: "center" }}>
          <Text style={[TYPE.headlineSmall, { color: t.ink }]}>Before you go on</Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 10 }]}>
            {APP_NAME} keeps your family's book private: only you and the people you invite can see it. No advertising, no tracking, and we never sell your information.
          </Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 10 }]}>
            Some of what you can add is health information (pregnancy symptoms and scans, growth measurements, health notes). The law asks for your clear agreement before we keep it. You can delete it, or your account, at any time.
          </Text>
          <View style={{ marginTop: 14 }}>
            {box(terms, setTerms, <>I'm 18 or over, and I agree to the {link("Terms", TERMS_URL)} and the {link("Privacy policy", PRIVACY_URL)}.</>)}
            {box(health, setHealth, <>I agree that {APP_NAME} can keep the health information I add, to run my books.</>)}
          </View>
          {err ? <Text style={[TYPE.bodyMedium, { color: t.danger, marginTop: 8 }]}>{err}</Text> : null}
          <Btn label={busy ? "One moment…" : "Agree and continue"} onPress={agree} disabled={!terms || !health || busy} style={{ marginTop: 16 }} />
          <Btn label="Sign out" kind="soft" onPress={() => signOut()} disabled={busy} style={{ marginTop: 10 }} />
          <View style={{ marginTop: 18 }}><LegalLinks /></View>
        </ScrollView>
      </View>
    </Modal>
  );
}
