/* "Watch them grow": age-based videos, calendar years kept, the newest section first; and the slider builder. (Reads the screens' source.) */
import { readFileSync } from "node:fs";
import { join } from "node:path";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
const watch = read("src/components/WatchView.tsx"), custom = read("src/components/CustomReelSheet.tsx"), reels = read("src/lib/reels.ts");

ok("the monthly summaries are gone", !/Monthly summaries/.test(watch) && !/months\.map|buildReels\(/.test(watch) && !/kind: "month"/.test(reels));
ok("the screen is built from the age-based and calendar-year sections", /buildWatchSections\(mine, child, today\)/.test(watch) && /sections\.age/.test(watch) && /sections\.years/.test(watch));
ok("the age section is named for the child and explained (“counted from their birthday, not the calendar”)", /\$\{child\.name\} by age/.test(watch) && /Counted from their birthday, not the calendar/.test(watch));
ok("the calendar-year section is kept", /By calendar year/.test(watch) && /January to December/.test(watch));
ok("the section holding the newest video is shown first", /sections\.first === "age" \? \["age", "years"\] : \["years", "age"\]/.test(watch) && /order\.map\(block\)/.test(watch));
ok("a period that isn't over says “so far”", /r\.inProgress \? " · so far" : ""/.test(watch));
ok("each video opens with its own title card text and file label (“Here is Maya”, “at 1–2 years old”, “1-2 years”)", /title=\{open\.title\} subtitle=\{open\.subtitle\} fileLabel=\{open\.fileLabel\}/.test(watch));
ok("from any video you can go and choose the pictures yourself, starting from its dates", /Choose the pictures yourself/.test(watch) && /setCustom\(\{ from: r\.from/.test(watch));
ok("the steps are 1, 3, 6 and 12 months, counted from birth, then every year of age", /AGE_STEPS = \[1, 3, 6, 12\]/.test(reels) && /export function ageWindows/.test(reels) && /addMonthsClamped\(birth, n \* 12\)/.test(reels));

// ---------- the builder
ok("two sliders, From and To, one day per step, over the child's whole life (birth → today)", (custom.match(/<Slider/g) || []).length === 1 && /<End label="From"/.test(custom) && /<End label="To"/.test(custom) && /step=\{1\}/.test(custom) && /minimumValue=\{0\}/.test(custom) && /maximumValue=\{total\}/.test(custom));
ok("while sliding, the date and the child's age at that end show live — at BOTH ends", /onValueChange=\{\(v: number\) => onLive\(Math\.round\(v\)\)\}/.test(custom) && /ageShort\(child\.birth, date\)/.test(custom) && /formatDate\(date\)/.test(custom) && /\$\{child\.name\} is \$\{age\}/.test(custom));
ok("the age range for the whole video is shown live too (“Here is Maya / at 1–2 years old”)", /Here is \{child\.name\}/.test(custom) && /at \{liveSpan\.display\} old/.test(custom) && /rangeSpan\(child\.birth, live\.from \?\? range\.from, live\.to \?\? range\.to\)/.test(custom));
ok("the heavy part (which pictures are in range) only changes when you let go, so sliding stays smooth", /onSlidingComplete=\{\(v: number\) => onCommit\(Math\.round\(v\)\)\}/.test(custom) && /React\.memo\(function Gallery/.test(custom) && /\[memories, fromDate, toDate\]/.test(custom));
ok("one end can never cross the other, and the slider is reset to the real value after each release", /clampRange\(/.test(custom) && /key=\{`\$\{label\}-\$\{rev\}`/.test(custom));
ok("one-day nudge buttons for fine control", /\{nudge\(-1\)\}/.test(custom) && /\{nudge\(1\)\}/.test(custom) && /chevron-left/.test(custom) && /chevron-right/.test(custom));
ok("one-tap starting points: last 30 days, every age step reached, all time", /presetRanges\(child\.birth, today\)/.test(custom));
ok("the video is named by what it shows: title card and file", /videoTitles\(child\.name, span, name\)/.test(custom) && /fileLabel=\{span\.file\}/.test(custom));
ok("you can still type a name of your own, and tick/untick pictures", /Name your video \(optional\)/.test(custom) && /Select all/.test(custom));
ok("the cover picture is chosen when creating the video", /choose the cover picture when you create it/.test(custom) && /Cover — the picture the video starts with/.test(read("src/components/VideoExportSheet.tsx")));
console.log(fails ? `${fails} FAILED` : "all watch-screen tests passed");
