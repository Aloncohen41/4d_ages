import { migrateStored, migrateTagsV4, migrateTagsV3, migrateRelativesV6 } from "../src/lib/migrate";
import { backupIfOlder } from "../src/lib/backup";
import { itemsWithTags, tagStats, searchTags, makeTag, personTag, tagIdFor, slugify, resolveTags, labelOfTag, personIdsOf, upsertTagIn, effectiveTagIds, TAG_CATEGORIES } from "../src/lib/tags";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };

// ===== a realistic v3 phone: what the app saved before this update =====
const v3: any = {
  kids: [{ id: "maya", name: "Maya", birth: "2024-09-04", theme: "pink", emoji: "🌸" }],
  activeId: "maya",
  relatives: [
    { id: "rosa", name: "Rosa", relation: "Grandma", emoji: "👵" },
    { id: "nana", name: "Beth", relation: "Other", customLabel: "Nana", emoji: "💛", photoUri: "file:///beth.jpg" },
    { id: "mom1", name: "Sarah", relation: "Mom", emoji: "👩" },
    { id: "mom2", name: "Dana", relation: "Mom", emoji: "👩" },
  ],
  photos: [
    { id: "p1", childId: "maya", date: "2025-01-01", caption: "snow", kind: "photo", uri: "file:///1.jpg", emoji: "📷", palette: "peach", people: ["rosa"], tags: ["other:beach", "Fun"], source: "Added", updatedAt: 5 },
    { id: "p2", childId: "maya", date: "2025-02-01", caption: "", kind: "photo", emoji: "📷", palette: "peach", people: [], source: "Added" },
    { id: "s1", childId: "maya", date: "2025-03-03", caption: "A lake day", title: "Lake", kind: "photo", uri: "file:///a.jpg", media: [{ id: "m1", uri: "file:///a.jpg", kind: "photo" }, { id: "m2", uri: "file:///b.jpg", kind: "photo" }], emoji: "📖", palette: "sky", people: ["rosa", "nana"], tags: ["event:Family trip", "person:mom1", "place:Lake Tahoe"], location: "Lake Tahoe", time: "16:20", entryKind: "story", source: "Story" },
    { id: "ms-maya-crawls", childId: "maya", date: "2025-05-01", caption: "crawling!", kind: "photo", emoji: "🧎", palette: "butter", people: [], milestoneId: "crawls", source: "Milestone" },
    { id: "ms-maya-first-steps", childId: "maya", date: "2025-10-05", caption: "wobbly", kind: "photo", emoji: "👣", palette: "butter", people: [], milestoneId: "first-steps", source: "Milestone" },
  ],
  milestones: { maya: {
    crawls: { date: "2025-05-01", note: "crawling!", emoji: "🧎", media: [{ id: "c1", uri: "file:///c.jpg", kind: "photo" }], tags: ["person:mom2", "home"], time: "09:30", location: "Kitchen" },
    "first-steps": { date: "2025-10-05", note: "wobbly", emoji: "👣", media: [], tags: ["person:rosa"] },
  } },
  customDefs: { maya: [{ id: "custom-1", label: "Waves at the cat", emoji: "🐈", hint: "", custom: true }] },
  heights: { maya: [{ id: "h1", date: "2025-01-01", cm: 70 }] },
  weights: { maya: [{ id: "w1", date: "2025-01-01", kg: 8.1 }] },
};
const before = JSON.stringify(v3);
const m = migrateTagsV4(JSON.parse(before));
ok("input is not mutated", JSON.stringify(v3) === before);
ok("v4: old `tags` strings and `people` are gone, `tagIds` and a central list exist", m.photos.every((p: any) => p.tags === undefined && p.people === undefined && Array.isArray(p.tagIds)) && Array.isArray(m.tags));
ok("every photo, date, caption, file and media is carried over", m.photos.length === 5 && m.photos.find((p: any) => p.id === "p1").caption === "snow" && m.photos.find((p: any) => p.id === "p1").uri === "file:///1.jpg" && m.photos.find((p: any) => p.id === "s1").media.length === 2 && m.photos.find((p: any) => p.id === "s1").time === "16:20" && m.photos.find((p: any) => p.id === "p1").updatedAt === 5);
ok("milestone records are untouched apart from their tags", m.milestones.maya.crawls.media[0].uri === "file:///c.jpg" && m.milestones.maya.crawls.time === "09:30" && m.milestones.maya.crawls.location === "Kitchen" && m.milestones.maya.crawls.note === "crawling!" && Object.keys(m.milestones.maya).length === 2);
ok("heights, weights, custom milestones, family, kids untouched", JSON.stringify(m.heights) === JSON.stringify(v3.heights) && JSON.stringify(m.weights) === JSON.stringify(v3.weights) && JSON.stringify(m.customDefs) === JSON.stringify(v3.customDefs) && JSON.stringify(m.relatives) === JSON.stringify(v3.relatives) && JSON.stringify(m.kids) === JSON.stringify(v3.kids));

const reg = m.tags as any[];
const byId = new Map(reg.map((t) => [t.id, t]));
const name = (id: string) => byId.get(id)?.name;
const p1 = m.photos.find((p: any) => p.id === "p1"), s1 = m.photos.find((p: any) => p.id === "s1");
ok("each tag is {id, name, category, relatedFamilyMemberId?}", reg.every((t) => t.id && t.name && ["person", "event", "place", "other"].includes(t.category)) && reg.filter((t) => t.category === "person").every((t) => !!t.relatedFamilyMemberId));
ok("p1: 'Grandma Rosa', beach, Fun", p1.tagIds.map(name).sort().join("|") === ["Grandma Rosa", "beach", "Fun"].sort().join("|"));
ok("custom relationship wording survives in the person tag (Nana Beth)", s1.tagIds.map(name).includes("Nana Beth") && byId.get(tagIdFor("person", "x", "nana"))!.relatedFamilyMemberId === "nana");
ok("two Moms are two separate tags", name("tag-person-mom1") === "Mom Sarah" && name("tag-person-mom2") === "Mom Dana");
ok("story: event + place + person tags all converted", s1.tagIds.includes("tag-event-family-trip") && s1.tagIds.includes("tag-place-lake-tahoe") && s1.tagIds.includes("tag-person-mom1") && s1.tagIds.includes("tag-person-rosa"));
ok("milestone record tags converted too (mom2 + 'home')", m.milestones.maya.crawls.tagIds.includes("tag-person-mom2") && m.milestones.maya.crawls.tagIds.includes("tag-other-home"));
ok("no duplicate tags in the list, ids are unique", new Set(reg.map((t) => t.id)).size === reg.length && reg.filter((t) => t.id === "tag-person-rosa").length === 1);
ok("the old legacy 'first-steps' milestone is NOT here yet (that happened in v2); it stays a milestone record", !!m.milestones.maya["first-steps"]);
ok("running the migration again changes nothing", JSON.stringify(migrateTagsV4(m)) === JSON.stringify(m));

// ===== older phones go through the whole chain without loss =====
const v1: any = JSON.parse(before);
const chain: any = migrateStored(v1, 1);
ok("from v1 all the way: the legacy 'first-steps' becomes a First memory with its date/note/tag; nothing else lost", chain.memories.some((p: any) => p.id === "en-mig-maya-first-steps" && p.type === "first" && p.title === "First steps" && p.date === "2025-10-05" && p.description === "wobbly" && p.tagIds.includes("tag-person-rosa")) && !chain.memories.some((p: any) => p.milestoneId === "first-steps") && chain.memories.filter((p: any) => p.type === "photo" || p.type === "story").length === 3);
ok("from v0 with no photos/milestones at all: nothing breaks", Array.isArray(migrateStored({ kids: [] }, 0).tags) && Array.isArray(migrateStored({}, 0).tags) || migrateStored({}, 0).photos === undefined);

// ===== the exact format the PREVIOUS app version saved (v3), carried all the way to today (v5) =====
const full: any = migrateStored(JSON.parse(before), 3);
ok("v3 → v5 end to end: every memory survives (3 photos/story + 2 milestones + 1 measurement from the old height/weight)", full.memories.length === 6 && full.photos === undefined && full.milestones === undefined && full.heights === undefined && full.weights === undefined);
ok("v3 → v5: the story keeps everything, now with tag ids", (() => { const s = full.memories.find((x: any) => x.id === "s1"); return s.type === "story" && s.description === "A lake day" && s.title === "Lake" && s.media.length === 2 && s.time === "16:20" && s.location === "Lake Tahoe" && s.tagIds.includes("tag-person-mom1") && s.tagIds.includes("tag-event-family-trip"); })());
ok("v3 → v5: milestones keep notes, photos, place, time and tags", (() => { const c = full.memories.find((x: any) => x.id === "ms-maya-crawls"); return c.type === "milestone" && c.milestoneId === "crawls" && c.description === "crawling!" && c.media[0].uri === "file:///c.jpg" && c.time === "09:30" && c.location === "Kitchen" && c.tagIds.includes("tag-person-mom2") && c.tagIds.includes("tag-other-home"); })());
ok("v3 → v5: the old height/weight entry became a measurement; family, kids, custom milestones untouched", full.memories.some((x: any) => x.type === "measure" && x.heightCm === 70 && x.weightKg === 8.1 && x.date === "2025-01-01") && JSON.stringify(full.relatives) === JSON.stringify(migrateRelativesV6({ relatives: v3.relatives }).relatives) && JSON.stringify(full.kids) === JSON.stringify(v3.kids) && JSON.stringify(full.customDefs) === JSON.stringify(v3.customDefs));

// ===== tag helpers work on the central list =====
const items = m.photos;
const stats = tagStats(items, reg, m.relatives);
ok("stats: Grandma Rosa is on p1 and s1", stats.find((s) => s.id === "tag-person-rosa")!.count === 2);
ok("global search 'grandma' finds Grandma Rosa and not the Moms", searchTags(stats, "grandma", m.relatives).map((s) => s.id).join() === "tag-person-rosa" && searchTags(stats, "mom", m.relatives).length === 1);
ok("search finds a person by their custom wording", searchTags(stats, "nana", m.relatives).map((s) => s.id).join() === "tag-person-nana");
ok("tag lookup finds the photo AND the story", itemsWithTags(items, ["tag-person-rosa"]).map((p: any) => p.id).join() === "p1,s1");
ok("a Location-field place is searchable without being stored twice", effectiveTagIds({ tagIds: [], location: "Kitchen" }).join() === "tag-place-kitchen" && !reg.some((t) => t.id === "tag-place-kitchen"));
ok("renaming a family member keeps the SAME tag id and shows the new name", (() => { const r = { ...m.relatives[0], name: "Rose" }; const tag = personTag(r); const list = upsertTagIn(reg, tag); return tag.id === "tag-person-rosa" && labelOfTag(list.find((t) => t.id === tag.id), [r]) === "Grandma Rose" && list.length === reg.length; })());
ok("person ids come from tags (for the cloud copy)", personIdsOf(s1.tagIds, reg).sort().join() === "mom1,nana,rosa");
ok("ids: same name = same tag; other alphabets get a stable hash id", makeTag("place", "Lake Tahoe").id === makeTag("place", "  lake tahoe ").id && slugify("Grandma's house") === "grandma-s-house" && slugify("בית") === slugify("בית") && slugify("בית").startsWith("u") && slugify("בית") !== slugify("גן"));
ok("four categories", TAG_CATEGORIES.map((c) => c.id).join() === "person,event,place,other");

// ===== automatic backup before migrating =====
const mem = new Map<string, string>();
const kv = { getItem: async (k: string) => mem.get(k) ?? null, setItem: async (k: string, v: string) => { mem.set(k, v); } };
(async () => {
  const raw = JSON.stringify({ state: v3, version: 3 });
  ok("older data → backup made, original bytes kept", (await backupIfOlder(kv, "key", 4, raw)) === true && mem.get("key-backup-v3") === raw);
  mem.set("key-backup-v3", "FIRST");
  ok("an existing backup is never overwritten", (await backupIfOlder(kv, "key", 4, raw)) === false && mem.get("key-backup-v3") === "FIRST");
  ok("current-version data → no backup", (await backupIfOlder(kv, "key", 4, JSON.stringify({ state: {}, version: 4 }))) === false && !mem.has("key-backup-v4"));
  ok("no version saved at all counts as v0", (await backupIfOlder(kv, "k2", 4, JSON.stringify({ state: {} }))) === true && mem.has("k2-backup-v0"));
  ok("garbage or empty data: no crash, no backup", (await backupIfOlder(kv, "k3", 4, "{not json")) === false && (await backupIfOlder(kv, "k3", 4, null)) === false);
  console.log(fails ? `${fails} FAILED` : "all tag-registry + migration + backup tests passed");
})();
