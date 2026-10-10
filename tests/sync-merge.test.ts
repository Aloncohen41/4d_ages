import { mergeMemories, mergeDefs, mergeRelatives, mergeChild, newestCursor, isDirty, memoryToRow, tagsInRow } from "../src/lib/syncMerge";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const base: any = { id: "p1", childId: "c", type: "photo", description: "mine", date: "2025-01-01", media: [{ id: "m1", uri: "file:///a.jpg", kind: "photo", path: "c/p1-m1.jpg" }], tagIds: ["tag-other-beach"], createdAt: 50, emoji: "📷", palette: "peach", source: "Added", updatedAt: 100, syncedTs: 100 };
const row = (o: any = {}) => ({ id: "p1", child_id: "c", type: "photo", description: "theirs", date: "2025-01-01", media: [{ id: "m1", path: "c/p1-m1.jpg", kind: "photo" }], tags: [{ id: "tag-person-rosa", name: "Grandma Rosa", category: "person", member: "rosa" }], emoji: "📷", palette: "peach", source: "Added", created_at_ts: 50, client_ts: 200, deleted: false, updated_at: "2025-02-01T00:00:00Z", ...o });

let r = mergeMemories([base], [row()]);
ok("newer remote edit replaces the text and tags, keeps the local file", r[0].description === "theirs" && r[0].media[0].uri === "file:///a.jpg" && JSON.stringify(r[0].tagIds) === JSON.stringify(["tag-person-rosa"]) && !isDirty(r[0]) && r[0].createdAt === 50);
r = mergeMemories([{ ...base, description: "local edit", updatedAt: 300 }], [row()]);
ok("newer local edit survives and stays dirty", r[0].description === "local edit" && isDirty(r[0]));
r = mergeMemories([base], [row({ client_ts: 100 })]);
ok("same version → just marked synced", r[0].description === "mine" && !isDirty(r[0]));
r = mergeMemories([], [row({ id: "p9", type: "milestone", milestone_id: "crawls", title: "Crawls", height_cm: null })]);
ok("a new remote memory of ANY type arrives whole (here a milestone), files still to download", r.length === 1 && r[0].type === "milestone" && r[0].milestoneId === "crawls" && r[0].title === "Crawls" && r[0].media[0].uri === "" && r[0].media[0].path === "c/p1-m1.jpg" && !isDirty(r[0]));
r = mergeMemories([], [row({ id: "me9", type: "measure", height_cm: 74.5, weight_kg: "9.2", media: [], tags: [] })]);
ok("a measurement keeps both numbers", r[0].heightCm === 74.5 && r[0].weightKg === 9.2);
let removed: string[] = [];
r = mergeMemories([base], [row({ deleted: true, client_ts: 150 })], (m) => m.media.forEach((x) => removed.push(x.uri)));
ok("remote delete removes an older local memory (and reports its files)", r.length === 0 && removed[0] === "file:///a.jpg");
r = mergeMemories([{ ...base, updatedAt: 400 }], [row({ deleted: true, client_ts: 150 })]);
ok("local edit newer than a delete is kept", r.length === 1);
r = mergeMemories([base], [row({ media: [{ id: "m1", path: "c/NEW.jpg", kind: "photo" }], client_ts: 500 })]);
ok("replaced file → local uri dropped so it re-downloads", r[0].media[0].uri === "" && r[0].media[0].path === "c/NEW.jpg");
ok("legacy/never-synced records count as dirty", isDirty({}) && isDirty({ updatedAt: 5 }) && !isDirty({ updatedAt: 5, syncedTs: 5 }));

const reg = [{ id: "tag-person-rosa", name: "Grandma Rosa", category: "person", relatedFamilyMemberId: "rosa" }, { id: "tag-other-beach", name: "beach", category: "other" }] as any;
const out = memoryToRow({ ...base, tagIds: ["tag-person-rosa", "tag-other-beach", "tag-gone"], media: [{ id: "m1", uri: "u", kind: "photo", path: "c/x.jpg" }, { id: "m2", uri: "u2", kind: "photo" }] }, reg, 123);
ok("row: one table for all types; tag snapshot; only uploaded media; client_ts", out.type === "photo" && out.client_ts === 123 && out.tags.length === 2 && out.tags[0].member === "rosa" && out.media.length === 1 && out.media[0].path === "c/x.jpg" && out.created_at_ts === 50);
ok("row → tags the other phone should add to its central list", tagsInRow(out).map((t) => t.id + ":" + (t.relatedFamilyMemberId ?? "-")).join() === "tag-person-rosa:rosa,tag-other-beach:-");

const d = mergeDefs([{ id: "x", label: "Old", emoji: "🌟", hint: "", custom: true, updatedAt: 1 }], [{ id: "x", label: "New", emoji: "🌟", hint: "", category: "Movement", client_ts: 9 }, { id: "y", label: "Y", client_ts: 3 }]);
ok("custom milestones merge (with their type)", d.length === 2 && d[0].label === "New" && d[0].category === "Movement");
const rel = mergeRelatives([{ id: "r", name: "Rosa", relation: "Grandma", emoji: "👵", photoUri: "file:///p.jpg", updatedAt: 1 }], [{ id: "r", name: "Rosa B", relation: "Grandma", custom_label: "Nana", client_ts: 9 }]);
ok("family merge keeps the local picture; an older app's own wording becomes the relationship", rel[0].name === "Rosa B" && rel[0].relation === "Nana" && rel[0].customLabel === undefined && rel[0].photoUri === "file:///p.jpg");
const c = mergeChild({ id: "c", name: "Maya", birth: "2024-01-01", theme: "pink", emoji: "🌸", updatedAt: 5 } as any, { name: "Maya R.", birth: "2024-01-01", theme: "blue", emoji: "🌸", client_ts: 9, avatar_photo_id: "p1", growth_ref: "girl" });
ok("child row merge", c.name === "Maya R." && c.theme === "blue" && c.avatarPhotoId === "p1");
ok("cursor = newest updated_at", newestCursor("2025-01-01T00:00:00Z", [{ updated_at: "2025-03-01T00:00:00Z" }], [{ updated_at: "2025-02-01T00:00:00Z" }]) === "2025-03-01T00:00:00Z");
console.log(fails ? `${fails} FAILED` : "all merge tests passed");
