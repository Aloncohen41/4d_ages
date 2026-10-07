/*
 * Exports: the album PDF and videos are named properly, a chosen thumbnail reaches the encoder, the title card says
 * “Here is Maya / at 1–2 years old”, and nothing can break the export. (Phone-only libraries are stood in for, just for this test.)
 */
const Module = require("module");
const path = require("node:path");
const { readFileSync } = require("node:fs");
const stub = (f: string) => path.join(__dirname, "stubs", f);
const MAP: Record<string, string> = { "expo-file-system": stub("file-system.js"), expo: stub("empty.js") };
const orig = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) { return MAP[request] ?? orig.call(this, request, ...rest); };

const { withFriendlyName } = require("../src/lib/exportFiles");
const { slideshowPayload } = require("../src/lib/videoExport");
const fsStub = require("./stubs/file-system.js");
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

// ---------- renaming an exported file
fsStub.__files.set("file:///cache/Print/3f9a-77c1.pdf", "pdf-bytes");
const named = withFriendlyName("file:///cache/Print/3f9a-77c1.pdf", "Maya Classic Album By 4D-Ages.pdf");
ok("the exported file is given its proper name (not the random temporary one)", named === "file:///cache/Maya Classic Album By 4D-Ages.pdf" && fsStub.__files.get(named) === "pdf-bytes");
ok("the temporary original is cleaned up", !fsStub.__files.has("file:///cache/Print/3f9a-77c1.pdf"));
fsStub.__files.set("file:///cache/x.mp4", "v2");
ok("exporting again overwrites the earlier file of the same name instead of failing", withFriendlyName("file:///cache/x.mp4", "Maya Classic Album By 4D-Ages.pdf") === named && fsStub.__files.get(named) === "v2");
ok("if renaming fails for any reason the ORIGINAL is used, so the export still works", withFriendlyName("file:///cache/BROKEN.pdf", "Whatever.pdf") === "file:///cache/BROKEN.pdf");

// ---------- what the encoder is sent
const child: any = { id: "c", name: "Maya", birth: "2025-03-10", emoji: "🌸" };
const slides: any[] = [{ id: "a", uri: "file:///a.jpg", emoji: "📷", palette: "peach", date: "2026-04-01", caption: "x" }, { id: "b", uri: "file:///b.jpg", emoji: "📷", palette: "peach", date: "2026-05-01", caption: "y" }];
const theme: any = { bg: "#fff8f9", ink: "#3d2630" };
const base = { speed: 1, format: "square", quality: "720", intro: true, title: "Here is Maya", subtitle: "at 1–2 years old" };
const withCover = slideshowPayload(child, slides, theme, { ...base, cover: "file:///b.jpg" });
const noCover = slideshowPayload(child, slides, theme, base);
ok("a chosen thumbnail is sent as the title card's cover", withCover.intro.cover === "file:///b.jpg" && withCover.intro.title === "Here is Maya" && withCover.intro.subtitle === "at 1–2 years old");
ok("with no cover the key is ABSENT — never null (Android's JSON reader would turn null into the text “null”)", !("cover" in noCover.intro) && !JSON.stringify(noCover).includes("null") && !JSON.stringify(noCover).includes('"cover"'));
ok("an empty cover is treated as none", !("cover" in slideshowPayload(child, slides, theme, { ...base, cover: "" }).intro));
ok("with the title card skipped there is no intro (and so nothing to put a cover on)", slideshowPayload(child, slides, theme, { ...base, intro: false, cover: "file:///b.jpg" }).intro === null && slideshowPayload(child, slides, theme, { ...base, intro: false }).introMs === 0);
ok("the pictures go through in order with their ages", withCover.items.length === 2 && withCover.items[0].uri === "file:///a.jpg" && withCover.items[0].age.length > 0);

// ---------- wiring
const pdf = read("src/lib/pdf.ts"), sheet = read("src/components/VideoExportSheet.tsx"), kt = read("modules/video-export/android/src/main/java/expo/modules/videoexport/SlideshowEncoder.kt");
ok("the album is shared as “[Name] [Style] Album By 4D-Ages.pdf”", /albumFileName\(i\.child\.name, i\.style\)/.test(pdf) && /withFriendlyName\(uri, fileName\)/.test(pdf) && /Sharing\.shareAsync\(named/.test(pdf));
ok("videos are made, shared and saved under “[Name] [what it shows] Video By 4D-Ages.mp4”", /videoFileName\(child\.name, fileLabel \|\| "Story"\)/.test(sheet) && /withFriendlyName\(out, fileName\)/.test(sheet) && /saveVideoToGallery\(uri, fileName\)/.test(sheet) && /dialogTitle: fileName/.test(sheet));
ok("the name is shown before you create the video", /Saved as “\{fileName\}”/.test(sheet));
ok("the export sheet offers the cover picture (only with a title card), spread across the video, with the chosen one marked", /Cover — the picture the video starts with/.test(sheet) && /intro && usable\.length > 1/.test(sheet) && /evenly\(usable, 30\)/.test(sheet) && /COVER/.test(sheet) && /cover: intro \? cover\?\.uri \?\? undefined : undefined/.test(sheet));
ok("the native encoder reads the cover and draws it on the title card (whole picture, over its blurred backdrop, with the title on a scrim)", /optString\("cover", ""\)/.test(kt) && /val cover = if \(item\.path != null\) bitmapFor\(idx\) else null/.test(kt) && /drawFit\(c, idx, cover, 1\.0\)/.test(kt) && /scrimPaint/.test(kt));
ok("without a cover the title card is exactly as before (emoji and plain colours)", /c\.drawColor\(item\.bg\)/.test(kt) && /emojiPaint\.textSize = min\(w, h\) \* 0\.2f/.test(kt));
ok("every place that exports a video passes what it shows: the reels, the custom builder, the year in review", /fileLabel=\{open\.fileLabel\}/.test(read("src/components/WatchView.tsx")) && /fileLabel=\{span\.file\}/.test(read("src/components/CustomReelSheet.tsx")) && /fileLabel=\{`Year \$\{year\}`\}/.test(read("src/components/Memories.tsx")));
// the title card and the photo captions must never share a cached layout
ok("the title card's text is cached under NEGATIVE keys, so it can never equal a photo's index (the first photo used to show the title card's subtitle)", kt.includes("layouts.getOrPut(-(idx * 2 + 1))") && kt.includes("layouts.getOrPut(-(idx * 2 + 2))") && !/layouts\.getOrPut\(idx \* 2/.test(kt) && (kt.match(/layouts\.getOrPut\(idx\)/g) || []).length === 1);
console.log(fails ? `${fails} FAILED` : "all export tests passed");
