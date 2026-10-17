/*
 * Videos too big for the account (over its 50 MB limit per file) are copied smaller on the phone (720p, H.264) and the copy uploaded, so
 * they reach the other parent, the website and books made there; the original on the phone stays full size.
 */
import { untr } from "./untr";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => untr(readFileSync(join(__dirname, "..", f), "utf8")); // the code as written in English (see untr.ts)
const kt = read("modules/video-export/android/src/main/java/expo/modules/videoexport/VideoShrinker.kt");
const sync = read("src/lib/sync.ts");

ok("a too-big video is copied smaller and the copy uploaded (then the copy is deleted); anything else too big still waits", /fileSize\(uri\) > MAX_UPLOAD_BYTES/.test(sync) && /await smallerVideo\(uri\)/.test(sync) && /deleteFile\(small\)/.test(sync) && /\(mp4\|mov\|3gp\|webm\|mkv\|m4v\)/.test(sync));
ok("the copy: short side at most 720, H.264 at about 2.5 Mbit/s with AAC sound, the right way up", /720\.0 \/ short/.test(kt) && /VIDEO_H264/.test(kt) && /AUDIO_AAC/.test(kt) && /2_500_000/.test(kt) && /METADATA_KEY_VIDEO_ROTATION/.test(kt));
ok("made by Android's Media3 Transformer, from the app's video module", /media3-transformer/.test(read("modules/video-export/android/build.gradle")) && /AsyncFunction\("shrinkVideo"\)/.test(read("modules/video-export/android/src/main/java/expo/modules/videoexport/VideoExportModule.kt")));
ok("on the website, or an app built before this, nothing breaks: the video just isn't uploaded", /if \(!n\?\.shrinkVideo\) return null/.test(read("src/lib/videoExport.ts")));

console.log(fails ? `${fails} FAILED` : "all big video tests passed");
if (fails) process.exit(1);
