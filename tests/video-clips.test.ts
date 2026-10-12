/*
 * Videos inside a made video: the clip itself plays (not a still of it), the whole of a short one and 30 seconds of a long one, from where
 * the parent chose. (Phone-only libraries are stood in for, just for this test.)
 */
const Module = require("module");
const path = require("node:path");
const { readFileSync } = require("node:fs");
const stub = (f: string) => path.join(__dirname, "stubs", f);
const MAP: Record<string, string> = { "expo-file-system": stub("file-system.js"), expo: stub("empty.js") };
const orig = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) { return MAP[request] ?? orig.call(this, request, ...rest); };

const { slidesOf } = require("../src/lib/slides");
const { slideshowPayload, clipPlays, clampClipStart, estimateSeconds, CLIP_MAX_MS } = require("../src/lib/videoExport");
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

const mk = (id: string, date: string, media: any[]) => ({ id, childId: "c", type: "photo", description: id, date, media, tagIds: [], createdAt: 1, emoji: "📷", palette: "peach", source: "x" });
const mem = [
  mk("p", "2025-01-01", [{ id: "1", kind: "photo", uri: "file:///p.jpg" }]),
  mk("v", "2025-02-01", [{ id: "1", kind: "video", uri: "file:///v.mp4", thumb: "file:///v.jpg" }]),
  mk("pv", "2025-03-01", [{ id: "1", kind: "photo", uri: "file:///pv.jpg" }, { id: "2", kind: "video", uri: "file:///pv.mp4", thumb: "file:///pv-t.jpg" }]),
];
const slides = slidesOf(mem);
ok("a video's slide carries the video itself (its picture stays, standing in if it can't be played)", slides[1].clip === "file:///v.mp4" && slides[1].uri === "file:///v.jpg" && slides[1].video);
ok("a photo's slide has no clip, even when the post also has a video (the photo is its picture)", !slides[0].clip && !slides[2].clip);
ok("picking one by one: each video brings its clip", slidesOf(mem, { perMedia: true }).find((s: any) => s.id === "pv:2").clip === "file:///pv.mp4");

ok("a short clip plays whole; a long one for 30 seconds, never past its end", clipPlays(12_000) === 12_000 && clipPlays(95_000) === CLIP_MAX_MS && clipPlays(95_000, 80_000) === 15_000 && CLIP_MAX_MS === 30_000);
ok("the 30 seconds can't start so late that less is left", clampClipStart(90_000, 95_000) === 65_000 && clampClipStart(-5, 95_000) === 0 && clampClipStart(10_000, 20_000) === 0);
ok("the video's length counts each clip at its own length", estimateSeconds(2, 1, false, 30_000) === 2 * 2.4 + 30);

const child: any = { id: "c", name: "Maya", birth: "2024-01-01", emoji: "👶" };
const theme: any = { bg: "#fff8f9", ink: "#3d2630", accent: "#c0587e" };
const base = { speed: 1, format: "square", quality: "720", intro: false, title: "", subtitle: "" };
const pay = slideshowPayload(child, slides, theme, { ...base, clipStarts: { v: 50_000 }, clipLengths: { v: 70_000 } });
ok("the encoder is sent the clip, where it starts and how long it plays", pay.items[1].clip === "file:///v.mp4" && pay.items[1].clipStartMs === 40_000 && pay.items[1].clipMs === 30_000 && !("clip" in pay.items[0]));
ok("a clip whose length isn't known yet is sent from the start, for 30 seconds at most", slideshowPayload(child, slides, theme, base).items[1].clipStartMs === 0 && slideshowPayload(child, slides, theme, base).items[1].clipMs === 30_000);

const kt = read("modules/video-export/android/src/main/java/expo/modules/videoexport/SlideshowEncoder.kt");
const reader = read("modules/video-export/android/src/main/java/expo/modules/videoexport/ClipReader.kt");
ok("on the phone: the clip is decoded frame by frame from the chosen moment, turned upright, and drawn whole", /SEEK_TO_PREVIOUS_SYNC/.test(reader) && /getOutputImage/.test(reader) && /90 -> \{ sx = dy; sy = sh - 1 - dx \}/.test(reader) && /drawFit\(c, i, frame, 1\.0\)/.test(kt) && /METADATA_KEY_VIDEO_ROTATION/.test(kt));
ok("…a clip lasts as long as it plays, and one that can't be played shows its picture instead", /durations\.add\(clipMs\)/.test(kt) && /unplayable\.add\(i\)/.test(kt) && /readers\.remove\(k\)\?\.close\(\)/.test(kt) && /for \(r in readers\.values\) r\.close\(\)/.test(kt));
ok("…the age and caption fade after a few seconds, so the clip is seen whole", /drawClipOverlay\(c, i, item, localMs\)/.test(kt));
const sheet = read("src/components/VideoExportSheet.tsx");
ok("the export sheet: long videos (over 30 seconds) offer choosing their 30 seconds, and it's sent on", /Long videos: choose the 30 seconds to show/.test(sheet) && /\(lengths\[s\.id\] \?\? 0\) > CLIP_MAX_MS/.test(sheet) && /<ClipTrim uri=\{s\.clip!\}/.test(sheet) && /clipStarts, clipLengths: lengths \}/.test(sheet));
ok("the chooser plays the chosen 30 seconds over and over and moves them with a slider", /player\.currentTime = startMs \/ 1000/.test(read("src/components/ClipTrim.tsx")) && /onSlidingComplete/.test(read("src/components/ClipTrim.tsx")) && /videoDuration/.test(read("modules/video-export/android/src/main/java/expo/modules/videoexport/VideoExportModule.kt")));

console.log(fails ? `${fails} FAILED` : "all clip tests passed");
if (fails) process.exit(1);
