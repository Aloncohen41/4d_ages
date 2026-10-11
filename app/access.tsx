import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from "react-native";
import { Page } from "../src/components/Page";
import { Btn, Input, MemberAvatar, Sheet } from "../src/components/ui";
import { Icon } from "../src/components/Icon";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { MAX_PARENTS, Member, blockEmail, createInvite, joinLink, listBlocked, listMembers, parentsOf, removeMember, setMemberPeople, syncAll, unblockEmail } from "../src/lib/sync";
import { familyOf, orderedFamily } from "../src/lib/family";
import { displayName, relationLine } from "../src/lib/tags";
import { formatDate } from "../src/lib/date";
import { APP_NAME } from "../src/brand";
import { useSession } from "../src/lib/supabase";
import { Child } from "../src/lib/types";
import { TYPE } from "../src/theme";

/**
 * Settings → Who can see your children: for each child, everyone who has access, by email (the parents, and family who can view the posts with
 * the people chosen for them), with Remove and Block; who is blocked, with Unblock; and invites, for the other parent or for a family member,
 * each for one email address.
 */
export default function AccessPage() {
  const t = useTheme();
  // the list is filtered outside the store: a selector that returns a new list each time re-renders without end (and crashes the app)
  const allKids = useStore((s) => s.kids);
  const kids = useMemo(() => allKids.filter((k) => k.role !== "viewer"), [allKids]);
  return (
    <Page title="Who can see your children">
      <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 6 }]}>
        Each child's book is seen only by the people here. A child can have two parents, who see and add to everything, and any number of family
        members, who see only the posts with the people you choose. Remove someone to take their access away; block them so they can't join again.
      </Text>
      {kids.map((k) => <ChildAccess key={k.id} child={k} />)}
    </Page>
  );
}

const ROLE: Record<Member["role"], string> = { owner: "Parent (created the book)", editor: "Parent", viewer: "Family, view only" };

function ChildAccess({ child }: { child: Child }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [blocked, setBlocked] = useState<{ email: string; at: string }[]>([]);
  const [invite, setInvite] = useState<"parent" | "family" | "block" | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      if (!child.shared) await syncAll();
      const [m, b] = await Promise.all([listMembers(child.id), listBlocked(child.id)]);
      setMembers(m);
      setBlocked(b);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setMembers([]);
    }
  }, [child.id, child.shared]);
  useEffect(() => { load(); }, [load]);

  const session = useSession();
  const shown: Member[] | null = members === null ? null : members.some((m) => m.me) ? members
    : [{ userId: session?.user.id ?? "me", email: session?.user.email ?? "", role: "owner", people: [], me: true }, ...members];
  const me = shown?.find((m) => m.me);
  const full = members ? parentsOf(members).length >= MAX_PARENTS : false;
  const canRemove = (m: Member) => m.role !== "owner" && (me?.role === "owner" || m.me || (me?.role === "editor" && m.role === "viewer"));
  const nameOf = (id: string) => { const r = relatives.find((x) => x.id === id); return r ? displayName(r) : null; };
  const run = async (fn: () => Promise<void>) => { setErr(""); try { await fn(); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };

  const remove = (m: Member) => {
    if (m.me) {
      Alert.alert(`Leave ${child.name}'s book?`, `${child.name}'s book is taken off this phone. The other parent keeps it.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => run(async () => { await removeMember(child.id, m.userId); useStore.getState().forgetChild(child.id); }) },
      ]);
      return;
    }
    Alert.alert(`${m.email}`, `Remove takes away their access to ${child.name}'s book straight away. Block also stops them joining again with any code.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", onPress: () => run(() => removeMember(child.id, m.userId)) },
      { text: "Remove and block", style: "destructive", onPress: () => run(() => removeMember(child.id, m.userId, true)) },
    ]);
  };

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 16, marginTop: 14 }}>
      <Text style={[TYPE.titleMedium, { color: t.ink }]}>{child.name}</Text>
      {shown === null ? <ActivityIndicator color={t.accent} style={{ marginVertical: 12 }} /> : (
        <>
          {shown.map((m) => (
            <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Icon name={m.role === "viewer" ? "eye" : "family"} size={20} color={t.ink2} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={1}>{m.me ? `You (${m.email})` : m.email}</Text>
                <Text style={{ color: t.ink3, fontSize: 12 }}>{ROLE[m.role]}{m.role === "viewer" ? `: posts with ${m.people.map(nameOf).filter(Boolean).join(", ") || "no one yet"}` : ""}</Text>
              </View>
              {m.role === "viewer" && me?.role !== "viewer" ? (
                <Pressable onPress={() => setEditing(m)} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 6 }}><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>Change</Text></Pressable>
              ) : null}
              {canRemove(m) && !(m.me && m.role === "owner") ? (
                <Pressable onPress={() => remove(m)} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 6 }}><Text style={[TYPE.labelLarge, { color: t.danger }]}>{m.me ? "Leave" : "Remove"}</Text></Pressable>
              ) : null}
            </View>
          ))}
          {shown.length === 1 ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 8 }]}>Only you can see {child.name}'s book. Invite the other parent or family below.</Text> : null}
          {blocked.length ? (
            <View style={{ marginTop: 10 }}>
              <Text style={[TYPE.labelLarge, { color: t.ink2 }]}>Blocked</Text>
              {blocked.map((b) => (
                <View key={b.email} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }}>
                  <Icon name="lock" size={18} color={t.ink3} />
                  <Text style={{ color: t.ink2, flex: 1 }} numberOfLines={1}>{b.email}</Text>
                  <Pressable onPress={() => run(() => unblockEmail(child.id, b.email))} hitSlop={6} accessibilityRole="button"><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>Unblock</Text></Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 12, gap: 8 }}>
            <Btn label="Invite the other parent" icon="user-plus" onPress={() => setInvite("parent")} disabled={full} />
            {full ? <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Two parents already share {child.name}'s book. One has to be removed before another can join.</Text> : null}
            <Btn label="Invite a family member" icon="eye" kind="line" onPress={() => setInvite("family")} />
            <Pressable onPress={() => setInvite("block")} hitSlop={6} style={{ alignSelf: "center", paddingVertical: 4 }}><Text style={[TYPE.labelLarge, { color: t.ink3, textDecorationLine: "underline" }]}>Block someone by email</Text></Pressable>
          </View>
        </>
      )}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 8 }}>{err}</Text> : null}
      {invite === "parent" || invite === "family" ? <InviteSheet child={child} kind={invite} onClose={() => { setInvite(null); load(); }} /> : null}
      {invite === "block" ? <BlockSheet child={child} onClose={() => { setInvite(null); load(); }} /> : null}
      {editing ? <PeopleSheet child={child} member={editing} onClose={() => { setEditing(null); load(); }} /> : null}
    </View>
  );
}

/** Ticks for the family members whose posts someone may see. */
function PeoplePicker({ child, value, onChange }: { child: Child; value: string[]; onChange: (ids: string[]) => void }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const order = useStore((s) => s.familyOrder[child.id]);
  const family = useMemo(() => orderedFamily(familyOf(relatives, child.id).filter((r) => r.childRef !== child.id), order), [relatives, child.id, order]);
  if (!family.length) return <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>Add people in Family first, then tag them on posts.</Text>;
  return (
    <View>
      {family.map((r) => {
        const on = value.includes(r.id);
        return (
          <Pressable key={r.id} onPress={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }}>
            <Icon name={on ? "check-square" : "square"} size={22} color={on ? t.accent : t.ink3} />
            <MemberAvatar member={r} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontWeight: "700" }}>{displayName(r)}</Text>
              <Text style={{ color: t.ink3, fontSize: 12 }}>{relationLine(r)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** An invite for one person, by email: the other parent (sees and adds to everything) or a family member (views the posts with chosen people). */
function InviteSheet({ child, kind, onClose }: { child: Child; kind: "parent" | "family"; onClose: () => void }) {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const make = async () => {
    setBusy(true); setErr("");
    try {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Enter their email address.");
      if (kind === "family" && !people.length) throw new Error("Tick at least one person whose posts they'll see.");
      setCode(await createInvite(child.id, kind === "family" ? people : undefined, email));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const send = () => Share.share({
    message: `${kind === "parent" ? `Join ${child.name}'s baby book in ${APP_NAME}` : `You're invited to see ${child.name}'s baby book in ${APP_NAME}`}. Open this link: ${joinLink(code)}\nSign in with ${email.trim()} (the code only works for that email). Or open ${APP_NAME}, choose "Join a partner's baby book" and enter ${code}. It's valid for 7 days.`,
  });
  return (
    <Sheet visible onClose={onClose} title={kind === "parent" ? "Invite the other parent" : "Invite a family member"}>
      <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>
        {kind === "parent" ? `They'll see everything in ${child.name}'s book and can add to it, like you.` : `They'll see only the posts with the people you tick, and can leave a heart and a comment. They can't change anything.`}
      </Text>
      {code ? (
        <View style={{ alignItems: "center", marginTop: 14 }}>
          <Text style={[TYPE.labelLarge, { color: t.ink2 }]}>Code for {email.trim()}</Text>
          <Text selectable style={{ color: t.ink, fontSize: 32, fontWeight: "700", letterSpacing: 5, marginVertical: 6 }}>{code}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Only {email.trim()} can use it. One use, valid until {formatDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))}.</Text>
          <Btn label="Share link" icon="share" onPress={send} style={{ marginTop: 12, alignSelf: "stretch" }} />
          <Btn label="Done" kind="soft" onPress={onClose} style={{ marginTop: 8, alignSelf: "stretch" }} />
        </View>
      ) : (
        <>
          <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Their email" accessibilityLabel="Their email" style={{ marginTop: 12 }} />
          {kind === "family" ? <View style={{ marginTop: 12 }}><Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 4 }]}>They see the posts with</Text><PeoplePicker child={child} value={people} onChange={setPeople} /></View> : null}
          {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
          <Btn label={busy ? "Making the code…" : "Make the invite"} icon="user-plus" onPress={make} disabled={busy} style={{ marginTop: 14 }} />
        </>
      )}
    </Sheet>
  );
}

/** Change whose posts a family member sees. */
function PeopleSheet({ child, member, onClose }: { child: Child; member: Member; onClose: () => void }) {
  const t = useTheme();
  const [people, setPeople] = useState<string[]>(member.people);
  const [err, setErr] = useState("");
  return (
    <Sheet visible onClose={onClose} title={`What ${member.email} sees`}>
      <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 8 }]}>They see the posts in {child.name}'s book with any of these people.</Text>
      <PeoplePicker child={child} value={people} onChange={setPeople} />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
      <Btn label="Save" onPress={async () => { try { await setMemberPeople(child.id, member.userId, people); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } }} style={{ marginTop: 14 }} />
    </Sheet>
  );
}

/** Block an email before they've joined (an invite was sent to the wrong person, or someone shouldn't see the book). */
function BlockSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  return (
    <Sheet visible onClose={onClose} title="Block someone">
      <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>They won't be able to join {child.name}'s book with any code, until you unblock them. Codes made for their email stop working.</Text>
      <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Their email" accessibilityLabel="Their email" style={{ marginTop: 12 }} />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
      <Btn label="Block" kind="danger" onPress={async () => { try { await blockEmail(child.id, email); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } }} style={{ marginTop: 14 }} />
    </Sheet>
  );
}
