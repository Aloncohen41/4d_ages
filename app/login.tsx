import React, { useState } from "react";
import { KeyboardAvoidingView, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { WORDMARKS } from "../src/lib/wordmark";
import { APP_NAME, LOGIN_TAGLINE, WORDMARK_ASPECT } from "../src/brand";
import { DISPLAY_FONT, TYPE } from "../src/theme";
import { googleReady, resendVerification, signIn, signInWithGoogle, signUp } from "../src/lib/supabase";
import { useAuthLinkError } from "../src/lib/authLinkState";
import { Btn, Input } from "../src/components/ui";
import { Icon } from "../src/components/Icon";

type Mode = "in" | "up" | "verify";

/**
 * The login page: the only thing there is before signing in. One screen, no scrolling — the logo, one line, sign-in or account creation,
 * Google, and (small, at the bottom) the sample family for trying the app out. Adding a child or joining a partner comes after signing in.
 */
export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const loadSample = useStore((s) => s.loadSample);
  const linkError = useAuthLinkError((s) => s.error);
  const [mode, setMode] = useState<Mode>("in");
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
      if (!email.includes("@")) throw new Error("Enter your email address.");
      if (pw.length < 6) throw new Error("Enter a password of at least 6 characters.");
      if (mode === "up") {
        const result = await signUp(email, pw);
        if (result === "verify") { setMode("verify"); setPw(""); }
      } else await signIn(email, pw);
    });

  const field = { paddingVertical: compact ? 10 : 13 };
  const shownError = err || linkError;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <KeyboardAvoidingView behavior="height" style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", minHeight: compact ? 150 : 200 }}>
          <Image source={WORDMARKS[t.key]} accessibilityLabel={APP_NAME} style={{ width: logoW, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" />
          <Text style={{ fontFamily: DISPLAY_FONT, fontSize: compact ? 22 : 26, lineHeight: compact ? 28 : 34, color: t.ink, textAlign: "center", marginTop: compact ? 4 : 10 }}>{LOGIN_TAGLINE}</Text>
        </View>

        {mode === "verify" ? (
          <View style={{ gap: 12 }}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Icon name="mail" size={34} color={t.accent} />
              <Text style={[TYPE.titleLarge, { color: t.ink, textAlign: "center" }]}>Check your email</Text>
              <Text style={[TYPE.bodyMedium, { color: t.ink2, textAlign: "center" }]}>We sent a link to {email.trim()}. Tap the button in it and {APP_NAME} opens, signed in.</Text>
            </View>
            <Btn label={busy ? "Sending…" : "Send the email again"} kind="soft" icon="mail" disabled={busy} onPress={() => run(async () => { await resendVerification(email); setMsg("Sent. It can take a minute to arrive."); })} />
            <Btn label="I've verified, sign in" onPress={() => { setMode("in"); setErr(""); setMsg(""); }} />
            <Pressable onPress={() => { setMode("up"); setErr(""); setMsg(""); }} hitSlop={8} style={{ alignItems: "center" }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700" }}>Use a different email</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: compact ? 8 : 10 }}>
            <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="Email" accessibilityLabel="Email" style={field} />
            <View>
              <Input value={pw} onChangeText={setPw} secureTextEntry={!showPw} autoCapitalize="none" autoComplete={mode === "up" ? "new-password" : "current-password"} placeholder={mode === "up" ? "Choose a password (6+ characters)" : "Password"} accessibilityLabel="Password" onSubmitEditing={submit} style={[field, { paddingRight: 52 }]} />
              <Pressable onPress={() => setShowPw((v) => !v)} accessibilityLabel={showPw ? "Hide password" : "Show password"} hitSlop={8} style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
                <Icon name={showPw ? "eye-off" : "eye"} size={22} color={t.ink2} />
              </Pressable>
            </View>
            <Btn label={busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"} onPress={submit} disabled={busy} />
            <Pressable onPress={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); setMsg(""); }} hitSlop={6} style={{ alignItems: "center", paddingVertical: 2 }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700" }}>{mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}</Text>
            </Pressable>
            {googleReady ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
                  <Text style={[TYPE.labelMedium, { color: t.ink3 }]}>or</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
                </View>
                <Btn label="Sign in with Google" kind="line" icon="google" disabled={busy} onPress={() => run(async () => { await signInWithGoogle(); })} />
              </>
            ) : null}
          </View>
        )}

        {shownError ? <Text style={[TYPE.bodyMedium, { color: t.danger, textAlign: "center", marginTop: 10 }]}>{shownError}</Text> : null}
        {msg ? <Text style={[TYPE.bodyMedium, { color: t.accentDeep, textAlign: "center", marginTop: 10 }]}>{msg}</Text> : null}

        {/* for trying the app out: a quiet link, not a main action */}
        <Pressable onPress={loadSample} hitSlop={8} style={{ alignSelf: "center", marginTop: compact ? 14 : 22, paddingVertical: 4 }} accessibilityRole="link">
          <Text style={[TYPE.bodySmall, { color: t.ink3, textDecorationLine: "underline" }]}>Explore with a sample family</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

