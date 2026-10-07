import { buildAgeReels, buildCalendarReels, buildWatchSections, ageWindows, evenly, yearHighlights } from "../src/lib/reels";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
let n = 0;
const mk = (date: string, o: any = {}) => ({ id: `m${n++}`, childId: "c", type: "photo", description: "x", date, media: [{ id: "i", kind: "photo", uri: `file:///${n}.jpg` }], tagIds: [], createdAt: 1, emoji: "📷", palette: "peach", source: "x", ...o });
const child = { id: "c", name: "Maya", birth: "2025-03-10" };
const labels = (rs: any[]) => rs.map((r) => r.label).join(" | ");

// ---------- the windows of a life
const w = ageWindows("2025-03-10", "2026-10-06");   // 1 year 7 months old
ok("the steps are since birth to 1, 3, 6 months and 1 year, then each year of age that has begun (1–2 years)", w.map((x) => `${x.startM}-${x.endM}`).join() === "0-1,0-3,0-6,0-12,12-24");
ok("a child under a year old has only the first steps", ageWindows("2026-09-01", "2026-10-06").map((x) => x.endM).join() === "1,3,6,12");
ok("every full year of age that has begun gets a window, as far as the child has got", ageWindows("2022-03-10", "2026-10-06").map((x) => `${x.startM / 12}-${x.endM / 12}`).filter((s) => !s.startsWith("0")).join() === "1-2,2-3,3-4,4-5");
ok("the windows are counted from the CHILD's birthday, not the calendar: 1–2 years is Mar 10 2026 → Mar 10 2027", w[4].from === "2026-03-10" && w[4].to === "2027-03-10" && w[0].from === "2025-03-10" && w[0].to === "2025-04-10");
ok("month ends don't overflow (born Jan 31: 0–1 month ends Feb 28)", ageWindows("2026-01-31", "2026-06-01")[0].to === "2026-02-28");

// ---------- the age reels
const mem: any[] = [
  mk("2025-03-12"), mk("2025-03-20"), mk("2025-04-02"),                       // first month (3): 0–1 month
  mk("2025-05-15"), mk("2025-05-20"),                                        // up to 3 months: more
  mk("2025-08-01"), mk("2025-10-20"),                                        // to 6 / 12 months
  mk("2026-01-05"), mk("2026-02-20"), mk("2026-03-10"),                      // to the 1st birthday (inclusive)
  mk("2026-04-02"), mk("2026-06-18"), mk("2026-09-30"),                      // 1–2 years (so far)
  mk("2025-06-06", { childId: "other" }), mk("2025-06-07", { childId: "other" }),
];
const age = buildAgeReels(mem, child, "2026-10-06");
ok("the age videos, newest first: 1–2 years, 0–1 year, 0–6 months, 0–3 months, 0–1 month", labels(age) === "1–2 years | 0–1 year | 0–6 months | 0–3 months | 0–1 month");
ok("each is counted from birth: 0–1 month holds only the first month's 3 pictures", age.find((r) => r.label === "0–1 month")!.slides.length === 3);
ok("0–6 months includes everything since birth up to 6 months (and not what comes later)", age.find((r) => r.label === "0–6 months")!.slides.every((s) => s.date <= "2025-09-10") && age.find((r) => r.label === "0–6 months")!.slides.length === 6);
ok("the first birthday counts as the end of the first year", age.find((r) => r.label === "0–1 year")!.slides.some((s) => s.date === "2026-03-10"));
ok("the year of age 1–2 holds only that year, and is marked as not finished (“so far”)", age[0].slides.map((s) => s.date).join() === "2026-03-10,2026-04-02,2026-06-18,2026-09-30" && age[0].inProgress && !age.find((r) => r.label === "0–1 year")!.inProgress);
ok("another child's memories are never mixed in", age.every((r) => r.slides.every((s) => !s.memoryId.startsWith("other")) ) && buildAgeReels(mem, { ...child, id: "other", birth: "2025-06-01" }, "2026-10-06").length > 0);
ok("each video carries its title card text: “Here is Maya” / “at 1–2 years old”, and a file label “1-2 years”", age[0].title === "Here is Maya" && age[0].subtitle === "at 1–2 years old" && age[0].fileLabel === "1-2 years" && age[2].fileLabel === "0-6 months");
ok("each has slides in date order, a cover picture, and the date range it covers", age.every((r) => r.slides.every((s, i, a) => i === 0 || a[i - 1].date <= s.date) && !!r.cover?.uri && r.from <= r.to));
ok("a step with too little in it gets no video (one picture is not a video)", !labels(buildAgeReels([mk("2025-03-12")], child, "2026-10-06")).includes("0–1 month"));
const baby = buildAgeReels([mk("2026-09-02"), mk("2026-09-10"), mk("2026-09-20")], { id: "c", name: "Leo", birth: "2026-09-01" }, "2026-10-06");
ok("a young baby: steps that would show exactly the same pictures are shown once, under the shortest name", labels(baby) === "0–1 month");
ok("…and the step is marked as finished or not by the calendar (a 5-week-old's first month has ended; 0–3 months has not)", baby[0].inProgress === false && buildAgeReels([mk("2026-09-02"), mk("2026-09-10"), mk("2026-10-04")], { id: "c", name: "Leo", birth: "2026-09-01" }, "2026-10-06").every((r) => r.inProgress || r.label === "0–1 month"));
ok("nothing to summarise → no videos", buildAgeReels([], child, "2026-10-06").length === 0);
const busy: any[] = Array.from({ length: 120 }, (_, i) => mk(`2025-${String((i % 11) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`, { media: [{ id: "i", kind: "photo", uri: `file:///big${i}.jpg` }] })).filter((m) => m.date >= "2025-03-10");
const busyAge = buildAgeReels(busy, child, "2026-10-06");
ok("a busy stretch is capped (at most 40), spread across it, still in order", busyAge.every((r) => r.slides.length <= 40 && r.slides.every((s, i, a) => i === 0 || a[i - 1].date <= s.date)));

// ---------- calendar years (kept)
const cal = buildCalendarReels(mem, child, "2026-10-06");
ok("calendar-year videos are kept: 2026 and 2025, newest first, with the year as their name", labels(cal) === "2026 | 2025" && cal[0].title === "Maya · 2026" && cal[0].fileLabel === "2026");
ok("this calendar year is marked as not finished", cal[0].inProgress && !cal[1].inProgress);
ok("the calendar reels are separate from the child's-age ones (different pictures per video)", cal[0].slides.map((s) => s.date).join() !== age[0].slides.map((s) => s.date).join());
ok("there is no monthly summary any more", ![...age, ...cal].some((r) => /September|December|August/.test(r.label)));

// ---------- which section comes first
const sec = buildWatchSections(mem, child, "2026-10-06");
ok("the section holding the newest video goes first; with a tie, the child's-age section", sec.first === "age" && sec.age[0].newest === "2026-09-30" && sec.years[0].newest === "2026-09-30");
// the child's-age step that holds the newest picture has only ONE picture (too thin for a video), but the calendar year has two
const thin: any[] = [mk("2025-04-01"), mk("2025-04-05"), mk("2026-01-05"), mk("2026-09-30")];
const s3 = buildWatchSections(thin, child, "2026-10-06");
ok("when the newest video is in the calendar-year section (the 1–2 years step has just one picture), that section is shown first", s3.age[0].label === "0–1 year" && s3.age[0].newest === "2026-01-05" && s3.years[0].label === "2026" && s3.years[0].newest === "2026-09-30" && s3.first === "years");
ok("…and when the child's-age section holds the newest, it is first", buildWatchSections([...thin, mk("2026-10-01")], child, "2026-10-06").first === "age");
ok("an empty library has empty sections", buildWatchSections([], child, "2026-10-06").age.length === 0 && buildWatchSections([], child, "2026-10-06").years.length === 0);

// ---------- unchanged helpers
ok("evenly keeps the first and last", (() => { const r = evenly([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4); return r[0] === 1 && r[r.length - 1] === 10 && r.length === 4; })());
const special: any[] = [mk("2026-03-01", { type: "milestone" }), mk("2026-03-02", { type: "first" }), mk("2026-03-03", { type: "last" }), mk("2026-03-04"), mk("2026-03-05"), mk("2026-03-06"), mk("2026-03-07")];
const hl = yearHighlights(special);
ok("highlights always keep milestones, firsts and lasts, and at most 2 other memories per month", ["milestone", "first", "last"].every((t) => hl.some((m) => m.type === t)) && hl.filter((m) => m.type === "photo").length === 2);
console.log(fails ? `${fails} FAILED` : "all reel tests passed");
