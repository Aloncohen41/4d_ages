/*
 * Made videos, Google-Photos style: suggested events (a big day, a trip, a birthday, a month), only them or with family, cards of words from
 * the stories, four looks, and music (public domain) under it all, quieter while a video's own sound plays.
 */
const Module = require("module");
const path = require("node:path");
const { existsSync, readFileSync, statSync } = require("node:fs");
const stub = (f: string) => path.join(__dirname, "stubs", f);
const MAP: Record<string, string> = { "expo-file-system": stub("file-system.js"), expo: stub("empty.js") };
const orig = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) { return MAP[request] ?? orig.call(this, request, ...rest); };

const { suggestEvents, eventSlides, filterByWho, storyWords, spanLabel, cardMs } = require("../src/lib/videoEvents");
const { VIDEO_TEMPLATES, MUSIC, musicFor } = require("../src/lib/videoStyles");
const { slideshowPayload } = require("../src/lib/videoExport");
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

let n = 0;
const photo = (date: string, extra: any = {}) => ({ id: `m${++n}`, childId: "c", type: "photo", description: "", date, media: [{ id: "x", kind: "photo", uri: `file:///p${n}.jpg` }], tagIds: [], createdAt: 1, emoji: "📷", palette: "peach", source: "x", ...extra });
const many = (date: string, k: number, extra: any = {}) => Array.from({ length: k }, () => photo(date, extra));
const child = { id: "c", name: "Maya", birth: "2023-05-20" };

const mem = [
  ...many("2025-05-20", 5),                                       // her 2nd birthday
  ...many("2026-07-04", 9),                                       // a big Saturday
  ...many("2026-08-10", 5, { location: "Brighton, UK" }), ...many("2026-08-11", 4, { location: "Brighton, UK" }), ...many("2026-08-13", 4, { location: "Brighton" }), // a trip (a quiet day in between)
  ...many("2026-09-03", 3), ...many("2026-09-15", 4), ...many("2026-09-28", 4),          // a busy September, no single big day
  ...many("2026-06-01", 3),                                       // just a few: nothing
];
const ev = suggestEvents(mem, child, "2026-10-12");
const of = (k: string) => ev.filter((e: any) => e.kind === k);
ok("a birthday with photos: “Maya's 2nd birthday”", of("birthday").length === 1 && of("birthday")[0].title === "Maya's 2nd birthday" && of("birthday")[0].photos === 5);
ok("a day full of photos: “A Saturday to remember”", of("day").length === 1 && of("day")[0].title === "A Saturday to remember" && of("day")[0].from === "2026-07-04");
ok("days in a row (a quiet day between is fine), at one place: “4 days in Brighton”", of("trip").length === 1 && of("trip")[0].title === "4 days in Brighton" && of("trip")[0].from === "2026-08-10" && of("trip")[0].to === "2026-08-13" && of("trip")[0].photos === 13);
ok("a busy month: “September with Maya” (and the trip's days aren't suggested again on their own)", of("month").some((e: any) => e.title === "September with Maya") && !of("day").some((e: any) => e.from.startsWith("2026-08")));
ok("newest first, each with its dates and photos", ev[0].to >= ev[ev.length - 1].to && ev.every((e: any) => /photos$/.test(e.subtitle)) && spanLabel("2026-08-10", "2026-08-13") === "10–13 August 2026" && spanLabel("2026-04-30", "2026-05-02") === "30 Apr – 2 May 2026");
ok("a few photos on a day is not an event", !ev.some((e: any) => e.from === "2026-06-01"));
ok("an event's video is every picture in it", eventSlides(mem, of("day")[0]).length === 9);

const tagged = photo("2026-01-01", { tagIds: ["tag-person-grandma"] });
const alone = photo("2026-01-02");
const slides = [{ memoryId: tagged.id }, { memoryId: alone.id }];
ok("who's in it: everyone, only them (no one else tagged), or with family", filterByWho(slides, [tagged, alone], [], "all").length === 2 && filterByWho(slides, [tagged, alone], [], "alone")[0].memoryId === alone.id && filterByWho(slides, [tagged, alone], [], "family")[0].memoryId === tagged.id);
const stories = storyWords([photo("2026-02-01", { type: "story", title: "The zoo", description: "She roared at the lions." }), photo("2026-02-02", { type: "story", description: "  " })], "c");
ok("words come from the stories you wrote", stories.length === 1 && stories[0].title === "The zoo" && stories[0].text === "She roared at the lions.");
ok("a card of words stays long enough to read", cardMs("short", 2400) === 3360 && cardMs("x".repeat(300), 2400) === 8000);

ok("four looks: Classic, Story, Snapshots and Journal, each with its own music", VIDEO_TEMPLATES.map((x: any) => x.id).join() === "classic,story,snapshots,journal" && VIDEO_TEMPLATES.every((x: any) => MUSIC.some((m: any) => m.id === x.music)));
ok("music that suits it: a party for a birthday, something happy for a trip, and No music is a choice", musicFor("story", "birthday") === "celebrate" && musicFor("classic", "trip") === "ukulele" && musicFor("journal") === "garden" && musicFor("story") === "stars" && MUSIC.some((m: any) => m.id === "none"));
const files = ["stars", "ukulele", "garden", "celebrate"].map((x) => `assets/music/${x}.m4a`);
ok("every track is in the app, small enough (under 2.5 MB each), with its credits", files.every((f) => existsSync(path.join(__dirname, "..", f)) && statSync(path.join(__dirname, "..", f)).size < 2.5 * 1024 * 1024) && /public domain/i.test(read("assets/music/CREDITS.txt")));

const theme: any = { bg: "#fff8f9", ink: "#3d2630", accent: "#c0587e" };
const sl = [{ id: "a", memoryId: "a", uri: "file:///a.jpg", emoji: "📷", palette: "peach", date: "2026-03-01", caption: "" }, { id: "b", memoryId: "b", uri: "file:///b.jpg", emoji: "📷", palette: "peach", date: "2026-03-05", caption: "" }];
const pay = slideshowPayload({ id: "c", name: "Maya", birth: "2024-01-01" }, sl, theme, { speed: 1, format: "square", quality: "720", intro: false, title: "", subtitle: "", template: "snapshots", musicUri: "file:///m.m4a", cards: [{ id: "own", date: "", text: "Our summer" }, { id: "s", date: "2026-03-02", text: "The zoo!", kicker: "The zoo" }] });
ok("the encoder gets the look, the music and the cards, each card in its place by date", pay.template === "snapshots" && pay.music === "file:///m.m4a" && pay.clipSound === true && pay.items.map((x: any) => x.card ? `card:${x.text}` : x.uri).join() === "card:Our summer,file:///a.jpg,card:The zoo!,file:///b.jpg" && pay.cardBg === "#fff8f9");

const kt = read("modules/video-export/android/src/main/java/expo/modules/videoexport/SlideshowEncoder.kt");
const mix = read("modules/video-export/android/src/main/java/expo/modules/videoexport/AudioMixer.kt");
ok("on the phone: four looks drawn, and cards of words", /"story" ->/.test(kt) && /"snapshots" ->/.test(kt) && /drawJournal\(/.test(kt) && /drawTextCard\(c, i, item, localMs\)/.test(kt));
ok("…the music loops to the length, fades in and out, and goes quieter under a video's own sound", /PcmReader\(it, 0L, true\)/.test(mix) && /fadeOut/.test(mix) && /0\.22 \+ 0\.78/.test(mix) && /MIMETYPE_AUDIO_AAC/.test(mix));
ok("…and the sound is written alongside the pictures in the same file", /audioTrack = mux\.addTrack\(audio\.format\)/.test(kt) && /writeAudioUntil\(mux, info\.presentationTimeUs \+ 500_000L\)/.test(kt));
ok("Watch them grow: “Made for you” suggestions, named and made in the Story look", /Made for you/.test(read("src/components/WatchView.tsx")) && /initialTemplate="story"/.test(read("src/components/EventVideoSheet.tsx")) && /setVideoEvent\(key, \{ dismissed: true \}\)/.test(read("src/components/EventVideoSheet.tsx")));

console.log(fails ? `${fails} FAILED` : "all video style tests passed");
if (fails) process.exit(1);
