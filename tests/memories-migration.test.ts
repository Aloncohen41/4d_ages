import { migrateStored, migrateMemoriesV5 } from "../src/lib/migrate";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };

// ===== a realistic v4 phone (right after step 1): plain photos, a story, milestone cards+records, measure card with linked h/w, old standalone heights =====
const v4: any = {
  kids: [{ id: "maya", name: "Maya", birth: "2024-09-04" }, { id: "leo", name: "Leo", birth: "2026-06-04" }],
  relatives: [{ id: "rosa", name: "Rosa", relation: "Grandma", emoji: "👵" }],
  tags: [{ id: "tag-person-rosa", name: "Grandma Rosa", category: "person", relatedFamilyMemberId: "rosa" }, { id: "tag-other-beach", name: "beach", category: "other" }],
  photos: [
    { id: "p1", childId: "maya", date: "2025-01-01", caption: "snow day", kind: "photo", uri: "file:///1.jpg", emoji: "📷", palette: "peach", tagIds: ["tag-person-rosa"], source: "Added", updatedAt: 111, syncedTs: 100, storagePath: "maya/p1.jpg" },
    { id: "p2", childId: "maya", date: "2025-02-01", caption: "A new memory.", kind: "video", uri: "file:///v.mp4", emoji: "🎬", palette: "sky", tagIds: [], source: "Shared", time: "08:15" },
    { id: "p3", childId: "maya", date: "2025-02-02", caption: "sample art only", kind: "photo", emoji: "🎀", palette: "lav", tagIds: [], source: "Sample" },
    { id: "s1", childId: "maya", date: "2025-03-03", caption: "A lake day", title: "Lake", kind: "photo", uri: "file:///a.jpg", media: [{ id: "m1", uri: "file:///a.jpg", kind: "photo", path: "maya/m1.jpg" }, { id: "m2", uri: "file:///b.jpg", kind: "photo" }], emoji: "📖", palette: "sky", tagIds: ["tag-person-rosa", "tag-other-beach"], location: "Lake Tahoe", time: "16:20", entryKind: "story", source: "Story", updatedAt: 222 },
    { id: "f1", childId: "maya", date: "2025-10-05", caption: "wobbly", title: "First steps", kind: "photo", emoji: "👣", palette: "peach", tagIds: [], entryKind: "first", source: "First", media: [] },
    { id: "me1", childId: "maya", date: "2025-06-01", caption: "check-up", kind: "photo", emoji: "📏", palette: "sage", tagIds: [], entryKind: "measure", heightCm: 70, weightKg: 8.1, source: "Measurement", media: [] },
    // milestone cards (derived from the records below)
    { id: "ms-maya-crawls", childId: "maya", date: "2025-05-01", caption: "crawling!", kind: "photo", emoji: "🧎", palette: "butter", tagIds: [], milestoneId: "crawls", source: "Milestone" },
    { id: "ms-maya-custom-1", childId: "maya", date: "2025-07-07", caption: "meow", kind: "photo", emoji: "🐈", palette: "butter", tagIds: [], milestoneId: "custom-1", source: "Milestone" },
    { id: "ms-leo-orphan", childId: "leo", date: "2026-08-01", caption: "no record behind me", kind: "photo", emoji: "💪", palette: "butter", tagIds: [], milestoneId: "lifts-head", source: "Milestone" },
  ],
  milestones: {
    maya: {
      crawls: { date: "2025-05-01", note: "crawling!", emoji: "🧎", media: [{ id: "c1", uri: "file:///c.jpg", kind: "photo" }], tagIds: ["tag-person-rosa"], time: "09:30", location: "Kitchen", updatedAt: 333, syncedTs: 300 },
      "custom-1": { date: "2025-07-07", note: "meow", emoji: "🐈", media: [], tagIds: [] },
    },
  },
  customDefs: { maya: [{ id: "custom-1", label: "Waves at the cat", emoji: "🐈", hint: "", custom: true }] },
  heights: { maya: [
    { id: "me1-h", date: "2025-06-01", cm: 70 },            // carried by the measure card
    { id: "mh-old", date: "2025-01-01", cm: 66.5 },         // logged on the Growth tab long ago
    { id: "mh-both", date: "2025-09-01", cm: 74 },
  ], leo: [{ id: "lh1", date: "2026-08-01", cm: 58 }] },
  weights: { maya: [
    { id: "me1-w", date: "2025-06-01", kg: 8.1 },
    { id: "mw-both", date: "2025-09-01", kg: 9.4 },
    { id: "mw-only", date: "2025-12-01", kg: 10.2 },
  ] },
  tombstones: [{ table: "photos", childId: "maya", id: "gone1", ts: 1 }, { table: "milestones", childId: "maya", id: "crawls", ts: 2 }, { table: "custom_defs", childId: "maya", id: "x", ts: 3 }],
  growSpeed: 2, heightUnit: "in", kidsExtra: "kept",
};
const snapshot = JSON.stringify(v4);
const m: any = migrateStored(JSON.parse(snapshot), 4);
ok("input is never mutated", JSON.stringify(v4) === snapshot);
ok("old collections are gone; one `memories` list exists", m.photos === undefined && m.milestones === undefined && m.heights === undefined && m.weights === undefined && Array.isArray(m.memories));
ok("kids, family, tags, custom milestones, settings are untouched", JSON.stringify(m.kids) === JSON.stringify(v4.kids) && JSON.stringify(m.relatives) === JSON.stringify(v4.relatives) && JSON.stringify(m.tags) === JSON.stringify(v4.tags) && JSON.stringify(m.customDefs) === JSON.stringify(v4.customDefs) && m.growSpeed === 2 && m.heightUnit === "in" && m.kidsExtra === "kept");

const get = (id: string) => m.memories.find((x: any) => x.id === id);
const p1 = get("p1");
ok("plain photo → type 'photo'; file becomes media (with its cloud path); description, date, tags, sync fields kept", p1.type === "photo" && p1.description === "snow day" && p1.date === "2025-01-01" && p1.media.length === 1 && p1.media[0].uri === "file:///1.jpg" && p1.media[0].path === "maya/p1.jpg" && p1.tagIds[0] === "tag-person-rosa" && p1.updatedAt === 111 && p1.syncedTs === 100 && typeof p1.createdAt === "number" && p1.source === "Added");
const p2 = get("p2");
ok("a video keeps its kind and time", p2.media[0].kind === "video" && p2.time === "08:15");
ok("an illustrated sample photo with no file keeps its emoji art and has empty media", get("p3").media.length === 0 && get("p3").emoji === "🎀" && get("p3").palette === "lav");
const s1 = get("s1");
ok("story keeps title, text, both photos, place, time, tags", s1.type === "story" && s1.title === "Lake" && s1.description === "A lake day" && s1.media.length === 2 && s1.media[0].path === "maya/m1.jpg" && s1.location === "Lake Tahoe" && s1.time === "16:20" && s1.tagIds.length === 2);
ok("first keeps its type and text", get("f1").type === "first" && get("f1").title === "First steps" && get("f1").description === "wobbly");
ok("measure keeps both values", get("me1").type === "measure" && get("me1").heightCm === 70 && get("me1").weightKg === 8.1);

const crawls = get("ms-maya-crawls");
ok("milestone record → milestone memory with the SAME id as its old card; every field carried", crawls.type === "milestone" && crawls.milestoneId === "crawls" && crawls.title === "Crawls" && crawls.description === "crawling!" && crawls.date === "2025-05-01" && crawls.time === "09:30" && crawls.location === "Kitchen" && crawls.media[0].uri === "file:///c.jpg" && crawls.tagIds[0] === "tag-person-rosa" && crawls.updatedAt === 333 && crawls.syncedTs === 300 && crawls.emoji === "🧎");
ok("custom milestone takes its title from the custom definition", get("ms-maya-custom-1").title === "Waves at the cat" && get("ms-maya-custom-1").milestoneId === "custom-1");
ok("an orphan milestone card (no record) is NOT lost", get("ms-leo-orphan").type === "milestone" && get("ms-leo-orphan").description === "no record behind me" && get("ms-leo-orphan").title === "Lifts head during tummy time");
ok("each milestone is exactly one memory (no card + record duplicates)", m.memories.filter((x: any) => x.type === "milestone" && x.childId === "maya").length === 2);

const standalone = m.memories.filter((x: any) => x.id.startsWith("me-mig-"));
ok("old standalone heights/weights became 4 measurement memories (Maya: height-only, merged height+weight, weight-only; Leo: height-only)", standalone.length === 4 && standalone.filter((x: any) => x.childId === "maya").length === 3);
const both = standalone.find((x: any) => x.date === "2025-09-01");
ok("a height and weight on the same day merge into ONE measurement", both.heightCm === 74 && both.weightKg === 9.4 && both.type === "measure");
ok("a weight-only and a height-only entry stay separate and keep their values", standalone.find((x: any) => x.date === "2025-12-01").weightKg === 10.2 && standalone.find((x: any) => x.date === "2025-01-01").heightCm === 66.5 && standalone.find((x: any) => x.childId === "leo").heightCm === 58);
ok("heights/weights already inside a measurement are NOT duplicated", m.memories.filter((x: any) => x.date === "2025-06-01").length === 1);

ok("nothing lost: 6 photos/stories/firsts/measure + 3 milestones + 4 standalone measurements = 13 memories", m.memories.length === 6 + 3 + 4);
ok("every memory has the common fields", m.memories.every((x: any) => x.id && x.childId && x.type && typeof x.description === "string" && x.date && Array.isArray(x.media) && Array.isArray(x.tagIds) && typeof x.createdAt === "number" && x.emoji && x.palette && x.source));
ok("no old-format fields left behind", m.memories.every((x: any) => x.caption === undefined && x.uri === undefined && x.entryKind === undefined && x.kind === undefined && x.storagePath === undefined && x.people === undefined && x.tags === undefined));
ok("ids are unique", new Set(m.memories.map((x: any) => x.id)).size === m.memories.length);
ok("waiting deletions follow along (photos→memories, milestones→memory id)", m.tombstones.length === 3 && m.tombstones[0].table === "memories" && m.tombstones[0].id === "gone1" && m.tombstones[1].table === "memories" && m.tombstones[1].id === "ms-maya-crawls" && m.tombstones[2].table === "custom_defs");

ok("running v5 again changes nothing", JSON.stringify(migrateMemoriesV5(m)) === JSON.stringify(m));
ok("a brand-new install (nothing saved) is left alone", JSON.stringify(migrateMemoriesV5({ kids: [] })) === JSON.stringify({ kids: [] }));

// ===== an OLD phone goes through every step in one go (v1 → v5) =====
const old: any = JSON.parse(snapshot);
old.photos = old.photos.map((p: any) => { const { tagIds, ...rest } = p; return { ...rest, people: p.id === "p1" ? ["rosa"] : [], tags: p.id === "s1" ? ["beach", "person:rosa"] : [] }; });
old.milestones.maya["first-steps"] = { date: "2025-10-05", note: "wobbly", emoji: "👣", media: [], tags: ["person:rosa"] };
old.photos.push({ id: "ms-maya-first-steps", childId: "maya", date: "2025-10-05", caption: "wobbly", kind: "photo", emoji: "👣", palette: "butter", people: [], milestoneId: "first-steps", source: "Milestone" });
delete old.tags;
const all: any = migrateStored(old, 1);
ok("v1 → v5: nothing lost; the old 'First steps' milestone is now a First memory", all.memories.some((x: any) => x.type === "first" && x.title === "First steps" && x.date === "2025-10-05" && x.tagIds.includes("tag-person-rosa")) && !all.memories.some((x: any) => x.milestoneId === "first-steps") && all.memories.filter((x: any) => x.type === "milestone").length === 3);
ok("v1 → v5: old people/tags strings became tag ids in the central list", get2(all, "p1").tagIds.includes("tag-person-rosa") && get2(all, "s1").tagIds.includes("tag-other-beach") && all.tags.some((t: any) => t.id === "tag-other-beach" && t.name === "beach"));
function get2(st: any, id: string) { return st.memories.find((x: any) => x.id === id); }
console.log(fails ? `${fails} FAILED` : "all v5 memory-migration tests passed");
