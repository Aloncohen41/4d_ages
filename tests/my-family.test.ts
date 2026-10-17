/*
 * "My family": everyone's posts in one timeline, and the children's heights side by side on the door frame, on a date or at the same age.
 */
import { untr } from "./untr";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ageSpan, dateSpan, familyTimeline, heightAtAge, heightOnDate } from "../src/lib/familyCompare";
import type { Memory } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => untr(readFileSync(join(__dirname, "..", f), "utf8")); // the code as written in English (see untr.ts)

const m = (id: string, childId: string, date: string) => ({ id, childId, date, type: "story", description: "", media: [], tagIds: [], createdAt: date }) as unknown as Memory;
const tl = familyTimeline([m("a", "maya", "2025-01-01"), m("b", "leo", "2026-05-01"), m("c", "other", "2026-06-01"), m("d", "maya", "2026-02-01")], [{ id: "maya" }, { id: "leo" }]);
ok("the timeline: everyone in the family, newest first, no one else's", tl.map((x) => x.id).join() === "b,d,a");

const maya = [{ id: "1", date: "2024-09-15", cm: 50 }, { id: "2", date: "2025-09-15", cm: 76 }, { id: "3", date: "2026-09-15", cm: 88 }];
ok("on a date: their last height on or before it, nothing before their first", heightOnDate(maya, "2025-12-01") === 76 && heightOnDate(maya, "2024-01-01") === null && heightOnDate(maya, "2026-10-01") === 88);
const half = heightAtAge(maya, "2024-09-15", 18);
ok("at an age: worked out between the measurements either side (about 82 cm at 18 months)", half != null && half > 80 && half < 84);
ok("…and nothing made up well outside what was measured", heightAtAge(maya, "2024-09-15", 40) === null && heightAtAge(maya, "2024-09-15", 0) === 50);
ok("the sliders run from the first measurement to the last (by date), and youngest to oldest age measured", JSON.stringify(dateSpan([maya, [{ id: "x", date: "2026-10-01", cm: 60 }]])) === JSON.stringify({ from: "2024-09-15", to: "2026-10-01" }) && JSON.stringify(ageSpan([{ birth: "2024-09-15", entries: maya }])) === JSON.stringify({ from: 0, to: 24 }));

const page = read("app/my-family.tsx");
ok("the page: Timeline and Door frame, a Same age switch, and a slider for each; no weight charts and no everyday objects", /label: "Timeline"/.test(page) && /label: "Door frame"/.test(page) && /accessibilityRole="switch"/.test(page) && /label="Age"/.test(page) && /label="Date"/.test(page) && !/LineChart|weight/i.test(page) && !/DOOR_REFS/.test(read("src/components/GrowthChart.tsx").split("export function FamilyDoorFrame")[1]));
ok("a My family chip beside the profiles, on the phone and the website, when there's more than one", /router\.push\("\/my-family"\)/.test(read("src/components/Screen.tsx")) && /router\.navigate\("\/my-family"\)/.test(read("src/components/SiteHeader.tsx")) && /<Stack\.Screen name="my-family" \/>/.test(read("app/_layout.tsx")));

console.log(fails ? `${fails} FAILED` : "all my-family tests passed");
if (fails) process.exit(1);
