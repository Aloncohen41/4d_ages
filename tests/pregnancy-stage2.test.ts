/*
 * The pregnancy, round two: "Week 20 (banana)" instead of an age before the birth; the gender reveal (the date, and girl or boy, which sets the
 * child's gender); the milestones by trimester; "Welcome to the world", which sets the birthday and makes it the child's own profile; and the
 * weekly bump photo (a reminder, tips, and the video of the bump growing).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BORN_ID, BUMP_SOURCE, BUMP_TIPS, GENDER_REVEAL_ID, PREGNANCY_MILESTONES, milestonesByTrimester, planBumpPhotoNotifications, pregnancyWeekOf, weekLabel } from "../src/lib/pregnancy";
import { ageBucket, ageShort } from "../src/lib/date";
import { buildBumpReel } from "../src/lib/reels";
import { Memory } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
const preg = read("src/components/Pregnancy.tsx"), screen = read("src/components/Screen.tsx");

// Week xx (fruit), wherever an age would be shown
ok("before the birth: the week and the baby's size, not an age", weekLabel("2027-02-01", "2026-09-01") === "Week 18 (sweet pepper)" && weekLabel("2027-02-01", "2026-10-12") === "Week 24 (corn cob)" && weekLabel("2027-02-01", "2026-05-10") === "Week 1" && weekLabel("2027-02-01", "2025-01-01") === "Before birth");
ok("posts, the feed and the book say it too", ageShort("2027-02-01", "2026-09-01") === "Week 18 (sweet pepper)" && ageBucket("2027-02-01", "2026-09-01") === "Week 18 (sweet pepper)" && ageShort("2027-02-01", "2027-02-01") === "birth day" && ageBucket("2027-02-10", "2027-02-20") === "Newborn");
ok("the top bar and the profile show the week and the fruit", /k\.expecting \? weekLabel\(k\.birth, todayISO\(\)\)/.test(screen) && /\{weekLabel\(child\.birth, todayISO\(\)\)\} · /.test(screen));

// gender reveal
ok("a gender reveal milestone (kept under the old id, so a ticked one stays ticked)", GENDER_REVEAL_ID === "preg-boy-or-girl" && PREGNANCY_MILESTONES.find((d) => d.id === GENDER_REVEAL_ID)?.label === "Gender reveal");
ok("the gender reveal asks the date and girl, boy or a surprise, and sets the child's gender", /title="Gender reveal"/.test(preg) && /label: "A surprise"/.test(preg) && /updateChild\(child\.id, \{ gender: \(choice === "surprise" \? "unspecified" : choice\)/.test(preg) && /When you found out/.test(preg));
ok("gender when adding a child (Girl, Boy, Prefer not to say); for a pregnancy it's set at the reveal", /\{!expecting \? \(\s*<>\s*<Label>Gender<\/Label>/.test(screen) && /"Not known yet" : "Prefer not to say"/.test(screen) && /gender: expecting \? \("unspecified" as Gender\) : gender/.test(screen));

// by trimester, ending with the birth
const tri = milestonesByTrimester();
ok("milestones by trimester, in week order, every one in exactly one", tri.length === 3 && tri.every((x) => x.defs.every((d, i, a) => i === 0 || (pregnancyWeekOf(d) ?? 0) >= (pregnancyWeekOf(a[i - 1]) ?? 0))) && tri.reduce((n, x) => n + x.defs.length, 0) === PREGNANCY_MILESTONES.length - 1 && tri[0].defs.some((d) => d.id === "preg-heartbeat") && tri[1].defs.some((d) => d.id === "preg-first-kick") && tri[2].defs.some((d) => d.id === "preg-bag-packed"));
ok("the last milestone is the birth: Welcome to the world", PREGNANCY_MILESTONES[PREGNANCY_MILESTONES.length - 1].id === BORN_ID && PREGNANCY_MILESTONES[PREGNANCY_MILESTONES.length - 1].label === "Welcome to the world" && /milestonesByTrimester\(\)\.map/.test(preg));
ok("Welcome to the world sets the birthday, the name and the gender, and makes it the child's own profile", /export function ArrivalSheet/.test(preg) && /updateChild\(child\.id, \{ name: name\.trim\(\), birth: date, gender, expecting: undefined/.test(preg) && /defId: def\.id, title: def\.label, emoji: def\.emoji, date, tagIds: \[\], note: note\.trim\(\)/.test(preg));
ok("“The baby is here!” in the profile opens the same sheet", /<Btn label="The baby is here!" icon="birthday" onPress=\{onArrived\}/.test(screen) && /<ArrivalSheet child=\{child\}/.test(screen));

// the weekly bump photo
const due = "2027-02-01";
const plan = planBumpPhotoNotifications([{ id: "b", name: "Bump", birth: due, expecting: true }, { id: "k", name: "Maya", birth: "2025-01-01" }, { id: "v", name: "Viewer", birth: due, expecting: true, role: "viewer" }], { enabled: true, hour: 9 }, new Date(2026, 9, 11, 12));
ok("a weekly bump photo reminder, on the first day of each pregnancy week until the due date (not for a born child, or one you only view)", plan.length > 10 && plan.every((p) => p.data.childId === "b") && plan.every((p, i) => i === 0 || p.date.getTime() - plan[i - 1].date.getTime() === -7 * 86400000 || Math.abs(p.date.getTime() - plan[i - 1].date.getTime()) >= 6 * 86400000) && plan.every((p) => p.date.getDay() === new Date(2027, 1, 1).getDay()) && plan.some((p) => p.title === "Week 39: time for the bump photo 📸"));
ok("the reminder can be turned off", planBumpPhotoNotifications([{ id: "b", name: "Bump", birth: due, expecting: true }], { enabled: true, hour: 9, bumpPhoto: false }, new Date(2026, 9, 11)).length === 0 && /Weekly bump photo/.test(read("src/components/RemindersCard.tsx")));
ok("reminders are told which children are pregnancies (so a pregnancy gets no birthday reminders from its due date)", /expecting: k\.expecting, role: k\.role/.test(read("app/_layout.tsx")) && /planBumpPhotoNotifications\(kids, prefs, now\)/.test(read("src/lib/notifications.ts")) && /d\.kind === "bump-photo"/.test(read("app/_layout.tsx")));
ok("tips for photos that line up: same spot, side-on, same height and light", BUMP_TIPS.length >= 5 && BUMP_TIPS.some((t) => /same spot/i.test(t)) && BUMP_TIPS.some((t) => /side-on/.test(t)) && BUMP_TIPS.some((t) => /light/.test(t)));
ok("this week's bump photo on Home, until it's taken", /Week \{bumpWeek\}: time for the bump photo/.test(read("src/components/HomeCards.tsx")) && /<BumpTips \/>/.test(read("src/components/HomeCards.tsx")));
const photo = (id: string, date: string, source = BUMP_SOURCE) => ({ id, childId: "b", type: "photo", title: "", description: "", date, media: [{ id: id + "m", kind: "photo", uri: `file:///${id}.jpg` }], tagIds: [], createdAt: 1, emoji: "🤰", palette: "", source } as unknown as Memory);
const reel = buildBumpReel([photo("w20", "2026-09-15"), photo("w22", "2026-09-29"), photo("other", "2026-09-20", "Ultrasound")], { id: "b", name: "Noa", birth: due }, BUMP_SOURCE);
ok("the bump photos play as a video, week by week (only the bump photos, oldest first)", !!reel && reel.slides.map((s) => s.memoryId).join() === "w20,w22" && reel.title === "Waiting for Noa" && buildBumpReel([photo("w20", "2026-09-15")], { id: "b", name: "Noa", birth: due }, BUMP_SOURCE) === null);
ok("the bump video is in Growth while pregnant, and in Watch them grow after the birth", /Play the bump video/.test(preg) && /buildBumpReel\(mine, child, BUMP_SOURCE\)/.test(read("src/components/WatchView.tsx")));

console.log(fails ? `${fails} FAILED` : "all pregnancy stage 2 tests passed");
if (fails) process.exit(1);
