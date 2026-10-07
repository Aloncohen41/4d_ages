import { dateIndex, inPeriod, periodLabel } from "../src/lib/dates";
import { searchMemories } from "../src/lib/search";
import { coverOf, filesOf } from "../src/lib/display";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const items = [{ date: "2026-09-03" }, { date: "2026-09-03" }, { date: "2026-09-21" }, { date: "2026-03-01" }, { date: "2025-12-31" }, { date: "2024-01-15" }];
const idx = dateIndex(items);
ok("years newest first, with counts", idx.map((y) => `${y.year}:${y.count}`).join() === "2026:4,2025:1,2024:1");
ok("months newest first inside a year; only months that have something", idx[0].months.map((m) => `${m.month}:${m.count}`).join() === "9:3,3:1" && idx[1].months.length === 1);
ok("days newest first; same-day entries are counted together", idx[0].months[0].days.map((d) => `${d.day}:${d.count}`).join() === "21:1,3:2");
ok("nothing is offered for dates that have no memories", !idx.some((y) => y.year === 2023 || y.year === 2027) && !idx[0].months.some((m) => m.month === 4));
ok("period matching: year, month, day", inPeriod("2026-09-03", { year: 2026 }) && inPeriod("2026-09-03", { year: 2026, month: 9 }) && !inPeriod("2026-09-03", { year: 2026, month: 3 }) && inPeriod("2026-09-03", { year: 2026, month: 9, day: 3 }) && !inPeriod("2026-09-03", { year: 2026, month: 9, day: 4 }) && !inPeriod("2025-09-03", { year: 2026 }));
ok("period labels", periodLabel({ year: 2026 }) === "2026" && periodLabel({ year: 2026, month: 9 }) === "September 2026" && periodLabel({ year: 2026, month: 9, day: 3 }) === "3 September 2026");
ok("an empty list gives an empty index", dateIndex([]).length === 0);

const mem: any[] = [
  { id: "a", type: "story", title: "Lake day", description: "Splashing in the shallows", date: "2025-06-01", location: "Lake Tahoe", tagIds: ["tag-person-rosa"], media: [] },
  { id: "b", type: "first", title: "First steps", description: "wobbly", date: "2025-10-05", tagIds: [], media: [] },
  { id: "c", type: "photo", description: "snow day", date: "2026-01-01", tagIds: ["tag-other-beach"], media: [] },
];
const tags: any[] = [{ id: "tag-person-rosa", name: "Grandma Rosa", category: "person", relatedFamilyMemberId: "rosa" }, { id: "tag-other-beach", name: "beach", category: "other" }];
const rel: any[] = [{ id: "rosa", name: "Rosa", relation: "Grandma", emoji: "👵" }];
const ids = (q: string) => searchMemories(mem, q, tags, rel).map((m) => m.id).join();
ok("search by title, text, place, tag, person and type", ids("lake") === "a" && ids("wobbly") === "b" && ids("tahoe") === "a" && ids("beach") === "c" && ids("grandma") === "a" && ids("first") === "b");
ok("every word must match; newest first; blank gives nothing", ids("lake splashing") === "a" && ids("lake wobbly") === "" && ids("e") === "c,b,a" && ids("  ") === "");

const v = (o: any) => ({ id: "v", kind: "video", uri: "file:///v.mp4", ...o });
const p = { id: "p", kind: "photo", uri: "file:///p.jpg" };
ok("cover: the FIRST usable item in your order wins", coverOf([p as any, v({ thumb: "file:///t.jpg" })])!.uri === "file:///p.jpg" && coverOf([v({ thumb: "file:///t.jpg" }), p as any])!.uri === "file:///t.jpg");
ok("cover: a video with a thumbnail shows the thumbnail (flagged as video); one without only if nothing else", coverOf([v({ thumb: "file:///t.jpg" })])!.video === true && coverOf([v({}), p as any])!.uri === "file:///p.jpg" && coverOf([v({})])!.kind === "video" && coverOf([]) === null);
ok("files of a memory include video thumbnails", filesOf([p as any, v({ thumb: "file:///t.jpg" })]).join() === "file:///p.jpg,file:///v.mp4,file:///t.jpg");
console.log(fails ? `${fails} FAILED` : "all date / search / cover tests passed");
