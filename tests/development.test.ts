import { MILESTONE_CATALOG, LEGACY_MILESTONE_DEFS, MILESTONE_DEFS, AREAS, BANDS, MILESTONE_CATEGORIES } from "../src/lib/types";
import { celebration, areaOf, memoryForDef, reachedDefIds, askStartMonths, suggestionsFor, defaultMilestoneDate, analyze, activitiesFor, reinforceBand, highlightText, reachedText, bandIndex, bandOfDef, ageLabel, ACTIVITIES, AREA_META, ageChip } from "../src/lib/development";
import { planMilestoneNotifications } from "../src/lib/milestonePlan";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const bad = /\d\s*out of\b|\bout of\s*[\d{$]|behind|late\b|delay|worr|concern|fail|miss|overdue|should have|catch up|slow/i;
const mem = (milestoneId: string, date = "2026-01-01"): any => ({ id: `ms-c-${milestoneId}`, childId: "c", type: "milestone", milestoneId, date, description: "", media: [], tagIds: [], createdAt: 1, emoji: "⭐", palette: "butter", source: "Milestone" });
const logged = (...ids: string[]) => Object.fromEntries(ids.map((i) => [i, mem(i)]));
const def = (id: string) => MILESTONE_CATALOG.find((d) => d.id === id)!;

// ---------- the chart
ok("4 areas × 6 age bands, every cell has milestones", AREAS.every((a) => BANDS.every(([lo]) => MILESTONE_CATALOG.some((d) => areaOf(d) === a && d.months![0] === lo))));
ok("each milestone's window is exactly its chart band", MILESTONE_CATALOG.every((d) => BANDS.some(([lo, hi]) => d.months![0] === lo && d.months![1] === hi)));
const cell = (a: string, b: number) => MILESTONE_CATALOG.filter((d) => d.category === a && d.months![0] === BANDS[b][0]).length;
ok("the number of milestones in each chart cell matches the chart", [[3, 1, 1, 2, 2, 3], [2, 2, 3, 2, 2, 2], [2, 2, 2, 3, 2, 2], [2, 4, 2, 4, 3, 3]].every((row, i) => row.every((n, b) => cell(AREAS[i], b) === n)));
ok("catalogue ids are unique and don't clash with the earlier list", new Set(MILESTONE_CATALOG.map((d) => d.id)).size === MILESTONE_CATALOG.length && MILESTONE_CATALOG.every((d) => !LEGACY_MILESTONE_DEFS.some((l) => l.id === d.id)));
const aliased = MILESTONE_CATALOG.flatMap((d) => d.aliases || []);
ok("every alias is a real earlier milestone, claimed by only one new one", aliased.every((a) => LEGACY_MILESTONE_DEFS.some((l) => l.id === a)) && new Set(aliased).size === aliased.length);
ok("everything can still be looked up by id (nothing already logged can lose its name)", LEGACY_MILESTONE_DEFS.every((l) => MILESTONE_DEFS.some((d) => d.id === l.id)) && MILESTONE_DEFS.length === MILESTONE_CATALOG.length + LEGACY_MILESTONE_DEFS.length);
ok("every earlier category maps to an area", LEGACY_MILESTONE_DEFS.every((l) => (MILESTONE_CATEGORIES as readonly string[]).includes(areaOf(l))) && areaOf({ category: "Thinking & play" }) === "Cognitive" && areaOf({ category: "Social & emotional" }) === "Social & Emotional" && areaOf({ category: "Feeding & self-care" }) === "Other" && areaOf({}) === "Other");
ok("each area has display details", [...AREAS, "Other" as const].every((a) => AREA_META[a].icon && AREA_META[a].color.startsWith("#") && AREA_META[a].phrase));

// ---------- earlier milestones still count
ok("a milestone logged under an OLD id counts as the new one (Crawls → Crawls or scoots)", memoryForDef(def("mov-crawls"), logged("crawls"))?.id === "ms-c-crawls" && memoryForDef(def("mov-crawls"), {}) === undefined);
ok("the new id works too, and reached ids include both routes", reachedDefIds(MILESTONE_CATALOG, logged("crawls", "mov-sits", "pulls-to-stand")).size === 2);

// ---------- asking "did it happen?" 1/6 early
ok("we start asking 1/6 of the way before a window opens: 5, 10, 15, 20, 25 months", [6, 12, 18, 24, 30].map((lo) => askStartMonths({ ...def("mov-sits"), months: [lo, lo + 6] })).join() === "5,10,15,20,25" && askStartMonths(def("mov-head")) === 0);
const pool = MILESTONE_CATALOG;
const band0 = pool.filter((d) => d.months![0] === 0).map((d) => d.id);
let s = suggestionsFor(pool, logged(...band0), {}, 5.2, "2026-07-01");
ok("at 5.2 months (band-0 all done) the 6–12 milestones are asked about, none from later bands", s.length === 4 && s.every((d) => d.months![0] === 6));
ok("…spread across different areas", new Set(s.map(areaOf)).size === 4);
s = suggestionsFor(pool, logged(...band0), {}, 4.5, "2026-07-01");
ok("too early (4.5 months): nothing from the next band yet", s.every((d) => d.months![0] === 0) || s.length === 0);
s = suggestionsFor(pool, {}, {}, 18, "2026-07-01", 6);
ok("never more than asked for; ticked ones are never asked", s.length <= 6 && suggestionsFor(pool, logged("mov-runs", "mov-ball", "mov-scribbles", "mov-self-feeds", "se-independence", "se-strong-feelings"), {}, 20, "2026-07-01", 20).every((d) => d.months![0] !== 18 || ["lang-phrases", "lang-gestures", "cog-copies", "cog-pretend", "cog-mirror"].includes(d.id)));
ok("after 'not yet' we don't ask again for a month, then we may", suggestionsFor(pool, {}, { "mov-runs": "2026-06-20" }, 19, "2026-07-01", 40).every((d) => d.id !== "mov-runs") && suggestionsFor(pool, {}, { "mov-runs": "2026-06-20" }, 19, "2026-07-25", 40).some((d) => d.id === "mov-runs"));
ok("custom / dateless milestones are never asked about", suggestionsFor([{ id: "x", label: "X", emoji: "⭐", hint: "" }], {}, {}, 10, "2026-07-01").length === 0);

// ---------- ticking off: which date
ok("current stage → dated today, no question", JSON.stringify(defaultMilestoneDate(def("mov-runs"), "2025-01-01", "2026-07-01")) === JSON.stringify({ date: "2026-07-01", ask: false }));
const past = defaultMilestoneDate(def("mov-head"), "2025-01-01", "2026-07-01");
ok("long past (0–6 months ticked at 18 months) → offer 'around 3 months' instead of today", past.ask && past.aroundMonths === 3 && past.date === "2025-04-01");
ok("a little late is fine (2 months of grace)", !defaultMilestoneDate(def("mov-head"), "2025-01-01", "2025-08-15").ask);

// ---------- Reinforce / outstanding / on track
let a = analyze(pool, {}, {}, 18);
ok("nothing marked → nothing is called weak: every area is just 'to explore'", a.areas.every((r) => r.status === "unanswered") && !a.highlight && a.reinforce.length === 0 && !a.anyData);
ok("…and nothing is counted against a maximum (reached is a plain count)", a.areas.every((r) => r.reached === 0));
a = analyze(pool, logged("mov-sits"), {}, 4);
ok("sitting at 4 months (2 months before its window) → Movement is outstanding", a.areas.find((r) => r.area === "Movement")!.status === "outstanding" && a.highlight?.area === "Movement" && a.highlight.ahead[0].id === "mov-sits");
ok("reaching something inside its window is simply on track, not 'ahead'", analyze(pool, logged("mov-sits"), {}, 7).areas.find((r) => r.area === "Movement")!.status === "ontrack");
a = analyze(pool, logged("lang-words"), { "mov-sits": "2026-06-01" }, 18);
ok("'not yet' on a milestone whose window passed (sits, 6–12) at 18 months → Movement: reinforce", a.areas.find((r) => r.area === "Movement")!.status === "reinforce" && a.reinforce.map((r) => r.area).join() === "Movement");
ok("…while Language, where something was ticked, is on track and is the highlight", a.areas.find((r) => r.area === "Language")!.status === "ontrack" && a.highlight?.area === "Language");
ok("'not yet' on something still inside its window is normal — never a reinforce", analyze(pool, {}, { "mov-runs": "2026-06-01" }, 18).reinforce.length === 0 && analyze(pool, {}, { "mov-runs": "2026-06-01" }, 18).areas.find((r) => r.area === "Movement")!.status === "unanswered");
ok("unanswered overdue milestones never make an area 'reinforce' — they are just 'to check'", (() => { const r = analyze(pool, logged("lang-words"), {}, 30).areas.find((x) => x.area === "Movement")!; return r.status === "unanswered" && r.toCheck.length > 0; })());
ok("reinforce wins over outstanding (be gentle, but honest)", analyze(pool, logged("mov-towers"), { "mov-sits": "2026-06-01" }, 18).areas.find((r) => r.area === "Movement")!.status === "reinforce");
ok("an older milestone logged under its earlier id counts", analyze(pool, logged("crawls"), {}, 8).areas.find((r) => r.area === "Movement")!.reached === 1);
ok("the best area is the one with most reached ahead of time, then most reached", (() => { const x = analyze(pool, logged("mov-sits", "mov-rolls", "lang-babbles"), {}, 4); return x.highlight?.area === "Movement"; })());
const rb = analyze(pool, {}, { "mov-sits": "x", "mov-runs": "x" }, 26).reinforce[0];
ok("practice ideas come from the EARLIER skill (sits, 6–12) not just today's age", reinforceBand(rb, 26) === 1 && bandOfDef(def("mov-sits")) === 1 && bandIndex(26) === 4);
ok("texts are positive and plain", highlightText("Chloe", analyze(pool, logged("mov-sits"), {}, 4).highlight!).includes("Wow, Chloe is really good at movement!") && highlightText("Chloe", analyze(pool, logged("mov-sits"), {}, 4).highlight!).includes("ahead of the usual timing") && reachedText(1) === "A first one reached 🎉" && reachedText(7) === "7 milestones reached" && ageLabel(18.4) === "18 months" && ageLabel(30) === "2 years 6 months" && ageLabel(1) === "1 month" && ageChip(18.4) === "18 mo" && ageChip(30) === "2y 6m" && ageChip(24) === "2y" && ageChip(0.4) === "0 mo");

// ---------- small numbers are celebrated, not announced
ok("nothing ticked yet: an invitation, not a zero", celebration(0, "Chloe").title === "Tick off what Chloe can do" && !/\b0\b/.test(celebration(0, "Chloe").title + celebration(0, "Chloe").sub));
ok("one milestone: 'a first milestone reached', never a bare '1'", celebration(1, "Chloe").title === "A first milestone reached! 🎉" && !/\b1\b/.test(celebration(1, "Chloe").title + celebration(1, "Chloe").sub));
ok("a few: the count comes with a warm line; plenty: a plain, proud count", celebration(3, "Chloe").sub.includes("lovely start") && celebration(12, "Chloe").title === "12 milestones reached" && !celebration(12, "Chloe").sub.includes("start"));
ok("no celebration line ever compares or counts against anything", [0, 1, 2, 3, 4, 5, 20, 55].every((n) => !bad.test(celebration(n, "Chloe").title + " " + celebration(n, "Chloe").sub)));

// ---------- things to try
ok("3 ideas for every area and every age band", AREAS.every((ar) => ACTIVITIES[ar].length === 6 && ACTIVITIES[ar].every((l) => l.length === 3 && l.every((x) => x.trim().length > 20))));
ok("all ideas are different", new Set(AREAS.flatMap((ar) => ACTIVITIES[ar].flat())).size === 72);
ok("ideas for a band; 'Other' has none; out-of-range bands are clamped", activitiesFor("Movement", 1)[0].includes("beyond reach") && activitiesFor("Other", 0).length === 0 && activitiesFor("Language", 99).length === 3 && activitiesFor("Language", -3).length === 3);

// ---------- notifications
const kids = [{ id: "c", name: "Chloe", birth: "2026-01-10" }];
const prefs = { enabled: true, daysBefore: 3, hour: 9 };
const now = new Date(2026, 0, 11);
const plan = planMilestoneNotifications(kids, prefs, now);
const cheers = plan.filter((p) => p.data.kind === "milestone-age"), asks = plan.filter((p) => p.data.kind === "milestone-ask");
ok("a cheer for every month from 1 to 35 (36 is the end of the chart)", cheers.length === 35 && cheers.map((p) => p.data.months).join() === Array.from({ length: 35 }, (_, i) => i + 1).join());
ok("12 and 24 months (also birthdays) get a cheer a few hours AFTER the birthday message, about their new stage", [12, 24].every((m) => { const c = cheers.find((p) => p.data.months === m)!; return c.date.getHours() === 12 && c.body.includes("new set of milestones"); }));
const six = cheers.find((p) => p.data.months === 6)!;
ok("on the day: 'Wow — Chloe is 6 months old today!', at the chosen hour", six.title === "🎉 Wow — Chloe is 6 months old today!" && six.date.getFullYear() === 2026 && six.date.getMonth() === 6 && six.date.getDate() === 10 && six.date.getHours() === 9);
ok("new stages (6, 18, 30 months) say a new set of milestones opened", [6, 18, 30].every((m) => cheers.find((p) => p.data.months === m)!.body.includes("new set of milestones")) && !cheers.find((p) => p.data.months === 7)!.body.includes("new set"));
ok("ages are written naturally (18 months, 2 years 6 months)", cheers.find((p) => p.data.months === 18)!.title.includes("18 months old") && cheers.find((p) => p.data.months === 30)!.title.includes("2 years 6 months old"));
ok("'is she starting any of these?' comes 1/6 before each stage: 5, 10, 15, 20, 25 months", asks.map((p) => p.data.months).join() === "5,10,15,20,25" && asks[0].date.getMonth() === 5 && asks[0].date.getDate() === 10);
ok("the question is later in the day than the cheer, so they aren't sent together", asks[0].date.getHours() === 13 && cheers.find((p) => p.data.months === 5)!.date.getHours() === 9);
ok("it names up to three milestones, from different areas", asks[0].body.split(" — ")[0].split(" · ").length === 3 && new Set(asks[0].body.split(" — ")[0].split(" · ")).size === 3);
const doneAll = new Set(MILESTONE_CATALOG.filter((d) => d.months![0] === 6).map((d) => d.id));
ok("nothing is asked about a stage whose milestones are all ticked", planMilestoneNotifications(kids, prefs, now, { c: doneAll }).filter((p) => p.data.kind === "milestone-ask").map((p) => p.data.months).join() === "10,15,20,25");
const some = new Set(["se-attachment", "lang-babbles"]);
const part = planMilestoneNotifications(kids, prefs, now, { c: some }).find((p) => p.data.kind === "milestone-ask" && p.data.months === 5)!;
ok("ticked milestones are left out of the question", !part.body.includes("Shows attachment") && !part.body.includes("Babbles"));
ok("switches: cheers off / questions off / everything off", planMilestoneNotifications(kids, { ...prefs, milestoneAges: false }, now).every((p) => p.data.kind === "milestone-ask") && planMilestoneNotifications(kids, { ...prefs, milestoneAsks: false }, now).every((p) => p.data.kind === "milestone-age") && planMilestoneNotifications(kids, { ...prefs, enabled: false }, now).length === 0);
ok("past dates are never scheduled", planMilestoneNotifications(kids, prefs, new Date(2026, 8, 1)).every((p) => p.date > new Date(2026, 8, 1)) && planMilestoneNotifications(kids, prefs, new Date(2030, 0, 1)).length === 0);
ok("two children get their own, with their own names", planMilestoneNotifications([...kids, { id: "d", name: "Leo", birth: "2026-03-01" }], prefs, now).filter((p) => p.title.includes("Leo")).length > 20);
ok("every notification is positive: no 'out of', 'behind', 'late', 'delayed'…", plan.every((p) => !bad.test(p.title) && !bad.test(p.body)));
console.log(fails ? `${fails} FAILED` : "all development / milestone-notification tests passed");
