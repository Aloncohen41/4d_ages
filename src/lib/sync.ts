import { fileBytes, fileExists, fileSize, localFilesReady, saveFromUrl } from "./localFiles";
import { SITE_URL } from "../brand";
import { supabase } from "./supabase";
import { State, useStore } from "./store";
import { personTag, relationLabel, upsertTagIn } from "./tags";
import { kinColumns } from "./syncMerge";
import { deleteFile } from "./media";
import { Child, MediaItem } from "./types";
import { classicToRow, foodTryToRow, isDirty, memoryToRow, mergeChild, mergeClassics, mergeDefs, mergeFoodTries, mergeMemories, mergeRelatives, newestCursor, relativesToPush, tagsInRow, petColumns, petFromRow } from "./syncMerge";
import { classicMedia } from "./classics";
import { smallerVideo } from "./videoExport";
import { loadReactions } from "./reactions";

import { tr } from "./i18n";
const BUCKET = "media";
const MAX_UPLOAD_BYTES = 45 * 1024 * 1024; // Supabase's default per-file limit is 50 MB

/* ---------- small helpers ---------- */

let applying = false;
/** True while sync itself is writing to the store (so the auto-sync trigger can ignore it). */
export const isApplying = () => applying;
function apply(fn: (s: State) => Partial<State>) {
  applying = true;
  try {
    useStore.setState(fn);
  } finally {
    applying = false;
  }
}

function client() {
  if (!supabase) throw new Error(tr("Sharing isn't set up yet — see SHARING.md."));
  return supabase;
}

async function me() {
  const { data } = await client().auth.getSession();
  if (!data.session) throw new Error(tr("Please sign in first."));
  return data.session.user;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", "3gp": "video/3gpp", webm: "video/webm", m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg", amr: "audio/amr" };
const extOf = (uri: string) => (uri.split("?")[0].split(".").pop() || "bin").toLowerCase().slice(0, 5);

/**
 * Upload a local file; returns its cloud path, or null if it's missing or too big. A video too big for the account is first copied
 * smaller (720p, see VideoShrinker) and the copy uploaded, so it still reaches the other parent and the website; the original on the
 * phone stays full size.
 */
async function upload(childId: string, key: string, uri: string): Promise<string | null> {
  if (!fileExists(uri)) return null;
  if (fileSize(uri) > MAX_UPLOAD_BYTES) {
    if (!/^(mp4|mov|3gp|webm|mkv|m4v)$/.test(extOf(uri))) return null;
    progress(tr("Making a big video smaller to upload…"));
    const small = await smallerVideo(uri);
    if (!small) return null;
    try {
      return fileExists(small) && fileSize(small) <= MAX_UPLOAD_BYTES ? await upload(childId, key, small) : null;
    } finally {
      deleteFile(small);
    }
  }
  const ext = extOf(uri);
  const path = `${childId}/${key}.${ext}`;
  const bytes = await fileBytes(uri);
  const { error } = await client().storage.from(BUCKET).upload(path, bytes, { upsert: true, contentType: MIME[ext] || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return path;
}

async function download(path: string, name: string): Promise<string> {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message || tr("Couldn't get a download link"));
  return saveFromUrl(data.signedUrl, name, extOf(path));
}

/** A short-lived link to a file kept in the account (an hour), for reading it straight from there. */
export async function mediaLink(path: string): Promise<string> {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message || tr("Couldn't get a download link"));
  return data.signedUrl;
}

const progress = (text?: string) => useStore.getState().setSync({ progress: text });

function check(...results: { error: { message: string } | null }[]) {
  for (const r of results) if (r.error) throw new Error(r.error.message);
}

/* ---------- sharing a child ---------- */

/** The app's sample family (for exploring before signing in) is never put in an account. */
export const isSampleChild = (id: string) => id === "maya" || id === "leo";

/** Put a child in the cloud and make this phone its first member. */
export async function shareChild(childId: string): Promise<void> {
  if (isSampleChild(childId)) throw new Error(tr("The sample family can't be shared. Add your own child to share their book."));
  const sb = client();
  const user = await me();
  const child = useStore.getState().kids.find((k) => k.id === childId);
  if (!child) throw new Error(tr("Child not found"));

  const ts = child.updatedAt ?? Date.now();
  const { error: e1 } = await sb.from("children").upsert({
    id: child.id, name: child.name, birth: child.birth, theme: child.theme, emoji: child.emoji,
    avatar_photo_id: child.avatarPhotoId ?? null, growth_ref: child.growthRef ?? null, gender: child.gender ?? null, expecting: !!child.expecting, ...petColumns(child), owner_id: user.id, client_ts: ts,
  });
  if (e1) throw new Error(e1.message);
  // already a member (a first try that stopped half way, or sharing again): nothing to change
  const { error: e2 } = await sb.from("child_members").upsert({ child_id: child.id, user_id: user.id, role: "owner", email: user.email ?? null }, { onConflict: tr("child_id,user_id"), ignoreDuplicates: true });
  if (e2) throw new Error(e2.message);

  apply((s) => ({ kids: s.kids.map((k) => (k.id === childId ? { ...k, shared: true, updatedAt: ts, syncedTs: ts } : k)) }));
  await syncChild(childId);
}

/**
 * A code for someone to join with. Without `people` they get full access (they see and change everything, like a parent); with it they can
 * only look, and only at the posts with those family members (Grandma sees the posts with Grandma and Grandpa).
 */
export async function createInvite(childId: string, people?: string[], email?: string): Promise<string> {
  const args: Record<string, unknown> = { p_child: childId };
  if (people) args.p_people = people;
  if (email?.trim()) args.p_email = email.trim().toLowerCase(); // only this email can use the code
  const { data, error } = await client().rpc("create_invite", args);
  if (error) throw new Error(error.message);
  return String(data);
}

/** The other parent enters a code: join the child, then pull everything down. */
export async function joinWithCode(code: string): Promise<Child> {
  const { data, error } = await client().rpc("join_child", { p_code: code.trim() });
  if (error) throw new Error(error.message);
  const child = { ...childFromRow(data as ChildRow), ...(await myAccess((data as ChildRow).id)) };
  const existing = useStore.getState().kids.find((k) => k.id === child.id);
  apply((s) => ({
    kids: existing ? s.kids.map((k) => (k.id === child.id ? { ...k, shared: true, role: child.role, viewPeople: child.viewPeople } : k)) : [...s.kids, child],
    activeId: child.id,
  }));
  await syncChild(child.id);
  return child;
}

/**
 * Opens an invite: if this account can already see the book (it's yours, or you were invited before), nothing is used up and the book is
 * simply shown; otherwise the book is joined. A database without check_invite yet just joins, as before.
 */
export async function openInvite(code: string): Promise<{ outcome: "already" | "joined"; childId: string; name: string }> {
  const { data } = await client().rpc("check_invite", { p_code: code.trim() });
  const check = data as { already?: boolean; child_id?: string; name?: string } | null;
  if (check?.already && check.child_id) {
    const here = useStore.getState().kids.some((k) => k.id === check.child_id);
    if (!here) await attachAndRestore(); // on another phone of theirs: bring it down
    if (useStore.getState().kids.some((k) => k.id === check.child_id)) useStore.getState().setActive(check.child_id);
    return { outcome: "already", childId: check.child_id, name: check.name ?? "This" };
  }
  const child = await joinWithCode(code);
  return { outcome: "joined", childId: child.id, name: child.name };
}

/** Stop syncing on this phone. Everything already on the phone stays; the other parent keeps their copy. */
export async function leaveChild(childId: string): Promise<void> {
  const user = await me();
  const { error } = await client().from("child_members").delete().eq("child_id", childId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  apply((s) => ({
    kids: s.kids.map((k) => (k.id === childId ? { ...k, shared: false } : k)),
    tombstones: s.tombstones.filter((t) => t.childId !== childId),
  }));
}

export interface Member {
  userId: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  people: string[]; // a viewer's people
  me: boolean;
}

export async function listMembers(childId: string): Promise<Member[]> {
  const user = await me();
  const { data, error } = await client().from("child_members").select("user_id, email, role, people").eq("child_id", childId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: { user_id: string; email: string | null; role: string; people?: string[] | null }) => ({
    userId: m.user_id, email: m.email || "(unknown)", role: (m.role === "owner" || m.role === "viewer" ? m.role : "editor") as Member["role"], people: m.people ?? [], me: m.user_id === user.id,
  }));
}

/** A book has at most two parents; family members who can only view don't count. */
export const MAX_PARENTS = 2;
/** A pet's book can have up to six owners (it needs less guarding than a child's). */
export const MAX_PET_OWNERS = 6;
export const maxParents = (c?: { kind?: string } | null) => (c?.kind === "pet" ? MAX_PET_OWNERS : MAX_PARENTS);
export const parentsOf = (members: Member[]) => members.filter((m) => m.role !== "viewer");

/**
 * Take someone out of a child's book (the owner may remove anyone; the other parent may remove viewers). They lose access at once. With
 * `block`, they can't join again with any code, until they're unblocked.
 */
export async function removeMember(childId: string, userId: string, block = false): Promise<void> {
  const { error } = await client().rpc("remove_member", block ? { p_child: childId, p_user: userId, p_block: true } : { p_child: childId, p_user: userId });
  if (error) throw new Error(error.message);
}

/** The emails blocked from a child's book. */
export async function listBlocked(childId: string): Promise<{ email: string; at: string }[]> {
  const { data, error } = await client().from("child_blocks").select("email, blocked_at").eq("child_id", childId).order("blocked_at", { ascending: false });
  if (error) return []; // a database not yet updated has no blocks
  return (data ?? []).map((r: { email: string; blocked_at: string }) => ({ email: r.email, at: r.blocked_at }));
}

/** Block an email from a child's book (even before they've joined), or let them in again. */
export async function blockEmail(childId: string, email: string): Promise<void> {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error(tr("Enter an email address."));
  const { error } = await client().rpc("block_email", { p_child: childId, p_email: email.trim() });
  if (error) throw new Error(error.message);
}
export async function unblockEmail(childId: string, email: string): Promise<void> {
  const { error } = await client().rpc("unblock_email", { p_child: childId, p_email: email });
  if (error) throw new Error(error.message);
}

/** Change whose posts a view-only family member sees. */
export async function setMemberPeople(childId: string, userId: string, people: string[]): Promise<void> {
  const { error } = await client().rpc("set_member_people", { p_child: childId, p_user: userId, p_people: people });
  if (error) throw new Error(error.message);
}

/**
 * The code to show for a child: a still-valid code this account already made (so the same code shows each time the screen opens), or a new one.
 * Full access codes only (view-only invites are made on request).
 */
export async function currentInvite(childId: string): Promise<{ code: string; expires: string }> {
  const user = await me();
  const { data } = await client().from("invites").select("code, expires_at").eq("child_id", childId).eq("created_by", user.id).eq("role", "editor")
    .gt("expires_at", new Date(Date.now() + 86400000).toISOString()).order("expires_at", { ascending: false }).limit(1);
  const found = (data ?? [])[0] as { code: string; expires_at: string } | undefined;
  if (found) return { code: found.code, expires: found.expires_at };
  const code = await createInvite(childId);
  return { code, expires: new Date(Date.now() + 7 * 86400000).toISOString() };
}

export interface PendingInvite {
  code: string;
  kind: "parent" | "family";
  email?: string;
  people: string[];
  expires: string;
}

/** Invites this account made for a child that haven't been used yet (and haven't expired). */
export async function listInvites(childId: string): Promise<PendingInvite[]> {
  const user = await me();
  const { data, error } = await client().from("invites").select("code, role, email, people, expires_at").eq("child_id", childId).eq("created_by", user.id)
    .gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { code: string; role: string | null; email: string | null; people: string[] | null; expires_at: string }[])
    .map((r) => ({ code: r.code, kind: r.role === "viewer" ? "family" : "parent", email: r.email ?? undefined, people: r.people ?? [], expires: r.expires_at }));
}

/** Cancel an invite: its code stops working. */
export async function cancelInvite(code: string): Promise<void> {
  const { error } = await client().from("invites").delete().eq("code", code);
  if (error) throw new Error(error.message);
}

/** Make sure a child is in the cloud and this account is a member (a first try that stopped half way is finished here). */
export async function ensureShared(childId: string): Promise<void> {
  const child = useStore.getState().kids.find((k) => k.id === childId);
  if (!child) throw new Error(tr("This child isn't on this phone any more."));
  const list = await listMembers(childId).catch(() => [] as Member[]);
  if (!child.shared || !list.some((m) => m.me)) await shareChild(childId);
}

/**
 * An invite for one person: a still-valid one made earlier for the same email and kind is reused (sending twice never makes two codes);
 * otherwise a new one.
 */
export async function inviteFor(childId: string, kind: "parent" | "family", email: string, people: string[] = []): Promise<PendingInvite> {
  const clean = email.trim().toLowerCase();
  const existing = (await listInvites(childId)).find((x) => x.kind === kind && x.email === clean && (kind === "parent" || x.people.slice().sort().join() === people.slice().sort().join()));
  if (existing) return existing;
  const code = await createInvite(childId, kind === "family" ? people : undefined, clean);
  return { code, kind, email: clean, people, expires: new Date(Date.now() + 7 * 86400000).toISOString() };
}

/** The link that opens the app (or offers it) and joins the book: tapped in WhatsApp, email or any other app. */
/** The share link: a short page that opens the app with the code (the older …/join/?code= links still work). */
export const JOIN_PAGE = `${SITE_URL}j/`; // (old links on the GitHub Pages address forward here)
export const joinLink = (code: string) => `${JOIN_PAGE}?c=${encodeURIComponent(code)}`;

/** This account's access to a child: its role, and for a viewer the people whose posts they see. */
async function myAccess(childId: string): Promise<Pick<Child, "role" | "viewPeople">> {
  const user = await me();
  const { data, error } = await client().from("child_members").select("role, people").eq("child_id", childId).eq("user_id", user.id).maybeSingle();
  if (error || !data) return {};
  const role = data.role === "viewer" ? "viewer" : data.role === "owner" ? "owner" : "editor";
  return { role, viewPeople: role === "viewer" ? ((data.people as string[] | null) ?? []) : undefined };
}

/* ---------- the sync itself ---------- */

export async function syncChild(childId: string): Promise<void> {
  const sb = client();
  await me();
  const st = useStore.getState();
  const cursor = st.syncMeta[childId]?.cursor;

  /* 1 ── PULL: what changed in the cloud since last time */
  progress(tr("Checking for new memories…"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const since = (q: any) => (cursor ? q.gte("updated_at", cursor) : q);
  const access = await myAccess(childId);
  const viewer = access.role === "viewer";
  const [cRes, mRes, dRes, rRes, kRes, fRes] = await Promise.all([
    sb.from("children").select("*").eq("id", childId).maybeSingle(),
    since(sb.from("memories").select("*").eq("child_id", childId)),
    since(sb.from("custom_defs").select("*").eq("child_id", childId)),
    sb.from("relatives").select("*").eq("child_id", childId),
    viewer ? Promise.resolve({ data: [], error: null }) : since(sb.from("classics").select("*").eq("child_id", childId)),
    // First foods are health information: only parents and editors see them
    viewer ? Promise.resolve({ data: [], error: null }) : since(sb.from("food_tries").select("*").eq("child_id", childId)),
  ]);
  // a database not yet updated for First foods (npm run db:setup): everything else still syncs, and the tries wait on this phone
  const noFoods = !!fRes.error && /food_tries/i.test(fRes.error.message) && /exist|schema cache/i.test(fRes.error.message);
  if (fRes.error && !noFoods) throw new Error(fRes.error.message);
  const fRows = (noFoods ? [] : fRes.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  // a database not yet updated for Classics (npm run db:setup) has no classics table: everything else still syncs
  const noClassics = !!kRes.error && /classics/i.test(kRes.error.message) && /exist|schema cache/i.test(kRes.error.message);
  check(cRes, mRes, dRes, rRes, noClassics ? { error: null } : kRes);
  if (!cRes.data) {
    // removed from the book on the other phone (or the book was deleted): it leaves this phone too
    const name = useStore.getState().kids.find((k) => k.id === childId)?.name ?? tr("This child");
    useStore.getState().forgetChild(childId);
    useStore.getState().setSync({ notice: tr("{0}'s book isn't shared with you any more, so it was taken off this phone.", [name]) });
    return;
  }

  const mRows = mRes.data ?? [], dRows = dRes.data ?? [], rRows = rRes.data ?? [], kRows = (noClassics ? [] : kRes.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const removedFiles: string[] = [];
  apply((s) => {
    const relatives = mergeRelatives(s.relatives, rRows, childId);
    let tags = s.tags;
    for (const r of mRows) for (const t of tagsInRow(r)) tags = upsertTagIn(tags, t);
    for (const r of relatives) if (tags.some((t) => t.relatedFamilyMemberId === r.id)) tags = upsertTagIn(tags, personTag(r)); // show their current name
    return {
      kids: s.kids.map((k) => (k.id === childId ? { ...mergeChild(k, cRes.data), ...access } : k)),
      memories: mergeMemories(s.memories, mRows, (m) => m.media.forEach((x) => x.uri && removedFiles.push(x.uri))),
      classics: mergeClassics(s.classics, kRows, (e) => classicMedia(e).forEach((x) => x.uri && removedFiles.push(x.uri))),
      customDefs: { ...s.customDefs, [childId]: mergeDefs(s.customDefs[childId] || [], dRows) },
      foodTries: mergeFoodTries(s.foodTries, fRows),
      relatives,
      tags,
    };
  });
  removedFiles.forEach(deleteFile);
  const newCursor = newestCursor(cursor, [cRes.data], mRows, dRows, kRows, fRows);

  /* 2 ── PUSH: what changed on this phone (a viewer only looks, so nothing is sent) */
  if (!viewer) await pushChild(childId, rRows, !noClassics, !noFoods);

  /* 3 ── DOWNLOAD: pictures and videos we don't have yet, and the hearts and comments */
  await loadReactions(childId);
  await downloadMissing(childId);

  apply((s) => ({ syncMeta: { ...s.syncMeta, [childId]: { cursor: newCursor, lastSync: new Date().toISOString() } } }));
}

async function pushChild(childId: string, remoteRelatives: { id: string; client_ts?: number; child_ref?: string | null }[], classicsReady = true, foodsReady = true) {
  const sb = client();
  let s = useStore.getState();

  // the child's own details
  const child = s.kids.find((k) => k.id === childId);
  if (child && isDirty(child)) {
    const ts = child.updatedAt ?? Date.now();
    const { error } = await sb.from("children").update({
      name: child.name, birth: child.birth, theme: child.theme, emoji: child.emoji,
      avatar_photo_id: child.avatarPhotoId ?? null, growth_ref: child.growthRef ?? null, gender: child.gender ?? null, expecting: !!child.expecting, ...petColumns(child), client_ts: ts,
    }).eq("id", childId);
    if (error) throw new Error(error.message);
    apply((st) => ({ kids: st.kids.map((k) => (k.id === childId ? { ...k, updatedAt: ts, syncedTs: ts } : k)) }));
  }

  // memories of every type — the same code path for all of them
  const dirty = s.memories.filter((m) => m.childId === childId && isDirty(m));
  const toUpload = dirty.reduce((n, m) => n + m.media.filter((x) => x.uri && !x.path).length, 0);
  let uploaded = 0;
  for (let i = 0; i < dirty.length; i += 25) {
    const batch = dirty.slice(i, i + 25);
    const rows: Record<string, unknown>[] = [];
    const stamped: { id: string; ts: number; media: MediaItem[] }[] = [];
    for (const m of batch) {
      const media: MediaItem[] = [];
      for (const x of m.media) {
        let path = x.path;
        if (!path && x.uri) {
          progress(tr("Uploading {0} of {1}…", [++uploaded, toUpload]));
          path = (await upload(childId, `${m.id}-${x.id}`, x.uri)) ?? undefined;
        }
        media.push({ ...x, path });
      }
      const ts = m.updatedAt ?? Date.now();
      stamped.push({ id: m.id, ts, media });
      rows.push(memoryToRow({ ...m, media }, useStore.getState().tags, ts));
    }
    const { error } = await sb.from("memories").upsert(rows);
    if (error) throw new Error(error.message);
    apply((st) => ({
      memories: st.memories.map((m) => {
        const done = stamped.find((x) => x.id === m.id);
        return done ? { ...m, media: m.media.map((x) => ({ ...x, path: done.media.find((y) => y.id === x.id)?.path ?? x.path })), updatedAt: done.ts, syncedTs: done.ts } : m;
      }),
    }));
  }

  // custom milestones
  s = useStore.getState();
  const defs = (s.customDefs[childId] || []).filter(isDirty);
  if (defs.length) {
    const rows = defs.map((d) => ({ child_id: childId, id: d.id, label: d.label, emoji: d.emoji, hint: d.hint, category: d.category ?? null, client_ts: d.updatedAt ?? Date.now(), deleted: false }));
    const { error } = await sb.from("custom_defs").upsert(rows, { onConflict: tr("child_id,id") });
    if (error) throw new Error(error.message);
    apply((st) => ({ customDefs: { ...st.customDefs, [childId]: (st.customDefs[childId] || []).map((d) => { const r = rows.find((x) => x.id === d.id); return r ? { ...d, updatedAt: r.client_ts, syncedTs: r.client_ts } : d; }) } }));
  }

  // family members: send any the cloud copy of this child doesn't have yet (or has an older version of)
  const known = new Map(remoteRelatives.map((r) => [r.id, Number(r.client_ts) || 0]));
  const refs = new Map(remoteRelatives.map((r) => [r.id, r.child_ref ?? null]));
  const rels = relativesToPush(s.relatives, childId, known, refs); // only this child's family
  if (rels.length) {
    const { error } = await sb.from("relatives").upsert(
      rels.map((r) => ({ child_id: childId, id: r.id, name: r.name, relation: relationLabel(r), custom_label: null, nickname: r.nickname ?? null, description: r.description ?? null, child_ref: r.childRef ?? null, ...kinColumns(r), client_ts: r.updatedAt ?? 0, deleted: false })),
      { onConflict: tr("child_id,id") }
    );
    if (error) throw new Error(error.message);
  }

  // the fill-in pages, with their pictures
  s = useStore.getState();
  for (const e of classicsReady ? s.classics.filter((c) => c.childId === childId && isDirty(c)) : []) {
    const photos: typeof e.photos = {};
    for (const [field, list] of Object.entries(e.photos)) {
      photos[field] = [];
      for (const x of list) {
        let path = x.path;
        if (!path && x.uri) {
          progress(tr("Uploading pictures…"));
          path = (await upload(childId, `classic-${e.id}-${x.id}`, x.uri)) ?? undefined;
        }
        photos[field].push({ ...x, path });
      }
    }
    const ts = e.updatedAt ?? Date.now();
    const { error } = await sb.from("classics").upsert(classicToRow({ ...e, photos }, ts), { onConflict: tr("child_id,id") });
    if (error) throw new Error(error.message);
    apply((st) => ({
      classics: st.classics.map((c) => (c.childId === childId && c.id === e.id && (c.updatedAt ?? 0) === ts
        ? { ...c, photos: Object.fromEntries(Object.entries(c.photos).map(([k, l]) => [k, l.map((x) => ({ ...x, path: photos[k]?.find((y) => y.id === x.id)?.path ?? x.path }))])), syncedTs: ts }
        : c)),
    }));
  }

  // First foods: the tries made or changed on this phone
  s = useStore.getState();
  const foods = foodsReady ? s.foodTries.filter((x) => x.childId === childId && isDirty(x)) : [];
  if (foods.length) {
    const rows = foods.map((x) => foodTryToRow(x, x.updatedAt ?? Date.now()));
    const { error } = await sb.from("food_tries").upsert(rows, { onConflict: tr("child_id,id") });
    if (error) throw new Error(error.message);
    apply((st) => ({ foodTries: st.foodTries.map((x) => { const r = rows.find((y) => y.id === x.id && y.child_id === x.childId); return r && (x.updatedAt ?? 0) === r.client_ts ? { ...x, syncedTs: r.client_ts } : x; }) }));
  }

  // things deleted on this phone
  s = useStore.getState();
  const tombs = s.tombstones.filter((t) => t.childId === childId && (foodsReady || t.table !== "food_tries"));
  for (const t of tombs) {
    const q = sb.from(t.table).update({ deleted: true, client_ts: t.ts });
    const { error } = t.table === "memories" ? await q.eq("id", t.id).eq("child_id", childId) : await q.eq("child_id", childId).eq("id", t.id);
    if (error) throw new Error(error.message);
    if (t.paths?.length) await sb.storage.from(BUCKET).remove(t.paths);
  }
  if (tombs.length) apply((st) => ({ tombstones: st.tombstones.filter((t) => !tombs.includes(t)) }));
}

async function downloadMissing(childId: string) {
  await localFilesReady; // (the website reads its list of kept files first)
  const s = useStore.getState();
  const jobs: { memoryId: string; mediaId: string; path: string }[] = [];
  for (const m of s.memories) {
    if (m.childId !== childId) continue;
    for (const x of m.media) if (x.path && !fileExists(x.uri)) jobs.push({ memoryId: m.id, mediaId: x.id, path: x.path });
  }
  const classicJobs: { id: string; field: string; mediaId: string; path: string }[] = [];
  for (const e of s.classics) {
    if (e.childId !== childId) continue;
    for (const [field, list] of Object.entries(e.photos)) for (const x of list) if (x.path && !fileExists(x.uri)) classicJobs.push({ id: e.id, field, mediaId: x.id, path: x.path });
  }
  for (const j of classicJobs) {
    try {
      const uri = await download(j.path, `classic-${j.id}-${j.mediaId}`);
      apply((st) => ({
        classics: st.classics.map((c) => (c.childId === childId && c.id === j.id
          ? { ...c, photos: { ...c.photos, [j.field]: (c.photos[j.field] || []).map((x) => (x.id === j.mediaId ? { ...x, uri } : x)) } }
          : c)),
      }));
    } catch {
      /* retried next time */
    }
  }
  let n = 0;
  for (const j of jobs) {
    progress(tr("Downloading {0} of {1}…", [++n, jobs.length]));
    try {
      const uri = await download(j.path, `${j.memoryId}-${j.mediaId}`);
      apply((st) => ({ memories: st.memories.map((m) => (m.id === j.memoryId ? { ...m, media: m.media.map((x) => (x.id === j.mediaId ? { ...x, uri } : x)) } : m)) }));
    } catch {
      /* one missing file shouldn't stop the rest — it's retried next time */
    }
  }
}

/* ---------- the account: every child is kept in it ---------- */

interface ChildRow { id: string; name: string; birth: string; theme: string; emoji: string; avatar_photo_id?: string | null; growth_ref?: string | null; gender?: string | null; expecting?: boolean | null; client_ts?: number; kind?: string | null; species?: string | null; breed?: string | null; dog_size?: string | null; birth_approx?: boolean | null; gotcha_day?: string | null }

/** A child as the cloud sends it. */
function childFromRow(row: ChildRow): Child {
  return {
    id: row.id, name: row.name, birth: String(row.birth), theme: (row.theme as Child["theme"]) || "pink", emoji: row.emoji || "🐣",
    avatarPhotoId: row.avatar_photo_id ?? undefined, growthRef: (row.growth_ref as Child["growthRef"]) ?? undefined,
    gender: (row.gender as Child["gender"]) ?? undefined,
    ...(row.expecting ? { expecting: true } : {}),
    ...Object.fromEntries(Object.entries(petFromRow(row)).filter(([, v]) => v !== undefined)),
    shared: true, updatedAt: Number(row.client_ts) || 0, syncedTs: Number(row.client_ts) || 0,
  };
}

/** True when nothing on this phone is waiting to go to the cloud (so it is safe to hand the phone to another account). */
export function everythingSynced(s: State = useStore.getState()): boolean {
  const kids = s.kids;
  if (kids.some((k) => !k.shared || isDirty(k))) return false;
  const shared = new Set(kids.map((k) => k.id));
  const mine = (childId: string) => shared.has(childId) && s.kids.find((k) => k.id === childId)?.role !== "viewer";
  return !s.memories.some((m) => mine(m.childId) && isDirty(m)) && !s.classics.some((c) => mine(c.childId) && isDirty(c)) && !s.foodTries.some((x) => mine(x.childId) && isDirty(x)) && !s.tombstones.length;
}

/**
 * Signed in: every child on this phone is saved to the account (children added before accounts existed, or while offline, are uploaded now),
 * and every child the account already has elsewhere is brought down (a new phone, or after signing out and in again).
 */
export async function attachAndRestore(): Promise<void> {
  const sb = client();
  await me();
  const local = useStore.getState().kids;
  for (const k of local.filter((x) => !x.shared && !isSampleChild(x.id))) await shareChild(k.id);

  const { data, error } = await sb.from("children").select("*");
  if (error) throw new Error(error.message);
  const have = new Set(useStore.getState().kids.map((k) => k.id));
  const missing: Child[] = [];
  for (const r of ((data ?? []) as ChildRow[]).filter((x) => !have.has(x.id))) missing.push({ ...childFromRow(r), ...(await myAccess(r.id)) });
  if (missing.length) {
    apply((s) => ({ kids: [...s.kids, ...missing], activeId: s.activeId || missing[0].id }));
    for (const k of missing) await syncChild(k.id);
  }
}

/** Every file kept in the cloud for a child (the storage keeps one folder per child). */
async function cloudFiles(childId: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client().storage.from(BUCKET).list(childId, { limit: 1000, offset });
    if (error) throw new Error(error.message);
    out.push(...(data ?? []).map((f) => `${childId}/${f.name}`));
    if (!data || data.length < 1000) return out;
  }
}

/**
 * A profile is being deleted: their sibling entry ("Sister", "Our dog") leaves every family it's in, on this phone and in the cloud, so it
 * never lingers in the other children's families or books.
 */
async function leaveFamilies(childId: string) {
  const st = useStore.getState();
  const me = st.relatives.find((r) => r.childRef === childId);
  if (!me) return;
  const ts = Date.now();
  const families = (me.childIds ?? st.kids.map((k) => k.id)).filter((id) => id !== childId && st.kids.find((k) => k.id === id)?.shared && st.kids.find((k) => k.id === id)?.role !== "viewer");
  if (families.length) {
    await client().from("relatives").upsert(
      families.map((fam) => ({ child_id: fam, id: me.id, name: me.name, relation: me.relation, custom_label: null, nickname: null, description: null, child_ref: childId, client_ts: ts, deleted: true })),
      { onConflict: tr("child_id,id") },
    );
  }
  st.removeRelative(me.id);
}

/** What deleting a child's profile will do, so the parent is told before they confirm. */
export type DeleteOutcome = "deleted" | "handed" | "left";

/**
 * What deleting this profile would do: delete the book for everyone (you created it and no other parent is in it), hand it to the other
 * parent (you created it, they're in it too), or just take it off your account (someone else created it). `other` is the other parent's email.
 */
export async function deleteChildPlan(childId: string): Promise<{ outcome: DeleteOutcome; other?: string }> {
  const kid = useStore.getState().kids.find((k) => k.id === childId);
  if (!kid?.shared || !supabase) return { outcome: "deleted" }; // only on this phone
  const members = await listMembers(childId);
  const mine = members.find((m) => m.me);
  const otherParent = members.find((m) => !m.me && m.role !== "viewer");
  if (mine?.role !== "owner") return { outcome: "left", other: otherParent?.email };
  return otherParent ? { outcome: "handed", other: otherParent.email } : { outcome: "deleted" };
}

/**
 * Deletes a child's profile from this account (see deleteChildPlan): from the cloud as well when no other parent shares it (with its photos),
 * otherwise only your access. Then it is taken off this phone.
 */
export async function deleteChild(childId: string): Promise<DeleteOutcome> {
  const kid = useStore.getState().kids.find((k) => k.id === childId);
  if (kid?.shared && supabase) {
    const plan = await deleteChildPlan(childId);
    if (plan.outcome === "deleted") {
      // the photos first, while this account may still remove them
      const files = await cloudFiles(childId);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await client().storage.from(BUCKET).remove(files.slice(i, i + 100));
        if (error) throw new Error(error.message);
      }
    }
    if (plan.outcome === "deleted") await leaveFamilies(childId);
    const { data, error } = await client().rpc("delete_child", { p_child: childId });
    if (error) throw new Error(/function .*delete_child/i.test(error.message) ? tr("The database needs the latest setup (npm run db:setup) before a profile can be deleted.") : error.message);
    useStore.getState().forgetChild(childId);
    return (data as DeleteOutcome) ?? plan.outcome;
  }
  useStore.getState().forgetChild(childId);
  return "deleted";
}

/**
 * Deletes the account and its data. Children only this account can see are deleted with their photos; a child shared with another parent is
 * handed over to them instead (it is their book too). Then the account itself is removed. The caller clears the phone and signs out.
 */
export async function deleteAccountData(): Promise<void> {
  const sb = client();
  const user = await me();
  const { data: owned, error } = await sb.from("children").select("id").eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  for (const { id } of (owned ?? []) as { id: string }[]) {
    const { data: members, error: e2 } = await sb.from("child_members").select("user_id").eq("child_id", id);
    if (e2) throw new Error(e2.message);
    if ((members ?? []).some((m: { user_id: string }) => m.user_id !== user.id)) continue; // the other parent keeps it
    const files = await cloudFiles(id);
    for (let i = 0; i < files.length; i += 100) {
      const { error: e3 } = await sb.storage.from(BUCKET).remove(files.slice(i, i + 100));
      if (e3) throw new Error(e3.message);
    }
  }
  const { error: e4 } = await sb.rpc("delete_my_account");
  if (e4) throw new Error(/function .*delete_my_account/i.test(e4.message) ? tr("The database needs the latest setup (npm run db:setup) before accounts can be deleted.") : e4.message);
}

/* ---------- running it ---------- */

let current: Promise<void> | null = null;

/** Sync every shared child. Safe to call often: overlapping calls share one run. */
export function syncAll(): Promise<void> {
  if (current) return current;
  const p = (async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const st = useStore.getState();
    if (!data.session || st.preview || !st.kids.length) return;
    useStore.getState().setSync({ busy: true, error: undefined, progress: undefined });
    try {
      // a child added since the last run (or while offline) is saved to the account first
      for (const k of useStore.getState().kids.filter((x) => !x.shared && !isSampleChild(x.id))) await shareChild(k.id);
      for (const k of useStore.getState().kids.filter((x) => x.shared)) await syncChild(k.id);
      useStore.getState().setSync({ busy: false, error: undefined, at: Date.now(), progress: undefined });
    } catch (e) {
      useStore.getState().setSync({ busy: false, error: msg(e), progress: undefined });
    }
  })();
  current = p;
  p.finally(() => {
    if (current === p) current = null;
  });
  return p;
}
