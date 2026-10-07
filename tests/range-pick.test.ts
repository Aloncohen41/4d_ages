import { dayDate, dayIndex, totalDays, clampRange, rangeSpan, presetRanges, videoTitles, wholeMonths } from "../src/lib/rangePick";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const birth = "2025-03-10", today = "2026-10-06";
const total = totalDays(birth, today);

ok("a slider position is a day number since birth: 0 is the birth day, the last is today", dayDate(birth, 0) === "2025-03-10" && dayDate(birth, total) === today && total === 575);
ok("a date maps back to its position (and is kept inside the child's life)", dayIndex(birth, "2025-03-11", total) === 1 && dayIndex(birth, "2020-01-01", total) === 0 && dayIndex(birth, "2030-01-01", total) === total);
ok("fractions from the slider are rounded to whole days", dayDate(birth, 30.4) === "2025-04-09" && dayDate(birth, 30.6) === "2025-04-10");

// the two ends
ok("moving the start past the end pushes against it: it stops at the end", JSON.stringify(clampRange(300, 200, "from", total)) === '{"from":200,"to":200}');
ok("moving the end back past the start stops at the start", JSON.stringify(clampRange(100, 40, "to", total)) === '{"from":100,"to":100}');
ok("normal moves are untouched", JSON.stringify(clampRange(50, 400, "from", total)) === '{"from":50,"to":400}' && JSON.stringify(clampRange(50, 400, "to", total)) === '{"from":50,"to":400}');
ok("nothing can leave 0…today", JSON.stringify(clampRange(-5, 9999, "to", total)) === `{"from":0,"to":${total}}`);

// the age at each end, and how the stretch is worded
ok("0 → 6 months of age reads “0–6 months”", rangeSpan(birth, 0, dayIndex(birth, "2025-09-10", total)).display === "0–6 months");
ok("first birthday → second birthday reads “1–2 years”, and “1-2 years” in a file name", rangeSpan(birth, dayIndex(birth, "2026-03-10", total), dayIndex(birth, "2027-03-10", 99999)).display === "1–2 years" && rangeSpan(birth, dayIndex(birth, "2026-03-10", total), dayIndex(birth, "2027-03-10", 99999)).file === "1-2 years");
ok("an odd stretch reads in completed months: 2026-05-10 is 14 months, 2026-10-06 is 18 months and 26 days → “14–18 months”", rangeSpan(birth, dayIndex(birth, "2026-05-10", total), dayIndex(birth, "2026-10-06", total)).display === "14–18 months");
ok("a birthday is exactly that many months: 365 days after birth is 12 months (not 11)", wholeMonths(birth, "2026-03-10") === 12 && wholeMonths(birth, "2026-03-09") === 11 && wholeMonths(birth, "2027-03-10") === 24 && wholeMonths(birth, birth) === 0);
ok("a stretch inside one month (both ends in month 15) reads as that one age", rangeSpan(birth, dayIndex(birth, "2026-06-12", total), dayIndex(birth, "2026-06-20", total)).display === "15 months");

// presets
const presets = presetRanges(birth, today);
ok("one-tap starting points: last 30 days, each age step reached, and all time", presets.map((p) => p.label).join(" | ") === "Last 30 days | 0–1 month | 0–3 months | 0–6 months | 0–1 year | 1–2 years | All time");
ok("‘Last 30 days’ ends today; ‘All time’ is the whole life", presets[0].to === total && presets[0].from === total - 30 && presets.at(-1)!.from === 0 && presets.at(-1)!.to === total);
ok("‘1–2 years’ starts on the first birthday and, as it isn't over, ends today", dayDate(birth, presets.find((p) => p.label === "1–2 years")!.from) === "2026-03-10" && presets.find((p) => p.label === "1–2 years")!.to === total);
ok("a newborn only gets presets that cover a real stretch", presetRanges("2026-10-05", "2026-10-06").map((p) => p.label).join() === "Last 30 days,0–1 month,0–3 months,0–6 months,0–1 year,All time");
ok("a baby born today has nothing to choose yet (no zero-length presets, a single position)", totalDays("2026-10-06", "2026-10-06") === 0 && presetRanges("2026-10-06", "2026-10-06").every((p) => p.id === "recent" || p.id === "all"));

// the title card
const span = rangeSpan(birth, dayIndex(birth, "2026-03-10", total), total);
ok("title card: “Here is Maya” over “at 1–2 years old”", JSON.stringify(videoTitles("Maya", { display: "1–2 years", file: "1-2 years" }, "")) === '{"title":"Here is Maya","subtitle":"at 1–2 years old"}');
ok("a name you type replaces the first line only; the age line stays", JSON.stringify(videoTitles("Maya", { display: "1–2 years", file: "1-2 years" }, "  Maya's busy year ")) === '{"title":"Maya\'s busy year","subtitle":"at 1–2 years old"}' && span.display.length > 0);
console.log(fails ? `${fails} FAILED` : "all range-pick tests passed");
