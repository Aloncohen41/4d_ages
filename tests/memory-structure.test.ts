import { buildMemory, parseNumber, milestoneMemoryId, TYPE_META } from "../src/lib/entries";
import { blurb, byMoment, coverOf } from "../src/lib/display";
import { milestonesLogged, heightSeries, weightSeries, memoriesOf } from "../src/lib/selectors";
import { formatTime } from "../src/lib/date";
import { toKg, fromKg, formatWeight } from "../src/lib/growth";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
ok("times", formatTime("00:05") === "12:05 AM" && formatTime("12:00") === "12:00 PM" && formatTime("14:30") === "2:30 PM");
ok("numbers", parseNumber("74,5") === 74.5 && parseNumber("abc") === null);
ok("weight units", Math.abs(toKg(20, "lb") - 9.0718) < 0.001 && formatWeight(9.2, "kg") === "9.2 kg" && formatWeight(4.5359237, "lb") === "10 lb");

const media = [{ id: "m1", uri: "file:///a.jpg", kind: "photo" as const }, { id: "m2", uri: "file:///b.mp4", kind: "video" as const }];
const story = buildMemory({ childId: "c", type: "story", title: " Lake day ", description: " so much splashing ", date: "2025-06-01", time: "14:30", location: " Lake Tahoe ", tagIds: ["a", "b", "a"], media, emoji: "" }, "mem-1", undefined, 5);
ok("every memory has the same common fields", story.id === "mem-1" && story.type === "story" && story.title === "Lake day" && story.description === "so much splashing" && story.date === "2025-06-01" && story.time === "14:30" && story.location === "Lake Tahoe" && story.media.length === 2 && JSON.stringify(story.tagIds) === JSON.stringify(["a", "b"]) && story.createdAt === 5 && story.updatedAt === 5);
ok("type-specific fields are only set for their type", story.milestoneId === undefined && story.heightCm === undefined && story.weightKg === undefined);
const ms = buildMemory({ childId: "c", type: "milestone", milestoneId: "crawls", title: "Crawls", description: "", date: "2025-06-01", media: [], tagIds: [], emoji: "🧎" }, milestoneMemoryId("c", "crawls"), undefined, 6);
ok("milestone memory: catalogue link, deterministic id (one per milestone per child), butter palette", ms.milestoneId === "crawls" && ms.id === "ms-c-crawls" && ms.palette === "butter" && ms.source === "Milestone");
const me = buildMemory({ childId: "c", type: "measure", description: "", date: "2025-06-01", media: [], tagIds: [], emoji: "", heightCm: 74.5, weightKg: 9.2 }, "me-1", undefined, 7);
ok("measure memory carries height & weight", me.heightCm === 74.5 && me.weightKg === 9.2 && me.emoji === "📏" && me.source === "Measurement");
const last = buildMemory({ childId: "c", type: "last", title: "Last bottle", description: "", date: "2025-06-01", media: [], tagIds: [], emoji: "🍼" }, "l-1", undefined, 8);
ok("no-photo memory keeps its emoji", coverOf(last.media) === null && last.emoji === "🍼" && last.palette === "lav");
const edited = buildMemory({ childId: "c", type: "story", title: "t", description: "x", date: "2025-06-02", media: [], tagIds: [], emoji: "📖" }, "mem-1", { ...story, syncedTs: 3, source: "Shared" }, 99);
ok("editing keeps createdAt, source and sync bookkeeping; bumps updatedAt", edited.createdAt === 5 && edited.syncedTs === 3 && edited.updatedAt === 99 && edited.source === "Shared" && edited.media.length === 0);
const plain = buildMemory({ childId: "c", type: "photo", description: "snow", date: "2025-01-01", media: [media[0]], tagIds: [], emoji: "" }, "p-1", undefined, 1);
ok("a plain photo is just a memory of type 'photo'", plain.type === "photo" && plain.emoji === "📷" && plain.source === "Added");
ok("six types, all with labels", Object.keys(TYPE_META).sort().join() === "first,last,measure,milestone,photo,story");

ok("cover: a photo beats a video; nothing → null", coverOf(media)!.uri === "file:///a.jpg" && coverOf([media[1]])!.kind === "video" && coverOf([]) === null && coverOf(undefined) === null);
ok("blurb + sort", blurb({ title: "A", description: "b" }) === "A — b" && [{ date: "2025-01-02", time: "09:00" }, { date: "2025-01-01" }, { date: "2025-01-02", time: "08:00" }].sort(byMoment).map((x: any) => x.time ?? "-").join() === "-,08:00,09:00");

// ===== views derived from the one list =====
const all = [story, ms, me, last, plain, { ...me, id: "me-2", date: "2025-09-01", heightCm: 80, weightKg: undefined }, { ...me, id: "me-3", date: "2025-03-01", heightCm: undefined, weightKg: 7 }, { ...ms, id: "other", childId: "z", milestoneId: "walks" }];
ok("memoriesOf: one child's memories", memoriesOf(all, "c").length === 7 && memoriesOf(all, "z").length === 1);
ok("milestonesLogged: by milestone id, per child", Object.keys(milestonesLogged(all, "c")).join() === "crawls" && milestonesLogged(all, "z").walks.id === "other");
ok("heightSeries: oldest first, only entries with a height", heightSeries(all, "c").map((h) => `${h.date}:${h.cm}`).join() === "2025-06-01:74.5,2025-09-01:80");
ok("weightSeries: oldest first, only entries with a weight", weightSeries(all, "c").map((w) => `${w.date}:${w.kg}`).join() === "2025-03-01:7,2025-06-01:9.2");
ok("a measurement with only a weight does not appear in the height chart (and vice versa)", !heightSeries(all, "c").some((h) => h.id === "me-3") && !weightSeries(all, "c").some((w) => w.id === "me-2"));
console.log(fails ? `${fails} FAILED` : "all memory-structure tests passed");
