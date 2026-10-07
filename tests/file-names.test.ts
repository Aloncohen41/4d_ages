import { albumFileName, videoFileName, cleanPart, FILE_BRAND } from "../src/lib/fileNames";
import { ageSpan, ageWord } from "../src/lib/ageSpan";
import { addMonthsClamped } from "../src/lib/date";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };

// ---------- file names
ok("the brand reads 4D-Ages inside a file name", FILE_BRAND === "4D-Ages");
ok("the baby book: “Maya Classic Album By 4D-Ages.pdf” (and Minimal, Storybook)", albumFileName("Maya", "classic") === "Maya Classic Album By 4D-Ages.pdf" && albumFileName("Maya", "minimal") === "Maya Minimal Album By 4D-Ages.pdf" && albumFileName("Maya", "storybook") === "Maya Storybook Album By 4D-Ages.pdf");
ok("a video: “Maya 1-2 years Video By 4D-Ages.mp4” (an en dash becomes a hyphen)", videoFileName("Maya", "1–2 years") === "Maya 1-2 years Video By 4D-Ages.mp4" && videoFileName("Leo", "0–6 months") === "Leo 0-6 months Video By 4D-Ages.mp4" && videoFileName("Maya", "2026") === "Maya 2026 Video By 4D-Ages.mp4");
ok("characters no file name may hold are removed (slashes, colons, quotes, question marks…)", cleanPart('a/b\\c:d*e?f"g<h>i|j') === "a b c d e f g h i j" && !/[\\/:*?"<>|]/.test(albumFileName('Ma/ya: "the" <best>?', "classic")));
ok("emoji and invisible joiners are dropped, accents kept", cleanPart("Zoë 😀🌸") === "Zoë" && cleanPart("👨‍👩‍👧 Family") === "Family");
ok("a very long name is cut to a sensible length, and never ends in a dot or space", cleanPart("x".repeat(200)).length === 40 && cleanPart("Maya...") === "Maya" && cleanPart("  Maya  ") === "Maya");
ok("an empty or all-symbol name falls back to something readable", albumFileName("", "classic") === "Baby Classic Album By 4D-Ages.pdf" && albumFileName("😀", "classic").startsWith("Baby ") && videoFileName("Maya", "") === "Maya Story Video By 4D-Ages.mp4");
ok("names with spaces and apostrophes stay natural", albumFileName("Mary Jane", "classic") === "Mary Jane Classic Album By 4D-Ages.pdf" && albumFileName("O'Neil", "classic") === "O'Neil Classic Album By 4D-Ages.pdf");
ok("an unknown book style still gives a valid, tidy name", albumFileName("Maya", "") === "Maya Classic Album By 4D-Ages.pdf" && albumFileName("Maya", "STORYBOOK") === "Maya Storybook Album By 4D-Ages.pdf");

// ---------- age ranges
ok("0 to 1 month, 3 months, 6 months", ageSpan(0, 1).display === "0–1 month" && ageSpan(0, 3).display === "0–3 months" && ageSpan(0, 6).display === "0–6 months");
ok("whole years read as years: 0–1 year, 1–2 years, 2–3 years", ageSpan(0, 12).display === "0–1 year" && ageSpan(12, 24).display === "1–2 years" && ageSpan(24, 36).display === "2–3 years");
ok("in between, months up to two years: 14–20 months", ageSpan(14, 20).display === "14–20 months" && ageSpan(5, 12).display === "5–12 months");
ok("a longer awkward range uses years and months", ageSpan(27, 37).display === "2y 3m – 3y 1m");
ok("the order doesn't matter, and fractions are floored", ageSpan(20, 14).display === "14–20 months" && ageSpan(0.9, 6.7).display === "0–6 months");
ok("one age on its own", ageSpan(5, 5).display === "5 months" && ageSpan(12, 12).display === "1 year" && ageWord(1) === "1 month" && ageWord(18) === "18 months" && ageWord(27) === "2y 3m");
ok("for files the dash is a plain hyphen", ageSpan(12, 24).file === "1-2 years" && ageSpan(27, 37).file === "2y 3m-3y 1m" && !ageSpan(0, 6).file.includes("–"));

// ---------- months that don't overflow
ok("Jan 31 + 1 month is Feb 28 (not Mar 3); in a leap year Feb 29", addMonthsClamped("2026-01-31", 1) === "2026-02-28" && addMonthsClamped("2028-01-31", 1) === "2028-02-29");
ok("ordinary dates, year rollover, and 12 months = the birthday", addMonthsClamped("2026-03-15", 3) === "2026-06-15" && addMonthsClamped("2026-11-10", 3) === "2027-02-10" && addMonthsClamped("2025-07-04", 12) === "2026-07-04");
ok("a Feb 29 birthday's first birthday is Feb 28", addMonthsClamped("2024-02-29", 12) === "2025-02-28");
console.log(fails ? `${fails} FAILED` : "all file-name and age-range tests passed");
