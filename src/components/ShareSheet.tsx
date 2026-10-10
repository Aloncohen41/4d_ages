import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { APP_NAME } from "../brand";
import { googleReady, isConfigured, keyIsSecret, signIn, signInWithGoogle, signOut, signUp, useSession } from "../lib/supabase";
import { createInvite, joinWithCode, leaveChild, listMembers, shareChild, syncAll } from "../lib/sync";
import { Btn, Input, Label, Sheet } from "./ui";

const ago = (t?: number) => {
  if (!t) return "not yet";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** Account + sharing: sign in, share the active child, invite the other parent, or join with a code. */
export function ShareSheet() {
  const t = useTheme();
  const open = useStore((s) => s.shareOpen);
  const setOpen = useStore((s) => s.setShareOpen);
  const child = useActiveChild();
  const sync = useStore((s) => s.sync);
  const session = useSession();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [members, setMembers] = useState<{ email: string; role: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshMembers = useCallback(async () => {
    if (child?.shared && session) {
      try { setMembers(await listMembers(child.id)); } catch { /* shown as empty */ }
    } else setMembers([]);
  }, [child?.id, child?.shared, session]);

  useEffect(() => { if (open) refreshMembers(); }, [open, refreshMembers, sync.at]);
  useEffect(() => { if (!open) { setInvite(""); setErr(""); setMsg(""); } }, [open]);

  const close = () => setOpen(false);
  const card = { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 16, marginTop: 14 } as const;
  const h = { color: t.ink, fontWeight: "700" as const, fontSize: 15 };
  const p = { color: t.ink3, fontSize: 13, lineHeight: 19, marginTop: 4 };

  const submitAuth = () =>
    run(async () => {
      if (!email.includes("@") || pw.length < 6) throw new Error("Enter your email and a password of at least 6 characters.");
      if (mode === "up") {
        const direct = await signUp(email, pw);
        if (!direct) throw new Error("Almost there — check your email to confirm the account, then sign in. (Tip: turn off “Confirm email” in Supabase to skip this step.)");
      } else await signIn(email, pw);
      setPw("");
    });

  return (
    <Sheet visible={open} onClose={close} title="Share with the other parent">
      {!isConfigured ? (
        <View style={card}>
          <Text style={h}>One-time setup needed</Text>
          <Text style={p}>
            {keyIsSecret
              ? "The Supabase key in your settings is a SECRET key, which must never be inside an app (it bypasses every privacy rule). Put the publishable (anon) key in your .env file instead — SHARING.md explains where to find it."
              : `Sharing keeps a private copy of ${child ? `${child.name}'s` : "your"} baby book online so both of you see the same photos. To switch it on, create a free Supabase project and put its project URL and publishable key in your .env file. The step-by-step guide is in SHARING.md (about 10 minutes).`}
          </Text>
        </View>
      ) : !session ? (
        <View style={card}>
          <Text style={h}>{mode === "in" ? "Sign in" : "Create your account"}</Text>
          <Text style={p}>Each parent has their own login. Your photos stay private to the people you invite.</Text>
          {googleReady ? (
            <>
              <Btn label={busy ? "One moment…" : "Continue with Google"} kind="line" onPress={() => run(async () => { await signInWithGoogle(); })} disabled={busy} style={{ marginTop: 14 }} />
              <Text style={{ color: t.ink3, fontSize: 12, textAlign: "center", marginTop: 12 }}>or use your email</Text>
            </>
          ) : null}
          <Label>Email</Label>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
          <Label>Password</Label>
          <Input value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" placeholder="at least 6 characters" />
          <Btn label={busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"} onPress={submitAuth} disabled={busy} style={{ marginTop: 16 }} />
          <Pressable onPress={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }} style={{ marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: t.accentDeep, fontWeight: "700", textDecorationLine: "underline" }}>{mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink3, fontSize: 11, fontWeight: "700" }}>Signed in as</Text>
              <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={1}>{session.user.email}</Text>
            </View>
            <Btn label="Sign out" kind="soft" onPress={() => run(signOut)} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
          </View>

          {child ? (
            child.shared ? (
              <View style={card}>
                <Text style={h}>🔗 {child.name} is shared</Text>
                <Text style={p}>Photos, milestones, heights and notes sync automatically. Last synced: {sync.busy ? "syncing…" : ago(sync.at)}.</Text>
                {sync.busy && sync.progress ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5, marginTop: 6 }}>{sync.progress}</Text> : null}
                {sync.error ? <Text style={{ color: t.danger, fontWeight: "700", fontSize: 12.5, marginTop: 6 }}>{sync.error}</Text> : null}
                {members.length ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12 }}>Who has access</Text>
                    {members.map((m) => <Text key={m.email} style={{ color: t.ink2, marginTop: 3 }}>• {m.email}{m.role === "owner" ? " (owner)" : ""}</Text>)}
                  </View>
                ) : null}
                <Btn label={sync.busy ? "Syncing…" : "Sync now"} kind="line" onPress={() => run(syncAll)} disabled={busy || sync.busy} style={{ marginTop: 14 }} />
                <Btn label="Invite the other parent" onPress={() => run(async () => setInvite(await createInvite(child.id)))} disabled={busy} style={{ marginTop: 10 }} />
                {invite ? (
                  <View style={{ backgroundColor: t.accentSoft, borderRadius: 14, padding: 14, marginTop: 12, alignItems: "center" }}>
                    <Text style={{ color: t.ink3, fontSize: 12, fontWeight: "700" }}>Their invite code (one use, valid 7 days)</Text>
                    <Text selectable style={{ color: t.ink, fontSize: 30, fontWeight: "700", letterSpacing: 4, marginVertical: 6 }}>{invite}</Text>
                    <Btn label="Send the code…" kind="soft" onPress={() => Share.share({ message: `Join ${child.name}'s baby book in ${APP_NAME}: open the app → Share → Join, and enter code ${invite} (valid for 7 days).` })} style={{ paddingVertical: 9 }} />
                  </View>
                ) : null}
                <Pressable onPress={() => run(async () => { await leaveChild(child.id); }, "Stopped syncing on this phone. Your photos stay here.")} style={{ marginTop: 16, alignItems: "center" }}>
                  <Text style={{ color: t.ink3, fontWeight: "700", textDecorationLine: "underline", fontSize: 12.5 }}>Stop syncing {child.name} on this phone</Text>
                </Pressable>
              </View>
            ) : (
              <View style={card}>
                <Text style={h}>Share {child.name}</Text>
                <Text style={p}>
                  This uploads {child.name}'s photos, milestones and heights to your private online space so another parent can see and add to them from their own phone.
                  Free accounts hold about 1 GB of photos.
                </Text>
                <Btn label={busy ? "Uploading…" : `Share ${child.name}`} onPress={() => run(() => shareChild(child.id), `${child.name} is now shared. Invite the other parent next.`)} disabled={busy} style={{ marginTop: 14 }} />
                {busy && sync.progress ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5, marginTop: 8, textAlign: "center" }}>{sync.progress}</Text> : null}
              </View>
            )
          ) : null}

          <View style={card}>
            <Text style={h}>Got a code from the other parent?</Text>
            <Text style={p}>Enter it to add their child to this phone.</Text>
            <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="e.g. 4F9A2C1B" maxLength={8} style={{ marginTop: 10, letterSpacing: 3, fontWeight: "700" }} />
            <Btn label={busy ? "Joining…" : "Join"} onPress={() => run(async () => { const c = await joinWithCode(code); setCode(""); setMsg(`Welcome! ${c.name}'s book is syncing to this phone.`); })} disabled={busy || code.trim().length < 6} style={{ marginTop: 12 }} />
          </View>
        </>
      )}

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 14, lineHeight: 19 }}>{err}</Text> : null}
      {msg ? <Text style={{ color: t.accentDeep, fontWeight: "700", marginTop: 14, lineHeight: 19 }}>{msg}</Text> : null}
      <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 18, lineHeight: 17 }}>
        Only people you invite can see your child's pictures. They're stored privately — not public, not searchable. Videos over 45 MB stay on the phone they were taken on.
      </Text>
    </Sheet>
  );
}
