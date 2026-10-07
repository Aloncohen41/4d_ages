/*
 * The real store, run end to end for the new milestone flow: tick, untick, "not yet", milestones logged under an older id,
 * and what Reinforce makes of it. (Phone-only libraries are replaced by tiny stand-ins, just for this test.)
 */
const Module = require("module");
const path = require("node:path");
const stub = (f: string) => path.join(__dirname, "stubs", f);
const MAP: Record<string, string> = {
  zustand: stub("zustand.js"), "zustand/middleware": stub("zustand-middleware.js"), "@react-native-async-storage/async-storage": stub("async-storage.js"),
  "expo-file-system": stub("file-system.js"), "expo-image-picker": stub("empty.js"), expo: stub("empty.js"),
};
const orig = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) { return MAP[request] ?? orig.call(this, request, ...rest); };

const { useStore } = require("../src/lib/store");
const { logMilestone } = require("../src/lib/saveMilestone");
const { milestonesLogged } = require("../src/lib/selectors");
const { MILESTONE_CATALOG } = require("../src/lib/types");
const { analyze, memoryForDef, suggestionsFor, defaultMilestoneDate, reachedDefIds } = require("../src/lib/development");
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };

const st = () => useStore.getState();
const def = (id: string) => MILESTONE_CATALOG.find((d: any) => d.id === id);
const tick = (id: string, date = "2026-07-01", extra: any = {}) => logMilestone({ childId: "c", defId: id, title: def(id).label, emoji: def(id).emoji, date, tagIds: [], note: "", media: [], ...extra });
const mine = () => st().memories.filter((m: any) => m.childId === "c" && m.type === "milestone");
useStore.setState({ kids: [{ id: "c", name: "Chloe", birth: "2025-01-01", theme: "pink", emoji: "🌸" }], activeId: "c", memories: [], customDefs: {}, milestoneAnswers: {} });

// ---- ticking
ok("ticking a milestone creates one milestone memory for it", tick("mov-sits") === null && mine().length === 1 && mine()[0].milestoneId === "mov-sits" && mine()[0].title === "Sits" && mine()[0].date === "2026-07-01");
ok("it now counts as reached", !!memoryForDef(def("mov-sits"), milestonesLogged(st().memories, "c")) && reachedDefIds(MILESTONE_CATALOG, milestonesLogged(st().memories, "c")).has("mov-sits"));
ok("ticking the same one again by name is refused (no duplicates)", logMilestone({ childId: "c", title: "Sits", emoji: "🪑", date: "2026-07-02", tagIds: [], note: "", media: [] })?.includes("already logged") === true && mine().length === 1);

// ---- "not yet" and its effects
st().answerNotYet("c", "mov-crawls", "2026-06-01");
ok("'not yet' is remembered per child and milestone", st().milestoneAnswers.c["mov-crawls"] === "2026-06-01");
ok("…and a milestone with 'not yet' is not asked about again for a month", suggestionsFor(MILESTONE_CATALOG, milestonesLogged(st().memories, "c"), st().milestoneAnswers.c, 19, "2026-06-10", 60).every((d: any) => d.id !== "mov-crawls"));
ok("at 18 months a 'not yet' on Crawls (6–12 months, long passed) makes Movement 'reinforce' with ideas to try", analyze(MILESTONE_CATALOG, milestonesLogged(st().memories, "c"), st().milestoneAnswers.c, 18).reinforce.map((r: any) => r.area).join() === "Movement");
tick("mov-crawls", "2026-07-02");
ok("ticking it later clears the 'not yet' — and Movement is no longer a reinforce area", st().milestoneAnswers.c["mov-crawls"] === undefined && analyze(MILESTONE_CATALOG, milestonesLogged(st().memories, "c"), st().milestoneAnswers.c, 18).reinforce.length === 0);

// ---- editing: details added with the pencil
tick("mov-sits", "2026-06-15", { note: "Wobbly at first", tagIds: ["tag-other-home"] });
ok("the pencil (editing) updates the SAME memory with a date, note and tags — no copy", mine().filter((m: any) => m.milestoneId === "mov-sits").length === 1 && mine().find((m: any) => m.milestoneId === "mov-sits").description === "Wobbly at first" && mine().find((m: any) => m.milestoneId === "mov-sits").date === "2026-06-15");

// ---- unticking (revert)
const sits = mine().find((m: any) => m.milestoneId === "mov-sits");
st().removeMemory(sits.id);
ok("unticking removes the memory, and the circle is empty again", !mine().some((m: any) => m.milestoneId === "mov-sits") && !memoryForDef(def("mov-sits"), milestonesLogged(st().memories, "c")));
ok("…and it can be ticked again afterwards", tick("mov-sits") === null && mine().filter((m: any) => m.milestoneId === "mov-sits").length === 1);

// ---- a milestone logged before the chart existed
st().saveMemory({ childId: "c", type: "milestone", milestoneId: "walks", title: "Walks alone", description: "first steps!", date: "2026-02-01", media: [], tagIds: [], emoji: "🚶" });
ok("a milestone logged under an OLD id already shows as ticked in the new chart (Walks alone → Walks independently)", !!memoryForDef(def("mov-walks"), milestonesLogged(st().memories, "c")));
const before = mine().length;
tick("mov-walks", "2026-02-01", { note: "first steps!!" });
ok("editing it through the chart updates that memory instead of adding a second one", mine().length === before && mine().find((m: any) => m.title === "Walks independently").description === "first steps!!" && mine().find((m: any) => m.milestoneId === "mov-walks"));
ok("unticking an old-id milestone works through the chart too", (() => { const m = memoryForDef(def("mov-walks"), milestonesLogged(st().memories, "c")); st().removeMemory(m.id); return !memoryForDef(def("mov-walks"), milestonesLogged(st().memories, "c")); })());

// ---- your own milestone
ok("a milestone of your own is created on the spot and counted", logMilestone({ childId: "c", title: "Waves at the cat", emoji: "🐈", category: "Other", date: "2026-07-03", tagIds: [], note: "", media: [] }) === null && st().customDefs.c.length === 1 && mine().some((m: any) => m.title === "Waves at the cat"));

// ---- dates when ticking
ok("ticking something from the current stage is dated today without asking; something from long ago asks", !defaultMilestoneDate(def("mov-runs"), "2025-01-01", "2026-07-01").ask && defaultMilestoneDate(def("se-smiles"), "2025-01-01", "2026-07-01").ask);

// ---- removing a child's answers with the rest
st().resetAll();
ok("clearing everything also clears the 'not yet' answers", Object.keys(st().milestoneAnswers).length === 0);
console.log(fails ? `${fails} FAILED` : "all milestone-flow tests passed");
