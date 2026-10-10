import { Directory, File, Paths } from "expo-file-system";
import { supabase } from "./supabase";
import { State, useStore } from "./store";
import { personTag, relationLabel, upsertTagIn } from "./tags";
import { deleteFile } from "./media";
import { Child, MediaItem } from "./types";
import { isDirty, memoryToRow, mergeChild, mergeDefs, mergeMemories, mergeRelatives, newestCursor, relativesToPush, tagsInRow } from "./syncMerge";

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
  if (!supabase) throw new Error("Sharing isn't set up yet — see SHARING.md.");
  return supabase;
}

async function me() {
  const { data } = await client().auth.getSession();
  if (!data.session) throw new Error("Please sign in first.");
  return data.session.user;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime", "3gp": "video/3gpp", webm: "video/webm" };
const extOf = (uri: string) => (uri.split("?")[0].split(".").pop() || "bin").toLowerCase().slice(0, 5);

/** Upload a local file; returns its cloud path, or null if it's missing / too big. */
async function upload(childId: string, key: string, uri: string): Promise<string | null> {
  const f = new File(uri);
  if (!f.exists || f.size > MAX_UPLOAD_BYTES) return null;
  const ext = extOf(uri);
  const path = `${childId}/${key}.${ext}`;
  const bytes = await f.bytes();
  const { error } = await client().storage.from(BUCKET).upload(path, bytes, { upsert: true, contentType: MIME[ext] || "application/octet-stream" });
  if (error) throw new Error(error.message);
  return path;
}

async function download(path: string, name: string): Promise<string> {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message || "Couldn't get a download link");
  const dir = new Directory(Paths.document, "media");
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${name}.${extOf(path)}`);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(data.signedUrl, dest);
  return file.uri;
}

const progress = (text?: string) => useStore.getState().setSync({ progress: text });

function check(...results: { error: { message: string } | null }[]) {
  for (const r of results) if (r.error) throw new Error(r.error.message);
}

/* ---------- sharing a child ---------- */

/** Put a child in the cloud and make this phone its first member. */
export async function shareChild(childId: string): Promise<void> {
  const sb = client();
  const user = await me();
  const child = useStore.getState().kids.find((k) => k.id === childId);
  if (!child) throw new Error("Child not found");

  const ts = child.updatedAt ?? Date.now();
  const { error: e1 } = await sb.from("children").upsert({
    id: child.id, name: child.name, birth: child.birth, theme: child.theme, emoji: child.emoji,
    avatar_photo_id: child.avatarPhotoId ?? null, growth_ref: child.growthRef ?? null, gender: child.gender ?? null, owner_id: user.id, client_ts: ts,
  });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb.from("child_members").upsert({ child_id: child.id, user_id: user.id, role: "owner", email: user.email ?? null });
  if (e2) throw new Error(e2.message);

  apply((s) => ({ kids: s.kids.map((k) => (k.id === childId ? { ...k, shared: true, updatedAt: ts, syncedTs: ts } : k)) }));
  await syncChild(childId);
}

export async function createInvite(childId: string): Promise<string> {
  const { data, error } = await client().rpc("create_invite", { p_child: childId });
  if (error) throw new Error(error.message);
  return String(data);
}

/** The other parent enters a code: join the child, then pull everything down. */
export async function joinWithCode(code: string): Promise<Child> {
  const { data, error } = await client().rpc("join_child", { p_code: code.trim() });
  if (error) throw new Error(error.message);
  const child = childFromRow(data as ChildRow);
  const existing = useStore.getState().kids.find((k) => k.id === child.id);
  apply((s) => ({
    kids: existing ? s.kids.map((k) => (k.id === child.id ? { ...k, shared: true } : k)) : [...s.kids, child],
    activeId: child.id,
  }));
  await syncChild(child.id);
  return child;
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

export async function listMembers(childId: string): Promise<{ email: string; role: string }[]> {
  const { data, error } = await client().from("child_members").select("email, role").eq("child_id", childId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: { email: string | null; role: string }) => ({ email: m.email || "(unknown)", role: m.role }));
}

/* ---------- the sync itself ---------- */

export async function syncChild(childId: string): Promise<void> {
  const sb = client();
  await me();
  const st = useStore.getState();
  const cursor = st.syncMeta[childId]?.cursor;

  /* 1 ── PULL: what changed in the cloud since last time */
  progress("Checking for new memories…");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const since = (q: any) => (cursor ? q.gte("updated_at", cursor) : q);
  const [cRes, mRes, dRes, rRes] = await Promise.all([
    sb.from("children").select("*").eq("id", childId).maybeSingle(),
    since(sb.from("memories").select("*").eq("child_id", childId)),
    since(sb.from("custom_defs").select("*").eq("child_id", childId)),
    sb.from("relatives").select("*").eq("child_id", childId),
  ]);
  check(cRes, mRes, dRes, rRes);
  if (!cRes.data) throw new Error("This child isn't shared with you any more.");

  const mRows = mRes.data ?? [], dRows = dRes.data ?? [], rRows = rRes.data ?? [];
  const removedFiles: string[] = [];
  apply((s) => {
    const relatives = mergeRelatives(s.relatives, rRows, childId);
    let tags = s.tags;
    for (const r of mRows) for (const t of tagsInRow(r)) tags = upsertTagIn(tags, t);
    for (const r of relatives) if (tags.some((t) => t.relatedFamilyMemberId === r.id)) tags = upsertTagIn(tags, personTag(r)); // show their current name
    return {
      kids: s.kids.map((k) => (k.id === childId ? mergeChild(k, cRes.data) : k)),
      memories: mergeMemories(s.memories, mRows, (m) => m.media.forEach((x) => x.uri && removedFiles.push(x.uri))),
      customDefs: { ...s.customDefs, [childId]: mergeDefs(s.customDefs[childId] || [], dRows) },
      relatives,
      tags,
    };
  });
  removedFiles.forEach(deleteFile);
  const newCursor = newestCursor(cursor, [cRes.data], mRows, dRows);

  /* 2 ── PUSH: what changed on this phone */
  await pushChild(childId, rRows);

  /* 3 ── DOWNLOAD: pictures and videos we don't have yet */
  await downloadMissing(childId);

  apply((s) => ({ syncMeta: { ...s.syncMeta, [childId]: { cursor: newCursor, lastSync: new Date().toISOString() } } }));
}

async function pushChild(childId: string, remoteRelatives: { id: string; client_ts?: number }[]) {
  const sb = client();
  let s = useStore.getState();

  // the child's own details
  const child = s.kids.find((k) => k.id === childId);
  if (child && isDirty(child)) {
    const ts = child.updatedAt ?? Date.now();
    const { error } = await sb.from("children").update({
      name: child.name, birth: child.birth, theme: child.theme, emoji: child.emoji,
      avatar_photo_id: child.avatarPhotoId ?? null, growth_ref: child.growthRef ?? null, gender: child.gender ?? null, client_ts: ts,
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
          progress(`Uploading ${++uploaded} of ${toUpload}…`);
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
    const { error } = await sb.from("custom_defs").upsert(rows, { onConflict: "child_id,id" });
    if (error) throw new Error(error.message);
    apply((st) => ({ customDefs: { ...st.customDefs, [childId]: (st.customDefs[childId] || []).map((d) => { const r = rows.find((x) => x.id === d.id); return r ? { ...d, updatedAt: r.client_ts, syncedTs: r.client_ts } : d; }) } }));
  }

  // family members: send any the cloud copy of this child doesn't have yet (or has an older version of)
  const known = new Map(remoteRelatives.map((r) => [r.id, Number(r.client_ts) || 0]));
  const rels = relativesToPush(s.relatives, childId, known); // only this child's family
  if (rels.length) {
    const { error } = await sb.from("relatives").upsert(
      rels.map((r) => ({ child_id: childId, id: r.id, name: r.name, relation: relationLabel(r), custom_label: null, nickname: r.nickname ?? null, description: r.description ?? null, client_ts: r.updatedAt ?? 0, deleted: false })),
      { onConflict: "child_id,id" }
    );
    if (error) throw new Error(error.message);
  }

  // things deleted on this phone
  s = useStore.getState();
  const tombs = s.tombstones.filter((t) => t.childId === childId);
  for (const t of tombs) {
    const q = sb.from(t.table).update({ deleted: true, client_ts: t.ts });
    const { error } = t.table === "custom_defs" ? await q.eq("child_id", childId).eq("id", t.id) : await q.eq("id", t.id).eq("child_id", childId);
    if (error) throw new Error(error.message);
    if (t.paths?.length) await sb.storage.from(BUCKET).remove(t.paths);
  }
  if (tombs.length) apply((st) => ({ tombstones: st.tombstones.filter((t) => !tombs.includes(t)) }));
}

async function downloadMissing(childId: string) {
  const s = useStore.getState();
  const jobs: { memoryId: string; mediaId: string; path: string }[] = [];
  for (const m of s.memories) {
    if (m.childId !== childId) continue;
    for (const x of m.media) if (x.path && !(x.uri && new File(x.uri).exists)) jobs.push({ memoryId: m.id, mediaId: x.id, path: x.path });
  }
  let n = 0;
  for (const j of jobs) {
    progress(`Downloading ${++n} of ${jobs.length}…`);
    try {
      const uri = await download(j.path, `${j.memoryId}-${j.mediaId}`);
      apply((st) => ({ memories: st.memories.map((m) => (m.id === j.memoryId ? { ...m, media: m.media.map((x) => (x.id === j.mediaId ? { ...x, uri } : x)) } : m)) }));
    } catch {
      /* one missing file shouldn't stop the rest — it's retried next time */
    }
  }
}

/* ---------- the account: every child is kept in it ---------- */

interface ChildRow { id: string; name: string; birth: string; theme: string; emoji: string; avatar_photo_id?: string | null; growth_ref?: string | null; gender?: string | null; client_ts?: number }

/** A child as the cloud sends it. */
function childFromRow(row: ChildRow): Child {
  return {
    id: row.id, name: row.name, birth: String(row.birth), theme: (row.theme as Child["theme"]) || "pink", emoji: row.emoji || "🐣",
    avatarPhotoId: row.avatar_photo_id ?? undefined, growthRef: (row.growth_ref as Child["growthRef"]) ?? undefined,
    gender: (row.gender as Child["gender"]) ?? undefined,
    shared: true, updatedAt: Number(row.client_ts) || 0, syncedTs: Number(row.client_ts) || 0,
  };
}

/** True when nothing on this phone is waiting to go to the cloud (so it is safe to hand the phone to another account). */
export function everythingSynced(s: State = useStore.getState()): boolean {
  const kids = s.kids;
  if (kids.some((k) => !k.shared || isDirty(k))) return false;
  const shared = new Set(kids.map((k) => k.id));
  return !s.memories.some((m) => shared.has(m.childId) && isDirty(m)) && !s.tombstones.length;
}

/**
 * Signed in: every child on this phone is saved to the account (children added before accounts existed, or while offline, are uploaded now),
 * and every child the account already has elsewhere is brought down (a new phone, or after signing out and in again).
 */
export async function attachAndRestore(): Promise<void> {
  const sb = client();
  await me();
  const local = useStore.getState().kids;
  for (const k of local.filter((x) => !x.shared)) await shareChild(k.id);

  const { data, error } = await sb.from("children").select("*");
  if (error) throw new Error(error.message);
  const have = new Set(useStore.getState().kids.map((k) => k.id));
  const missing = ((data ?? []) as ChildRow[]).filter((r) => !have.has(r.id)).map(childFromRow);
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
  if (e4) throw new Error(/function .*delete_my_account/i.test(e4.message) ? "The database needs the latest setup (npm run db:setup) before accounts can be deleted." : e4.message);
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
      for (const k of useStore.getState().kids.filter((x) => !x.shared)) await shareChild(k.id);
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
