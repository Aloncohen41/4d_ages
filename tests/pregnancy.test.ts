/*
 * The pregnancy stage: a date still to come makes a pregnancy profile; Milestones has the pregnancy milestones (the first kick…) and the
 * symptoms and cravings; Growth has the week, the baby's size as a fruit (changing week by week), ultrasound pictures and scan measurements.
 */
import { untr } from "./untr";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FRUIT_WEEKS, PREGNANCY_MILESTONES, sizeForWeek, trimesterOf, weekOn } from "../src/lib/pregnancy";
import { CRAVING_IDEAS, SYMPTOMS } from "../src/lib/symptoms";
import { MILESTONE_DEFS, Memory } from "../src/lib/types";
import { heightSeries, weightSeries } from "../src/lib/selectors";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => untr(readFileSync(join(root, f), "utf8")); // the code as written in English (see untr.ts)

ok("a fruit for every week from 4 to 40, the baby growing every week", FRUIT_WEEKS.length === 37 && FRUIT_WEEKS.every((w, i) => w.week === 4 + i && (i === 0 || w.cm >= FRUIT_WEEKS[i - 1].cm)) && FRUIT_WEEKS.filter((w) => w.g).every((w, i, a) => i === 0 || w.g! >= a[i - 1].g!));
ok("the size this week: week 20 is a banana, week 12 a lime, before week 4 a poppy seed, after 40 a small pumpkin", sizeForWeek(20).fruit === "a banana" && sizeForWeek(12).fruit === "a lime" && sizeForWeek(2).week === 4 && sizeForWeek(41).week === 40);
ok("the pregnancy week on a date, from the due date (week 40 on the due date)", weekOn("2027-02-01", "2027-02-01") === 40 && weekOn("2027-02-01", "2026-10-12") === 24 && trimesterOf(12) === 1 && trimesterOf(20) === 2 && trimesterOf(30) === 3);
ok("pregnancy milestones, including the first kick, the heartbeat and the first scan, known everywhere by name", ["preg-first-kick", "preg-heartbeat", "preg-first-scan"].every((id) => PREGNANCY_MILESTONES.some((d) => d.id === id) && MILESTONE_DEFS.some((d) => d.id === id)));
ok("symptoms and cravings: ideas to tap, and anything else", SYMPTOMS.some((s) => s.label === "Morning sickness") && CRAVING_IDEAS.includes("Pickles") && /Something else/.test(read("src/components/PregnancyNotes.tsx")));
ok("Milestones and Growth switch to the pregnancy pages while the baby isn't born", /if \(child\.expecting\) return <PregnancySections \/>/.test(read("app/(tabs)/milestones.tsx")) && /<PregnancyMilestones child=\{child\} \/>/.test(read("app/(tabs)/milestones.tsx")) && /if \(child\.expecting\) \{[\s\S]*<PregnancyGrowth child=\{child\} \/>/.test(read("app/(tabs)/growth.tsx")));
ok("Growth: the fruit for this week, the scale week by week, ultrasound pictures and scan measurements", /The size of \{size\.fruit\}/.test(read("src/components/Pregnancy.tsx")) && /Week by week/.test(read("src/components/Pregnancy.tsx")) && /Add an ultrasound picture/.test(read("src/components/Pregnancy.tsx")) && /Add a scan measurement/.test(read("src/components/Pregnancy.tsx")));
const scan = { id: "s", childId: "c", type: "measure", description: "", date: "2026-09-01", media: [], tagIds: [], createdAt: 1, emoji: "", palette: "", source: "Scan", heightCm: 25, weightKg: 0.3 } as Memory;
const real = { ...scan, id: "r", source: "Measurement", date: "2027-03-01", heightCm: 54, weightKg: 4.2 } as Memory;
ok("a scan's estimates stay off the growth charts after birth", heightSeries([scan, real], "c").map((e) => e.id).join() === "r" && weightSeries([scan, real], "c").map((e) => e.id).join() === "r");
ok("ultrasound pictures go into the book, before the birth", /source: "Ultrasound"/.test(read("src/components/Pregnancy.tsx")) && /type: "photo", title: `Ultrasound, week/.test(read("src/components/Pregnancy.tsx")));

console.log(fails ? `${fails} FAILED` : "all pregnancy tests passed");
if (fails) process.exit(1);
