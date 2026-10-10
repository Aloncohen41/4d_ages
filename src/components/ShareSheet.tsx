import React, { useCallback, useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { APP_NAME } from "../brand";
import { isConfigured, keyIsSecret, useSession } from "../lib/supabase";
import { createInvite, joinWithCode, listMembers, syncAll } from "../lib/sync";
import { Btn, Input, Sheet } from "./ui";

const ago = (t?: number) => {
  if (!t) return "not yet";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/**
 * Sharing a book with the other parent: invite them with a code, or join their book with the code they sent. Every child is already kept in the
 * signed-in account (see SyncManager), so there is nothing to sign in to or upload here. Opened from a child's profile, or from the welcome page
 * ("Join a partner's baby book"), where there is no child yet and only joining is offered.
 */
export function ShareSheet() {
  const t = useTheme();
  const open = useStore((s) => s.shareOpen);
  const setOpen = useStore((s) => s.setShareOpen);
  const kids = useStore((s) => s.kids);
  const child = useActiveChild();
  const sync = useStore((s) => s.sync);
  const session = useSession();

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
  useEffect(() => { if (!open) { setInvite(""); setErr(""); setMsg(""); setCode(""); } }, [open]);

  const close = () => setOpen(false);
  const card = { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 16, marginTop: 14 } as const;
  const h = { color: t.ink, fontWeight: "700" as const, fontSize: 15 };
  const p = { color: t.ink3, fontSize: 13, lineHeight: 19, marginTop: 4 };
  const hasChild = kids.length > 0 && !!child;

  return (
    <Sheet visible={open} onClose={close} title={hasChild ? "Share with the other parent" : "Join a partner's baby book"}>
      {!isConfigured || !session ? (
        <View style={card}>
          <Text style={h}>One-time setup needed</Text>
          <Text style={p}>
            {keyIsSecret
              ? "The Supabase key in your settings is a SECRET key, which must never be inside an app (it bypasses every privacy rule). Put the publishable (anon) key in your .env file instead. SHARING.md explains where to find it."
              : "Sharing needs sign-in, which isn't set up in this build. The step-by-step guide is in SHARING.md."}
          </Text>
        </View>
      ) : (
        <>
          {hasChild && child ? (
            <View style={card}>
              <Text style={h}>Invite someone to {child.name}'s book</Text>
              <Text style={p}>They sign in with their own account and enter the code. Photos, milestones, heights and notes then sync between you. Last synced: {sync.busy ? "syncing…" : ago(sync.at)}.</Text>
              {sync.busy && sync.progress ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5, marginTop: 6 }}>{sync.progress}</Text> : null}
              {sync.error ? <Text style={{ color: t.danger, fontWeight: "700", fontSize: 12.5, marginTop: 6 }}>{sync.error}</Text> : null}
              {members.length ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12 }}>Who has access</Text>
                  {members.map((m) => <Text key={m.email} style={{ color: t.ink2, marginTop: 3 }}>{m.email}{m.role === "owner" ? " (owner)" : ""}</Text>)}
                </View>
              ) : null}
              <Btn label="Invite the other parent" icon="user-plus" onPress={() => run(async () => { if (!child.shared) await syncAll(); setInvite(await createInvite(child.id)); })} disabled={busy} style={{ marginTop: 14 }} />
              {invite ? (
                <View style={{ backgroundColor: t.accentSoft, borderRadius: 14, padding: 14, marginTop: 12, alignItems: "center" }}>
                  <Text style={{ color: t.onAccentSoft, fontSize: 12, fontWeight: "700" }}>Their invite code (one use, valid 7 days)</Text>
                  <Text selectable style={{ color: t.onAccentSoft, fontSize: 30, fontWeight: "700", letterSpacing: 4, marginVertical: 6 }}>{invite}</Text>
                  <Btn label="Send the code…" kind="soft" onPress={() => Share.share({ message: `Join ${child.name}'s baby book in ${APP_NAME}: sign in, choose "Join a partner's baby book" (or "Share with the other parent") and enter code ${invite}. It's valid for 7 days.` })} style={{ paddingVertical: 9 }} />
                </View>
              ) : null}
              <Btn label={sync.busy ? "Syncing…" : "Sync now"} kind="line" onPress={() => run(syncAll)} disabled={busy || sync.busy} style={{ marginTop: 10 }} />
            </View>
          ) : null}

          <View style={card}>
            <Text style={h}>Got a code from the other parent?</Text>
            <Text style={p}>Enter it to add their child's book to your account.</Text>
            <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="Example: 4F9A2C1B" maxLength={8} style={{ marginTop: 10, letterSpacing: 3, fontWeight: "700" }} />
            <Btn label={busy ? "Joining…" : "Join"} onPress={() => run(async () => { const c = await joinWithCode(code); setCode(""); setMsg(`Welcome! ${c.name}'s book is syncing to this phone.`); setOpen(false); })} disabled={busy || code.trim().length < 6} style={{ marginTop: 12 }} />
          </View>
        </>
      )}

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 14, lineHeight: 19 }}>{err}</Text> : null}
      {msg ? <Text style={{ color: t.accentDeep, fontWeight: "700", marginTop: 14, lineHeight: 19 }}>{msg}</Text> : null}
      <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 18, lineHeight: 17 }}>
        Only people you invite can see your child's pictures. They're stored privately: not public, not searchable. Videos over 45 MB stay on the phone they were taken on.
      </Text>
    </Sheet>
  );
}
