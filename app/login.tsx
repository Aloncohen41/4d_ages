import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { WORDMARKS } from "../src/lib/wordmark";
import { APP_NAME, LOGIN_TAGLINE, PRIVACY_URL, TERMS_URL, WORDMARK_ASPECT } from "../src/brand";
import { DISPLAY_FONT, TYPE } from "../src/theme";
import { googleReady, resendVerification, signIn, signInWithGoogle, signUp, sendPasswordReset } from "../src/lib/supabase";
import { LegalLinks } from "../src/components/LegalLinks";
import { useAuthLinkError } from "../src/lib/authLinkState";
import { Btn, Input } from "../src/components/ui";
import { Icon, IconName } from "../src/components/Icon";
import { useWide } from "../src/lib/useWide";

import { tr } from "../src/lib/i18n";
type Mode = "in" | "up" | "verify" | "reset";

/** The website's welcome on a computer: what the app is for, beside the sign-in box. */
const WELCOME_POINTS: [IconName, string][] = [
  ["image", "Photos, videos and voice notes, kept in one place"],
  ["trophy", "Milestones, firsts and growth, as they happen"],
  ["nav-book", "A book of it all, to print or share"],
  ["family", "Family can follow along, only who you choose"],
];

/**
 * The login page: the only thing there is before signing in. One screen, no scrolling — the logo, one line, sign-in or account creation,
 * Google, and (small, at the bottom) the sample family for trying the app out. Adding a child or joining a partner comes after signing in.
 */
export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const wide = useWide();
  const loadSample = useStore((s) => s.loadSample);
  const linkError = useAuthLinkError((s) => s.error);
  const [mode, setMode] = useState<Mode>("in");
  // creating an account: agreeing to the terms and the privacy policy, and to keeping health information (see consent.ts)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeHealth, setAgreeHealth] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // sized to the screen so it always fits without scrolling (a small phone is about 667 dp tall, a large one 932)
  const compact = height < 720;
  const logoW = Math.min(width - 48, compact ? 280 : 340);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (!email.includes("@")) throw new Error(tr("Enter your email address."));
      if (pw.length < 6) throw new Error(tr("Enter a password of at least 6 characters."));
      if (mode === "up") {
        if (!agreeTerms || !agreeHealth) throw new Error(tr("Tick both boxes to create your account."));
        const result = await signUp(email, pw);
        if (result === "verify") { setMode("verify"); setPw(""); }
      } else await signIn(email, pw);
    });

  const field = { paddingVertical: compact ? 10 : 13 };
  const shownError = err || linkError;

  const form = (
    <>
        {mode === "reset" ? (
          <View style={{ gap: compact ? 8 : 10 }}>
            <Text style={[TYPE.titleMedium, { color: t.ink, textAlign: "center" }]}>{tr("Forgot your password?")}</Text>
            <Text style={[TYPE.bodyMedium, { color: t.ink2, textAlign: "center" }]}>{tr("Enter your email. We'll send a link that opens {0}, where you choose a new password.", [APP_NAME])}</Text>
            <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder={tr("Email")} accessibilityLabel={tr("Email")} style={field} />
            <Btn label={busy ? tr("Sending…") : tr("Send the link")} icon="mail" disabled={busy} onPress={() => run(async () => { await sendPasswordReset(email); setMsg(tr("Sent. Check your email, it can take a minute to arrive.")); })} />
            <Pressable onPress={() => { setMode("in"); setErr(""); setMsg(""); }} hitSlop={8} style={{ alignItems: "center", paddingVertical: 2 }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700" }}>{tr("Back to sign in")}</Text>
            </Pressable>
          </View>
        ) : mode === "verify" ? (
          <View style={{ gap: 12 }}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Icon name="mail" size={34} color={t.accent} />
              <Text style={[TYPE.titleLarge, { color: t.ink, textAlign: "center" }]}>{tr("Check your email")}</Text>
              <Text style={[TYPE.bodyMedium, { color: t.ink2, textAlign: "center" }]}>{tr("We sent a link to {0}. Tap the button in it and {1} opens, signed in.", [email.trim(), APP_NAME])}</Text>
            </View>
            <Btn label={busy ? tr("Sending…") : tr("Send the email again")} kind="soft" icon="mail" disabled={busy} onPress={() => run(async () => { await resendVerification(email); setMsg(tr("Sent. It can take a minute to arrive.")); })} />
            <Btn label={tr("I've verified, sign in")} onPress={() => { setMode("in"); setErr(""); setMsg(""); }} />
            <Pressable onPress={() => { setMode("up"); setErr(""); setMsg(""); }} hitSlop={8} style={{ alignItems: "center" }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700" }}>{tr("Use a different email")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: compact ? 8 : 10 }}>
            <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder={tr("Email")} accessibilityLabel={tr("Email")} style={field} />
            <View>
              <Input value={pw} onChangeText={setPw} secureTextEntry={!showPw} autoCapitalize="none" autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder={mode === "up" ? tr("Choose a password (6+ characters)") : tr("Password")} accessibilityLabel={tr("Password")} onSubmitEditing={submit} style={[field, { paddingRight: 52 }]} />
              <Pressable onPress={() => setShowPw((v) => !v)} accessibilityLabel={showPw ? tr("Hide password") : tr("Show password")} hitSlop={8} style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
                <Icon name={showPw ? "eye-off" : "eye"} size={22} color={t.ink2} />
              </Pressable>
            </View>
            {mode === "in" ? (
              <Pressable onPress={() => { setMode("reset"); setErr(""); setMsg(""); }} hitSlop={6} style={{ alignSelf: "flex-end" }} accessibilityRole="link">
                <Text style={[TYPE.bodySmall, { color: t.accentDeep, fontWeight: "700" }]}>{tr("Forgot password?")}</Text>
              </Pressable>
            ) : null}
            {mode === "up" ? (
              <View>
                {[
                  [agreeTerms, setAgreeTerms, <>{tr("I'm 18 or over, and I agree to the")} <Text onPress={() => Linking.openURL(TERMS_URL)} style={{ color: t.accentDeep, textDecorationLine: "underline" }}>{tr("Terms")}</Text> {tr("and the")} <Text onPress={() => Linking.openURL(PRIVACY_URL)} style={{ color: t.accentDeep, textDecorationLine: "underline" }}>{tr("Privacy policy")}</Text>.</>],
                  [agreeHealth, setAgreeHealth, <>{tr("I agree that")} {APP_NAME} {tr("can keep the health information I add (pregnancy, growth, health notes), to run my books.")}</>],
                ].map(([on, set, words], k) => (
                  <Pressable key={k} onPress={() => (set as (v: boolean) => void)(!on)} accessibilityRole="checkbox" aria-checked={!!on} style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                    <Icon name={on ? "check-square" : "square"} size={22} color={on ? t.accent : t.ink3} />
                    <Text style={[TYPE.bodySmall, { color: t.ink2, flex: 1 }]}>{words as React.ReactNode}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Btn label={busy ? tr("One moment…") : mode === "in" ? tr("Sign in") : tr("Create account")} onPress={submit} disabled={busy || (mode === "up" && (!agreeTerms || !agreeHealth))} />
            <Pressable onPress={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); setMsg(""); }} hitSlop={6} style={{ alignItems: "center", paddingVertical: 2 }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700" }}>{mode === "in" ? tr("New here? Create an account") : tr("Already have an account? Sign in")}</Text>
            </Pressable>
            {googleReady ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
                  <Text style={[TYPE.labelMedium, { color: t.ink3 }]}>or</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
                </View>
                <Btn label={tr("Sign in with Google")} kind="line" icon="google" disabled={busy} onPress={() => run(async () => { await signInWithGoogle(); })} />
                <Text style={[TYPE.bodySmall, { color: t.ink3, textAlign: "center" }]}>{tr("New to {0}? You'll be asked to agree to the terms first.", [APP_NAME])}</Text>
              </>
            ) : null}
          </View>
        )}

        {shownError ? <Text style={[TYPE.bodyMedium, { color: t.danger, textAlign: "center", marginTop: 10 }]}>{shownError}</Text> : null}
        {msg ? <Text style={[TYPE.bodyMedium, { color: t.accentDeep, textAlign: "center", marginTop: 10 }]}>{msg}</Text> : null}

        {/* for trying the app out: a quiet link, not a main action */}
        <Pressable onPress={loadSample} hitSlop={8} style={{ alignSelf: "center", marginTop: compact ? 14 : 22, paddingVertical: 4 }} accessibilityRole="link">
          <Text style={[TYPE.bodySmall, { color: t.ink3, textDecorationLine: "underline" }]}>{tr("Explore with a sample family")}</Text>
        </Pressable>
        <View style={{ marginTop: compact ? 8 : 12 }}><LegalLinks /></View>
    </>
  );

  if (wide) {
    // the website on a computer: a welcome beside the sign-in box, filling the window
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.bg }}>
        <View style={{ flex: 1, backgroundColor: t.accentSoft, justifyContent: "center", paddingHorizontal: 64, paddingVertical: 48 }}>
          <View style={{ maxWidth: 520, alignSelf: "flex-end", width: "100%" }}>
            <Image source={WORDMARKS.pink} accessibilityLabel={APP_NAME} style={{ width: 300, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" contentPosition="left" />
            <Text role="heading" aria-level={1} style={{ fontFamily: DISPLAY_FONT, fontSize: 40, lineHeight: 50, color: t.onAccentSoft, marginTop: 20 }}>{LOGIN_TAGLINE}</Text>
            <View style={{ gap: 14, marginTop: 28 }}>
              {WELCOME_POINTS.map(([icon, words]) => (
                <View key={words} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={20} color={t.accentDeep} /></View>
                  <Text style={[TYPE.bodyLarge, { color: t.onAccentSoft, flex: 1 }]}>{words}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 64, paddingVertical: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: "100%", maxWidth: 420 }}>
            <Text style={[TYPE.headlineMedium, { color: t.ink, marginBottom: 20 }]}>{mode === "up" ? tr("Create your account") : mode === "reset" ? tr("Reset your password") : mode === "verify" ? tr("Almost there") : tr("Sign in")}</Text>
            {form}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <KeyboardAvoidingView behavior="height" style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", minHeight: compact ? 150 : 200 }}>
          <Image source={WORDMARKS.pink} accessibilityLabel={APP_NAME} style={{ width: logoW, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" />
          <Text style={{ fontFamily: DISPLAY_FONT, fontSize: compact ? 22 : 26, lineHeight: compact ? 28 : 34, color: t.ink, textAlign: "center", marginTop: compact ? 4 : 10 }}>{LOGIN_TAGLINE}</Text>
        </View>

        {form}
      </KeyboardAvoidingView>
    </View>
  );
}

