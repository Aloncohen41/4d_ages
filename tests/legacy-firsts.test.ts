import { migrateLegacyFirsts } from "../src/lib/migrate";
import { MILESTONE_DEFS, MILESTONE_CATEGORIES } from "../src/lib/types";
import { areaOf } from "../src/lib/development";
import { LEGACY_FIRSTS } from "../src/lib/migrate";
import { openIdeas, FIRST_IDEAS } from "../src/lib/suggestions";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const base: any = { id: "ms-c-first-steps", childId: "c", date: "2025-01-05", caption: "wobbly", kind: "photo", emoji: "👣", palette: "butter", people: [], milestoneId: "first-steps", source: "Milestone" };
const st: any = {
  photos: [base, { id: "other", childId: "c", date: "2025-01-01", caption: "x", kind: "photo", emoji: "📷", palette: "peach", people: [], source: "Added" }],
  milestones: { c: {
    "first-steps": { date: "2025-01-05", note: "three wobbly steps", emoji: "👣", media: [{ id: "m1", uri: "file:///s.jpg", kind: "photo" }], tags: ["home"], time: "10:15", location: "Living room", updatedAt: 9 },
    "slept-through": { date: "2025-02-01", note: "hooray", emoji: "🌙", media: [] },
  } },
};
const r = migrateLegacyFirsts(st);
const e = r.photos.find((p: any) => p.id === "en-mig-c-first-steps")!;
ok("old First milestone becomes a First entry with everything kept", !!e && e.entryKind === "first" && e.title === "First steps" && e.caption === "three wobbly steps" && e.time === "10:15" && e.location === "Living room" && e.tags![0] === "home" && e.uri === "file:///s.jpg" && e.media!.length === 1 && e.date === "2025-01-05");
ok("old record and its card are removed", !r.milestones.c["first-steps"] && !r.photos.some((p: any) => p.milestoneId === "first-steps"));
ok("real milestones and other photos are left alone", !!r.milestones.c["slept-through"] && r.photos.some((p: any) => p.id === "other"));
const r2 = migrateLegacyFirsts(r);
ok("running it twice changes nothing", r2.photos.length === r.photos.length && Object.keys(r2.milestones.c).length === 1);
ok("no built-in milestone shares an id with an old First", MILESTONE_DEFS.every((d) => !(d.id in LEGACY_FIRSTS)));
ok("every milestone belongs to an area and has an age window", MILESTONE_DEFS.every((d) => (MILESTONE_CATEGORIES as readonly string[]).includes(areaOf(d)) && d.months![0] < d.months![1]));
ok("unique milestone ids", new Set(MILESTONE_DEFS.map((d) => d.id)).size === MILESTONE_DEFS.length);
ok("ideas already used are hidden", openIdeas(FIRST_IDEAS, ["first steps", "First Word"]).every((i) => !["first steps", "first word"].includes(i.title.toLowerCase())) && openIdeas(FIRST_IDEAS, []).length === FIRST_IDEAS.length);
console.log(fails ? `${fails} FAILED` : "all migration tests passed");
