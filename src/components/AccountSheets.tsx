import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { usePasswordReset } from "../lib/authLinkState";
import { accountName, changeEmail, providerOf, setAccountName, setNewPassword, useSession } from "../lib/supabase";
import { TYPE } from "../theme";
import { Btn, Input, Sheet } from "./ui";
import { Icon } from "./Icon";

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useTheme();
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginTop: 10 }}>
      <Input value={value} onChangeText={onChange} secureTextEntry={!show} autoCapitalize="none" placeholder={placeholder} accessibilityLabel={placeholder} style={{ paddingRight: 52 }} />
      <Pressable onPress={() => setShow((v) => !v)} accessibilityLabel={show ? "Hide password" : "Show password"} hitSlop={8} style={{ position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" }}>
        <Icon name={show ? "eye-off" : "eye"} size={22} color={t.ink2} />
      </Pressable>
    </View>
  );
}

function useRun() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return { busy, err, run };
}

/** After opening a password-reset link: the app is signed in, and asks for the new password straight away. */
export function NewPasswordAfterReset() {
  const t = useTheme();
  const needed = usePasswordReset((s) => s.needed);
  const session = useSession();
  const [pw, setPw] = useState("");
  const { busy, err, run } = useRun();
  if (!needed || !session) return null;
  return (
    <Sheet visible onClose={() => usePasswordReset.setState({ needed: false })} title="Choose a new password">
      <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>You're signed in as {session.user.email}. Choose the password you'll use from now on.</Text>
      <PasswordInput value={pw} onChange={setPw} placeholder="New password (6+ characters)" />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
      <Btn label={busy ? "Saving…" : "Save the new password"} onPress={() => run(() => setNewPassword(pw))} disabled={busy} style={{ marginTop: 14 }} />
    </Sheet>
  );
}

/** Settings → Account → Change password: the current one first, then the new one. */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  const { busy, err, run } = useRun();
  return (
    <Sheet visible onClose={onClose} title="Change password">
      {done ? (
        <>
          <Text style={[TYPE.bodyLarge, { color: t.ink }]}>Your password was changed.</Text>
          <Btn label="Done" onPress={onClose} style={{ marginTop: 14 }} />
        </>
      ) : (
        <>
          <PasswordInput value={current} onChange={setCurrent} placeholder="Current password" />
          <PasswordInput value={pw} onChange={setPw} placeholder="New password (6+ characters)" />
          {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
          <Btn label={busy ? "Saving…" : "Change password"} onPress={() => run(async () => { await setNewPassword(pw, current); setDone(true); })} disabled={busy || !current || !pw} style={{ marginTop: 14 }} />
        </>
      )}
    </Sheet>
  );
}

/** Settings → Account → Change email: a confirmation goes to the new address, and the email changes once it's confirmed. */
export function ChangeEmailSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, err, run } = useRun();
  const google = providerOf(session) === "google";
  return (
    <Sheet visible onClose={onClose} title="Change email">
      {google ? (
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>You sign in with Google, so your email is your Google account's. To use another email, sign out and sign in with that account (your books stay with this one).</Text>
      ) : sent ? (
        <>
          <Text style={[TYPE.bodyLarge, { color: t.ink }]}>Check your email</Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 4 }]}>We sent a confirmation to {email.trim()}. Your email changes once you tap the button in it.</Text>
          <Btn label="Done" onPress={onClose} style={{ marginTop: 14 }} />
        </>
      ) : (
        <>
          <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>Now: {session?.user.email}</Text>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="New email" accessibilityLabel="New email" style={{ marginTop: 10 }} />
          {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
          <Btn label={busy ? "Sending…" : "Send confirmation"} onPress={() => run(async () => { await changeEmail(email); setSent(true); })} disabled={busy || !email.trim()} style={{ marginTop: 14 }} />
        </>
      )}
    </Sheet>
  );
}

/** Settings → Account → Your name: shown beside your hearts and comments. */
export function NameSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const session = useSession();
  const [name, setName] = useState(accountName(session));
  const { busy, err, run } = useRun();
  return (
    <Sheet visible onClose={onClose} title="Your name">
      <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>Shown beside your hearts and comments, so the family knows who they're from.</Text>
      <Input value={name} onChangeText={setName} placeholder="Example: Mummy" accessibilityLabel="Your name" style={{ marginTop: 10 }} maxLength={40} />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
      <Btn label={busy ? "Saving…" : "Save"} onPress={() => run(async () => { await setAccountName(name); onClose(); })} disabled={busy || !name.trim()} style={{ marginTop: 14 }} />
    </Sheet>
  );
}
