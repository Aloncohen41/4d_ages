import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Page } from "../src/components/Page";
import { Btn, Input, MemberAvatar } from "../src/components/ui";
import { Icon, IconName } from "../src/components/Icon";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { uid, useActiveChild, useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { isConfigured, keyIsSecret, useSession } from "../src/lib/supabase";
import {
  MAX_PET_OWNERS, maxParents, Member, PendingInvite, cancelInvite, ensureShared, inviteFor, joinLink, openInvite, listBlocked, listInvites, listMembers,
  parentsOf, removeMember, setMemberPeople, unblockEmail,
} from "../src/lib/sync";
import { InviteKind, cleanEmail, friendlyShareError, inviteMessage, isEmail, kindSummary, normalizeCode } from "../src/lib/shareFlow";
import { familyOf, orderedFamily } from "../src/lib/family";
import { displayName, relationLine } from "../src/lib/tags";
import { formatDate } from "../src/lib/date";
import { APP_NAME } from "../src/brand";
import { Child, isPet } from "../src/lib/types";
import { TYPE } from "../src/theme";

import { tr } from "../src/lib/i18n";
/**
 * Sharing a child's book, all in one place (from the profile's "Share the book", Settings, or "Join" on the welcome page):
 *  - who can see the book now (you, always), with what each person sees, and remove or block;
 *  - invite someone: first choose the other parent or a family member, then (family) who they are and whose posts they see, their email,
 *    a check of the details, and then send it on WhatsApp, by email or any app;
 *  - invites still waiting (send again, or cancel), and people blocked (unblock);
 *  - join a book with a code someone sent you.
 * Fail-safe: the book is made ready to share first (with progress and Try again), every button shows when it's working and can't be pressed
 * twice, errors are said plainly, sending twice reuses the same invite, and the screen catches its own errors instead of closing the app.
 */
export default function ShareScreen() {
  const t = useTheme();
  return (
    <ErrorBoundary colors={{ bg: t.bg, ink: t.ink, ink3: t.ink3 }} onBack={() => router.back()}>
      <ShareContent />
    </ErrorBoundary>
  );
}

type Step = { at: "home" } | { at: "who"; kind: InviteKind } | { at: "send"; invite: PendingInvite };

function ShareContent() {
  const t = useTheme();
  const params = useLocalSearchParams<{ child?: string; mode?: string }>();
  const kids = useStore((s) => s.kids);
  const active = useActiveChild();
  const child = (params.child && kids.find((k) => k.id === params.child)) || active;
  const [step, setStep] = useState<Step>({ at: "home" });
  const joinOnly = params.mode === "join" || !child;

  // sharing needs sign-in set up in this build (and never a secret key inside the app)
  if (!isConfigured) {
    return (
      <Page title={tr("Sharing")}>
        <Text style={[TYPE.bodyLarge, { color: t.ink2 }]}>
          {keyIsSecret ? tr("The Supabase key in this build is a SECRET key, which must never be inside an app (it bypasses every privacy rule), so sharing is turned off. Put the publishable (anon) key in .env instead; SHARING.md explains where to find it.") : tr("Sharing needs sign-in, which isn't set up in this build. The step-by-step guide is in SHARING.md.")}
        </Text>
      </Page>
    );
  }
  if (joinOnly) return <Page title={tr("Join a baby book")}><JoinCard expanded /></Page>;
  if (child.role === "viewer") {
    return (
      <Page title={tr("{0}'s book", [child.name])}>
        <Text style={[TYPE.bodyLarge, { color: t.ink2 }]}>{tr("{0}'s family shared this book with you to view. Only they can invite others.", [child.name])}</Text>
        <JoinCard />
      </Page>
    );
  }
  const back = () => (step.at === "home" ? router.back() : setStep({ at: "home" }));
  return (
    <Page title={step.at === "home" ? tr("Share {0}'s book", [child.name]) : step.at === "send" ? tr("Send the invite") : step.kind === "parent" ? tr("Invite the other parent") : tr("Invite a family member")}
      right={step.at !== "home" ? <Pressable onPress={back} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 8 }}><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tr("Back")}</Text></Pressable> : undefined}>
      {step.at === "home" ? <Overview child={child} onInvite={(kind) => setStep({ at: "who", kind })} onSend={(invite) => setStep({ at: "send", invite })} /> : null}
      {step.at === "who" ? <InviteSteps child={child} kind={step.kind} onCreated={(invite) => setStep({ at: "send", invite })} onCancel={() => setStep({ at: "home" })} /> : null}
      {step.at === "send" ? <SendInvite child={child} invite={step.invite} onDone={() => setStep({ at: "home" })} /> : null}
    </Page>
  );
}

const ROLE: Record<Member["role"], string> = { owner: "Parent · created the book", editor: "Parent", viewer: "Family · view only" };

/** The first screen: who can see the book, the two kinds of invite, waiting invites, blocked people, and joining with a code. */
function Overview({ child, onInvite, onSend }: { child: Child; onInvite: (k: InviteKind) => void; onSend: (i: PendingInvite) => void }) {
  const t = useTheme();
  const session = useSession();
  const relatives = useStore((s) => s.relatives);
  const [state, setState] = useState<"preparing" | "ready" | "failed">("preparing");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [blocked, setBlocked] = useState<{ email: string }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("preparing"); setErr("");
    try {
      await ensureShared(child.id); // the book has to be in the account before anyone can join it
      const [m, i, b] = await Promise.all([listMembers(child.id), listInvites(child.id), listBlocked(child.id)]);
      setMembers(m); setInvites(i); setBlocked(b);
      setState("ready");
    } catch (e) {
      setErr(friendlyShareError(e));
      setState("failed");
    }
  }, [child.id]);
  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setErr("");
    try { await fn(); await load(); } catch (e) { setErr(friendlyShareError(e)); } finally { setBusy(null); }
  };

  // you are always listed, even before the list has loaded or anyone else has joined
  const people: Member[] = members.some((m) => m.me) ? members : [{ userId: session?.user.id ?? "me", email: session?.user.email ?? "", role: "owner", people: [], me: true }, ...members];
  const me = people.find((m) => m.me);
  const parentsFull = parentsOf(members).length >= maxParents(child);
  const nameOf = (id: string) => { const r = relatives.find((x) => x.id === id); return r ? displayName(r) : null; };
  const canRemove = (m: Member) => !m.me && m.role !== "owner" && (me?.role === "owner" || (me?.role === "editor" && m.role === "viewer"));

  const manage = (m: Member) => {
    if (m.me) {
      if (m.role === "owner") return;
      return Alert.alert(tr("Leave {0}'s book?", [child.name]), tr("It's taken off this phone. The other parent keeps it, and can invite you again."), [
        { text: tr("Cancel"), style: "cancel" },
        { text: tr("Leave"), style: "destructive", onPress: () => act("leave", async () => { await removeMember(child.id, m.userId); useStore.getState().forgetChild(child.id); router.replace("/"); }) },
      ]);
    }
    if (!canRemove(m)) return;
    Alert.alert(m.email, m.role === "viewer" ? tr("Family, view only. Change what they see, or take their access away.") : tr("Parent. Removing them takes their access away straight away."), [
      { text: tr("Cancel"), style: "cancel" },
      ...(m.role === "viewer" ? [{ text: tr("Change what they see"), onPress: () => setEditing(m) }] : []),
      { text: tr("Remove"), onPress: () => act(`rm-${m.userId}`, () => removeMember(child.id, m.userId)) },
      { text: tr("Remove and block"), style: "destructive" as const, onPress: () => act(`rm-${m.userId}`, () => removeMember(child.id, m.userId, true)) },
    ]);
  };
  const [editing, setEditing] = useState<Member | null>(null);

  if (state === "preparing" && !members.length) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
        <ActivityIndicator color={t.accent} size="large" />
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{tr("Getting {0}'s book ready to share…", [child.name])}</Text>
      </View>
    );
  }
  if (state === "failed" && !members.length) {
    return (
      <View style={{ paddingVertical: 24, gap: 12 }}>
        <Icon name="info" size={36} color={t.ink3} />
        <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("{0}'s book couldn't be made ready to share", [child.name])}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{err}</Text>
        <Btn label={tr("Try again")} icon="refresh-cw" onPress={load} />
        <JoinCard />
      </View>
    );
  }

  return (
    <View>
      {/* who can see it now */}
      <Text style={[TYPE.titleMedium, { color: t.ink, marginBottom: 6 }]}>{tr("Who can see {0}'s book", [child.name])}</Text>
      {people.map((m) => (
        <Pressable key={m.userId} onPress={() => manage(m)} disabled={!!busy || (m.me && m.role === "owner") || (!m.me && !canRemove(m))} accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: m.role === "viewer" ? t.bg2 : t.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name={m.role === "viewer" ? "eye" : "family"} size={18} color={m.role === "viewer" ? t.ink2 : t.onAccentSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.bodyLarge, { color: t.ink }]} numberOfLines={1}>{m.me ? tr("You{0}", [m.email ? ` (${m.email})` : ""]) : m.email}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={2}>{ROLE[m.role]}{m.role === "viewer" ? tr(": posts with {0}", [m.people.map(nameOf).filter(Boolean).join(", ") || "no one yet"]) : ""}</Text>
          </View>
          {busy === `rm-${m.userId}` ? <ActivityIndicator color={t.accent} /> : (m.me && m.role !== "owner") || canRemove(m) ? <Icon name="chevron-right" size={20} color={t.ink3} /> : null}
        </Pressable>
      ))}
      {people.length === 1 ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 8 }]}>{tr("Only you can see it so far.")}</Text> : null}

      {/* invite: choose the kind first */}
      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 24, marginBottom: 8 }]}>{tr("Invite someone")}</Text>
      <Choice icon="family" title={isPet(child) ? tr("Another owner") : tr("The other parent")} text={parentsFull ? (isPet(child) ? tr("{0}'s book already has {1} owners. Someone has to be removed before another can join.", [child.name, MAX_PET_OWNERS]) : tr("This book already has two parents. To invite someone else as a parent, one of you has to be removed first.")) : tr("Sees everything in {0}'s book and can add to it, like you.{1}", [child.name, isPet(child) ? ` Up to ${MAX_PET_OWNERS} owners.` : ""])} disabled={parentsFull || !!busy} onPress={() => onInvite("parent")} />
      <Choice icon="eye" title={tr("A family member")} text={tr("Grandparents, aunts, uncles… They see only the posts with the people you choose, and can leave a heart and a comment.")} disabled={!!busy} onPress={() => onInvite("family")} />

      {/* invites still waiting */}
      {invites.length ? (
        <>
          <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 24, marginBottom: 6 }]}>{tr("Waiting to be accepted")}</Text>
          {invites.map((i) => (
            <View key={i.code} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Icon name="mail" size={20} color={t.ink2} />
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.bodyLarge, { color: t.ink }]} numberOfLines={1}>{i.email || "Anyone with the code"}</Text>
                <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("{0} · code {1} · until {2}", [i.kind === "parent" ? "Parent" : "Family, view only", i.code, formatDate(i.expires.slice(0, 10))])}</Text>
              </View>
              <Pressable onPress={() => onSend(i)} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 6 }}><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tr("Send")}</Text></Pressable>
              <Pressable onPress={() => Alert.alert(tr("Cancel this invite?"), tr("Its code stops working."), [{ text: tr("Keep it"), style: "cancel" }, { text: tr("Cancel invite"), style: "destructive", onPress: () => act(`inv-${i.code}`, () => cancelInvite(i.code)) }])} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 6 }}>
                {busy === `inv-${i.code}` ? <ActivityIndicator color={t.accent} /> : <Text style={[TYPE.labelLarge, { color: t.danger }]}>{tr("Cancel")}</Text>}
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      {/* blocked */}
      {blocked.length ? (
        <>
          <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 24, marginBottom: 6 }]}>{tr("Blocked")}</Text>
          {blocked.map((b) => (
            <View key={b.email} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <Icon name="lock" size={18} color={t.ink3} />
              <Text style={{ color: t.ink2, flex: 1 }} numberOfLines={1}>{b.email}</Text>
              <Pressable onPress={() => act(`ub-${b.email}`, () => unblockEmail(child.id, b.email))} hitSlop={6} accessibilityRole="button"><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tr("Unblock")}</Text></Pressable>
            </View>
          ))}
        </>
      ) : null}

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 12 }}>{err}</Text> : null}
      <JoinCard />
      {editing ? <PeopleEditor child={child} member={editing} onClose={() => { setEditing(null); load(); }} /> : null}
    </View>
  );
}

function Choice({ icon, title, text, onPress, disabled }: { icon: IconName; title: string; text: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" aria-disabled={disabled}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: disabled ? t.line : t.accent, backgroundColor: t.card, marginBottom: 10, opacity: disabled ? 0.6 : 1 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={22} color={t.onAccentSoft} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.titleMedium, { color: t.ink }]}>{title}</Text>
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 2 }]}>{text}</Text>
      </View>
      {!disabled ? <Icon name="chevron-right" size={22} color={t.ink2} /> : null}
    </Pressable>
  );
}

/** Ticks for the family members whose posts someone may see. */
function PeoplePicker({ child, value, onChange, single }: { child: Child; value: string[]; onChange: (ids: string[]) => void; single?: boolean }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const order = useStore((s) => s.familyOrder[child.id]);
  const family = useMemo(() => orderedFamily(familyOf(relatives, child.id).filter((r) => r.childRef !== child.id), order), [relatives, child.id, order]);
  if (!family.length) {
    return (
      <View style={{ padding: 14, borderRadius: 14, backgroundColor: t.bg2 }}>
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{tr("No one is in {0}'s family list yet. Add them here: family members see the posts they're tagged in.", [child.name])}</Text>
      </View>
    );
  }
  return (
    <View>
      {family.map((r) => {
        const on = value.includes(r.id);
        return (
          <Pressable key={r.id} onPress={() => onChange(single ? (on ? [] : [r.id]) : on ? value.filter((x) => x !== r.id) : [...value, r.id])} accessibilityRole={single ? "radio" : "checkbox"} aria-checked={on}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
            <Icon name={on ? (single ? "check" : "check-square") : single ? "plus" : "square"} size={22} color={on ? t.accent : t.ink3} />
            <MemberAvatar member={r} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{displayName(r)}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{relationLine(r)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The invite, step by step: (family) who they are and whose posts they see, then their email, then a check, then it's made. */
function InviteSteps({ child, kind, onCreated, onCancel }: { child: Child; kind: InviteKind; onCreated: (i: PendingInvite) => void; onCancel: () => void }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const [n, setN] = useState(kind === "family" ? 1 : 2);
  const [who, setWho] = useState<string[]>([]); // family: the person being invited (optional)
  const [people, setPeople] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const names = people.map((id) => relatives.find((r) => r.id === id)).filter(Boolean).map((r) => displayName(r!));
  const whoPerson = who[0] ? relatives.find((r) => r.id === who[0]) : undefined;
  const whoName = whoPerson ? displayName(whoPerson) : "";
  const total = kind === "family" ? 3 : 2;
  const shown = kind === "family" ? n : n - 1;

  const create = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const members = await listMembers(child.id).catch(() => [] as Member[]);
      if (members.some((m) => m.email.toLowerCase() === cleanEmail(email))) throw new Error(tr("{0} can already see {1}'s book.", [cleanEmail(email), child.name]));
      onCreated(await inviteFor(child.id, kind, email, kind === "family" ? people : []));
    } catch (e) {
      setErr(friendlyShareError(e));
    } finally {
      setBusy(false);
    }
  };
  const stepLabel = <Text style={[TYPE.labelMedium, { color: t.ink3, marginBottom: 6 }]}>{tr("Step {0} of {1}", [shown, total])}</Text>;

  return (
    <View>
      {n === 1 ? (
        <>
          {stepLabel}
          <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("Who are you inviting?")}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 8 }]}>{tr("Choose them from {0}'s family (optional), then whose posts they'll see.", [child.name])}</Text>
          <PeoplePicker child={child} value={who} single onChange={(ids) => { setWho(ids); if (ids[0] && !people.includes(ids[0])) setPeople([...people, ids[0]]); }} />
          <AddFamilyMember child={child} onAdded={(id) => { setWho([id]); if (!people.includes(id)) setPeople([...people, id]); }} />
          <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 18 }]}>{tr("They'll see the posts with")}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 8 }]}>{tr("Tick everyone whose posts they may see. Example: Grandma sees the posts with Grandma and Grandpa.")}</Text>
          <PeoplePicker child={child} value={people} onChange={setPeople} />
          {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
          <Btn label={tr("Next")} onPress={() => (people.length ? (setErr(""), setN(2)) : setErr(tr("Tick at least one person whose posts they'll see.")))} style={{ marginTop: 16 }} />
          <Btn label={tr("Cancel")} kind="soft" onPress={onCancel} style={{ marginTop: 8 }} />
        </>
      ) : null}

      {n === 2 ? (
        <>
          {stepLabel}
          <Text style={[TYPE.titleMedium, { color: t.ink }]}>{whoName ? tr("{0}'s email", [whoName]) : tr("Their email")}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 8 }]}>{tr("The invite only works for this email, so no one else can use it. They'll sign in to {0} with it.", [APP_NAME])}</Text>
          <Input value={email} onChangeText={(v) => { setEmail(v); setErr(""); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder={tr("Example: name@gmail.com")} accessibilityLabel={tr("Their email")} />
          {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
          <Btn label={tr("Next")} onPress={() => (isEmail(email) ? (setErr(""), setN(3)) : setErr(tr("Enter their email address, like name@gmail.com.")))} style={{ marginTop: 16 }} />
          <Btn label={tr("Back")} kind="soft" onPress={() => (kind === "family" ? setN(1) : onCancel())} style={{ marginTop: 8 }} />
        </>
      ) : null}

      {n === 3 ? (
        <>
          {stepLabel}
          <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("Check the invite")}</Text>
          <View style={{ backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 14, marginTop: 8, gap: 6 }}>
            <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{kind === "parent" ? (isPet(child) ? tr("Another owner") : tr("The other parent")) : whoName || "A family member"}</Text>
            <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{cleanEmail(email)}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{kindSummary(kind, child.name, names)}</Text>
          </View>
          {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
          <Btn label={busy ? tr("Making the invite…") : tr("Make the invite")} icon="user-plus" onPress={create} disabled={busy} style={{ marginTop: 16 }} />
          <Btn label={tr("Back")} kind="soft" onPress={() => setN(2)} disabled={busy} style={{ marginTop: 8 }} />
        </>
      ) : null}
    </View>
  );
}

/** The invite is made: send it on WhatsApp, by email (to them), with any app, or copy it, and what they'll do next. */
function SendInvite({ child, invite, onDone }: { child: Child; invite: PendingInvite; onDone: () => void }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const [note, setNote] = useState("");
  const link = joinLink(invite.code);
  const names = invite.people.map((id) => relatives.find((r) => r.id === id)).filter(Boolean).map((r) => displayName(r!));
  const message = inviteMessage(invite.kind, child.name, invite.code, link, APP_NAME, invite.email);
  const open = async (url: string, fallback: () => void) => {
    try { await Linking.openURL(url); } catch { fallback(); }
  };
  const others = () => Share.share({ message }).catch(() => undefined);
  // the website: no WhatsApp (a browser can't open it), and other apps only where the browser can share
  const web = Platform.OS === "web";
  const canShare = !web || (typeof navigator !== "undefined" && typeof navigator.share === "function");
  return (
    <View>
      <View style={{ alignItems: "center", backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 18 }}>
        <Icon name="check" size={30} color={t.accent} />
        <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 4 }]}>{tr("The invite is ready")}</Text>
        <Text style={[TYPE.bodySmall, { color: t.ink3, textAlign: "center", marginTop: 2 }]}>{invite.email ? tr("For {0} · ", [invite.email]) : ""}{invite.kind === "parent" ? "parent" : tr("family, sees the posts with {0}", [names.join(", ") || "the people chosen"])}</Text>
        <Text selectable style={{ color: t.ink, fontSize: 34, fontWeight: "700", letterSpacing: 5, marginTop: 10 }}>{invite.code}</Text>
        <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Works once, until {0}", [formatDate(invite.expires.slice(0, 10))])}</Text>
      </View>
      {web ? null : <Btn label={tr("Send on WhatsApp")} icon="message-circle" onPress={() => open(`whatsapp://send?text=${encodeURIComponent(message)}`, () => { setNote(tr("WhatsApp isn't on this phone, so here are the other apps.")); others(); })} style={{ marginTop: 16 }} />}
      <Btn label={tr("Send by email")} icon="mail" kind={web ? "solid" : "line"} onPress={() => open(`mailto:${encodeURIComponent(invite.email ?? "")}?subject=${encodeURIComponent(`${child.name}'s baby book`)}&body=${encodeURIComponent(message)}`, others)} style={{ marginTop: web ? 16 : 10 }} />
      {canShare ? <Btn label={tr("Other apps")} icon="share" kind="line" onPress={others} style={{ marginTop: 10 }} /> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Btn label={tr("Copy link")} icon="copy" kind="soft" onPress={() => { Clipboard.setStringAsync(link); setNote(tr("Link copied.")); }} style={{ flex: 1 }} />
        <Btn label={tr("Copy code")} icon="copy" kind="soft" onPress={() => { Clipboard.setStringAsync(invite.code); setNote(tr("Code copied.")); }} style={{ flex: 1 }} />
      </View>
      {note ? <Text style={{ color: t.accentDeep, fontWeight: "700", textAlign: "center", marginTop: 8 }}>{note}</Text> : null}
      <View style={{ backgroundColor: t.bg2, borderRadius: 16, padding: 14, marginTop: 18, gap: 6 }}>
        <Text style={[TYPE.labelLarge, { color: t.ink2 }]}>{tr("What they do")}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{tr("1. Tap the link you sent (it offers the app if they don't have it).")}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{tr("2. Sign in{0}.", [invite.email ? ` with ${invite.email}` : ""])}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{tr("3. {0}'s book appears on their phone{1}", [child.name, invite.kind === "parent" ? ", and anything either of you adds shows up on both phones." : "."])}</Text>
      </View>
      <Btn label={tr("Done")} onPress={onDone} style={{ marginTop: 18 }} />
    </View>
  );
}

/** Change whose posts a family member sees. */
function PeopleEditor({ child, member, onClose }: { child: Child; member: Member; onClose: () => void }) {
  const t = useTheme();
  const [people, setPeople] = useState<string[]>(member.people);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.accent, padding: 16, marginTop: 16 }}>
      <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("What {0} sees", [member.email])}</Text>
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 8 }]}>{tr("The posts in {0}'s book with any of these people.", [child.name])}</Text>
      <PeoplePicker child={child} value={people} onChange={setPeople} />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 8 }}>{err}</Text> : null}
      <Btn label={busy ? tr("Saving…") : tr("Save")} disabled={busy || !people.length} onPress={async () => { setBusy(true); try { await setMemberPeople(child.id, member.userId, people); onClose(); } catch (e) { setErr(friendlyShareError(e)); } finally { setBusy(false); } }} style={{ marginTop: 12 }} />
      <Btn label={tr("Cancel")} kind="soft" onPress={onClose} style={{ marginTop: 8 }} />
    </View>
  );
}

/** Joining a book with a code someone sent (pasting the whole message works too). */
function JoinCard({ expanded }: { expanded?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(!!expanded);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const clean = normalizeCode(code);
  const join = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await openInvite(clean);
      useStore.getState().showToast(r.outcome === "already"
        ? { title: tr("You already have {0}'s book", [r.name]), body: tr("There was nothing to add, and the code is still free for whoever it was meant for."), tone: "info" }
        : { title: tr("{0}'s book is here", [r.name]), body: tr("Everything in it is on its way to this phone.") });
      router.replace("/");
    } catch (e) {
      setErr(friendlyShareError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 16, marginTop: 24 }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("Join with a code")}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Someone sent you an invite? Enter its code to add their child's book.")}</Text>
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={t.ink2} />
      </Pressable>
      {open ? (
        <>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Input value={code} onChangeText={(v) => { setCode(v); setErr(""); }} autoCapitalize="characters" autoCorrect={false} placeholder={tr("Example: 4F9A2C1B")} style={{ letterSpacing: 3, fontWeight: "700" }} accessibilityLabel={tr("Invite code")} />
            </View>
            <Btn label={tr("Paste")} kind="soft" onPress={async () => setCode(await Clipboard.getStringAsync().catch(() => ""))} />
          </View>
          {code && clean !== code.trim().toUpperCase() && clean.length === 8 ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{tr("Code: {0}", [clean])}</Text> : null}
          {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 8 }}>{err}</Text> : null}
          <Btn label={busy ? tr("Joining…") : tr("Join")} onPress={join} disabled={busy || clean.length !== 8} style={{ marginTop: 12 }} />
        </>
      ) : null}
    </View>
  );
}

/** Adding someone to the family from the invite, for inviting a relative who isn't in the family list yet. */
function AddFamilyMember({ child, onAdded }: { child: Child; onAdded: (id: string) => void }) {
  const t = useTheme();
  const addRelative = useStore((s) => s.addRelative);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const add = () => {
    if (!name.trim() || !relation.trim()) return;
    const id = uid("rel");
    addRelative({ id, name: name.trim(), relation: relation.trim(), childIds: [child.id] });
    onAdded(id);
    setName(""); setRelation(""); setOpen(false);
  };
  if (!open) return <Btn label={tr("Add a family member")} icon="user-plus" kind="line" onPress={() => setOpen(true)} style={{ marginTop: 10 }} />;
  return (
    <View style={{ marginTop: 10, backgroundColor: t.bg2, borderRadius: 14, padding: 12, gap: 8 }}>
      <Text style={[TYPE.titleSmall, { color: t.ink }]}>{tr("Add to {0}'s family", [child.name])}</Text>
      <Input value={name} onChangeText={setName} placeholder={tr("Their name")} maxLength={40} returnKeyType="next" />
      <Input value={relation} onChangeText={setRelation} placeholder={tr("Relationship. Example: Grandma")} maxLength={30} returnKeyType="done" onSubmitEditing={add} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label={tr("Cancel")} kind="soft" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <Btn label={tr("Add")} onPress={add} disabled={!name.trim() || !relation.trim()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
