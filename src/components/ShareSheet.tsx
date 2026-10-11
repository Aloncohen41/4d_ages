import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { APP_NAME } from "../brand";
import { isConfigured, keyIsSecret, useSession } from "../lib/supabase";
import { MAX_PARENTS, Member, createInvite, currentInvite, joinLink, joinWithCode, listMembers, parentsOf, removeMember, syncAll } from "../lib/sync";
import { familyOf, orderedFamily } from "../lib/family";
import { displayName, relationLine } from "../lib/tags";
import { formatDate } from "../lib/date";
import { TYPE } from "../theme";
import { Btn, Input, MemberAvatar, Sheet } from "./ui";
import { Icon } from "./Icon";

const ago = (t?: number) => {
  if (!t) return "not yet";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};
const ROLE: Record<Member["role"], string> = { owner: "Parent (created the book)", editor: "Parent", viewer: "Family, view only" };

/**
 * Sharing a child's book. First thing: this child's code, and a link to send it in WhatsApp, email or any app. The link opens the app (or
 * offers it) and adds the child, with everything already in the book; from then on both phones stay in step, a change on one shows on the
 * other straight away. A book has at most two parents: once both are in, one has to remove the other before someone else can join.
 * Family can also be invited to view only the posts with chosen people. Opened from a child's profile, or from the welcome page, where there
 * is no child yet and only joining is offered.
 */
export function ShareSheet() {
  const t = useTheme();
  const open = useStore((s) => s.shareOpen);
  const setOpen = useStore((s) => s.setShareOpen);
  const kids = useStore((s) => s.kids);
  const child = useActiveChild();
  const sync = useStore((s) => s.sync);
  const relatives = useStore((s) => s.relatives);
  const familyOrder = useStore((s) => s.familyOrder);
  const session = useSession();

  const [code, setCode] = useState("");
  const [invite, setInvite] = useState<{ code: string; expires: string } | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [familyCode, setFamilyCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const hasChild = kids.length > 0 && !!child && child.role !== "viewer";
  const family = useMemo(() => (child ? orderedFamily(familyOf(relatives, child.id).filter((r) => r.childRef !== child.id), familyOrder[child.id]) : []), [relatives, child, familyOrder]);
  const parents = members ? parentsOf(members) : [];
  const full = parents.length >= MAX_PARENTS;
  const meMember = members?.find((m) => m.me);

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

  // on opening: make sure the child is in the cloud, see who has access, and show this child's code (unless two parents already share it)
  const load = useCallback(async () => {
    if (!child || !session || !hasChild) return;
    await run(async () => {
      if (!child.shared) await syncAll();
      const list = await listMembers(child.id);
      setMembers(list);
      if (parentsOf(list).length < MAX_PARENTS) setInvite(await currentInvite(child.id));
      else setInvite(null);
    });
  }, [child?.id, child?.shared, session, hasChild]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { if (!open) { setInvite(null); setMembers(null); setErr(""); setMsg(""); setCode(""); setFamilyOpen(false); setPeople([]); setFamilyCode(""); } }, [open]);

  const close = () => setOpen(false);
  const card = { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 16, marginTop: 14 } as const;
  const h = [TYPE.titleMedium, { color: t.ink }];
  const p = { color: t.ink3, fontSize: 13, lineHeight: 19, marginTop: 4 };

  const sendLink = (c: string, viewOnly: boolean) =>
    child && Share.share({
      message: viewOnly
        ? `You're invited to see ${child.name}'s baby book in ${APP_NAME}. Open this link to add it: ${joinLink(c)}\nOr open ${APP_NAME}, choose "Join a partner's baby book" and enter code ${c}. It's valid for 7 days.`
        : `Join ${child.name}'s baby book in ${APP_NAME}. Open this link and ${child.name}'s book is added to your phone, with everything in it: ${joinLink(c)}\nOr open ${APP_NAME}, choose "Join a partner's baby book" and enter code ${c}. It's valid for 7 days.`,
    });

  const remove = (m: Member) => {
    if (!child) return;
    const leaving = m.me;
    Alert.alert(
      leaving ? `Leave ${child.name}'s book?` : `Remove ${m.email}?`,
      leaving ? `${child.name}'s book is taken off this phone. The other parent keeps it.` : `They lose access to ${child.name}'s book straight away, and it leaves their phone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: leaving ? "Leave" : "Remove", style: leaving ? "destructive" : "default", onPress: () => run(async () => {
          await removeMember(child.id, m.userId);
          if (leaving) { useStore.getState().forgetChild(child.id); setOpen(false); return; }
          await load();
        }, leaving ? undefined : "Removed.") },
        ...(leaving ? [] : [{ text: "Remove and block", style: "destructive" as const, onPress: () => run(async () => { await removeMember(child.id, m.userId, true); await load(); }, "Removed and blocked. They can't join again until you unblock them in Settings.") }]),
      ]
    );
  };
  // the owner may remove anyone; the other parent may remove family members and leave themselves; the owner can't be removed
  const canRemove = (m: Member) => m.role !== "owner" && (meMember?.role === "owner" || m.me || (meMember?.role === "editor" && m.role === "viewer"));

  return (
    <Sheet visible={open} onClose={close} title={hasChild && child ? `Share ${child.name}'s book` : "Join a partner's baby book"}>
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
            <>
              {/* the code first */}
              {members === null && busy ? (
                <View style={[card, { alignItems: "center", paddingVertical: 28 }]}><ActivityIndicator color={t.accent} /></View>
              ) : full ? (
                <View style={card}>
                  <Text style={h}>Shared by two parents</Text>
                  <Text style={p}>{child.name}'s book is shared by two parents, the most it can have. To share it with someone else, one of you has to remove the other first.</Text>
                </View>
              ) : invite ? (
                <View style={[card, { alignItems: "center" }]}>
                  <Text style={[TYPE.labelLarge, { color: t.ink2 }]}>{child.name}'s code</Text>
                  <Text selectable style={{ color: t.ink, fontSize: 34, fontWeight: "700", letterSpacing: 5, marginVertical: 6 }}>{invite.code}</Text>
                  <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>For the other parent. One use, valid until {formatDate(invite.expires.slice(0, 10))}.</Text>
                  <Btn label="Share link" icon="share" onPress={() => sendLink(invite.code, false)} style={{ marginTop: 14, alignSelf: "stretch" }} />
                  <Btn label="Copy code" icon="copy" kind="line" onPress={() => { Clipboard.setStringAsync(invite.code); setMsg("Code copied."); }} style={{ marginTop: 8, alignSelf: "stretch" }} />
                  <Text style={[p, { textAlign: "center" }]}>Send the link in WhatsApp, email or any app. When they open it, {child.name}'s book is added to their phone with everything in it, and from then on anything either of you adds shows up on both phones straight away.</Text>
                </View>
              ) : null}

              {/* who has access */}
              {members && members.length ? (
                <View style={card}>
                  <Text style={h}>Who has access</Text>
                  {members.map((m) => (
                    <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
                      <Icon name={m.role === "viewer" ? "eye" : "family"} size={20} color={t.ink2} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={1}>{m.me ? `You (${m.email})` : m.email}</Text>
                        <Text style={{ color: t.ink3, fontSize: 12 }}>
                          {ROLE[m.role]}{m.role === "viewer" && m.people.length ? `: posts with ${m.people.map((id) => { const r = relatives.find((x) => x.id === id); return r ? displayName(r) : null; }).filter(Boolean).join(", ")}` : ""}
                        </Text>
                      </View>
                      {canRemove(m) ? (
                        <Pressable onPress={() => remove(m)} disabled={busy} accessibilityRole="button" hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={[TYPE.labelLarge, { color: t.danger }]}>{m.me ? "Leave" : "Remove"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  <Text style={[p, { marginTop: 8 }]}>Last synced: {sync.busy ? "syncing…" : ago(sync.at)}.</Text>
                  {sync.error ? <Text style={{ color: t.danger, fontWeight: "700", fontSize: 12.5, marginTop: 6 }}>{sync.error}</Text> : null}
                  <Btn label={sync.busy ? "Syncing…" : "Sync now"} kind="line" onPress={() => run(syncAll)} disabled={busy || sync.busy} style={{ marginTop: 10 }} />
                </View>
              ) : null}

              {/* family, view only */}
              <View style={card}>
                <Pressable onPress={() => setFamilyOpen((v) => !v)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={h}>Invite family to view</Text>
                    <Text style={p}>Grandparents and others see only the posts with the people you choose, and can leave a heart and a comment.</Text>
                  </View>
                  <Icon name={familyOpen ? "chevron-up" : "chevron-down"} size={22} color={t.ink2} />
                </Pressable>
                {familyOpen ? (
                  family.length ? (
                    <View style={{ marginTop: 8 }}>
                      {family.map((r) => {
                        const on = people.includes(r.id);
                        return (
                          <Pressable key={r.id} onPress={() => { setFamilyCode(""); setPeople(on ? people.filter((x) => x !== r.id) : [...people, r.id]); }} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }}>
                            <Icon name={on ? "check-square" : "square"} size={22} color={on ? t.accent : t.ink3} />
                            <MemberAvatar member={r} size={32} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: t.ink, fontWeight: "700" }}>{displayName(r)}</Text>
                              <Text style={{ color: t.ink3, fontSize: 12 }}>{relationLine(r)}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                      {familyCode ? (
                        <View style={{ alignItems: "center", marginTop: 10 }}>
                          <Text selectable style={{ color: t.ink, fontSize: 26, fontWeight: "700", letterSpacing: 4 }}>{familyCode}</Text>
                          <Btn label="Share link" icon="share" onPress={() => sendLink(familyCode, true)} style={{ marginTop: 10, alignSelf: "stretch" }} />
                        </View>
                      ) : (
                        <Btn label="Make a view-only code" icon="user-plus" onPress={() => run(async () => setFamilyCode(await createInvite(child.id, people)))} disabled={busy || !people.length} style={{ marginTop: 10 }} />
                      )}
                    </View>
                  ) : (
                    <Text style={[p, { color: t.ink2 }]}>Add people in Family first, then tag them on posts.</Text>
                  )
                ) : null}
              </View>
            </>
          ) : null}

          <View style={card}>
            <Text style={h}>Got a code?</Text>
            <Text style={p}>Enter it to add the child's book to your account.</Text>
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
