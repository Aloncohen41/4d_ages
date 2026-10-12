/*
 * October 2026, fifth round: the PDF and video exports (a file copy that finishes in the background was treated as instant, so the shared or
 * saved file was missing or cut short), the Drive backup as one small zip with no extra copies of photos, the emergency number for where the
 * phone is, the whole birth story with confetti, the pregnancy told afterwards, and leaving the pregnancy out of the book.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipBackup, zipBackup, buildBackup, BACKUP_ZIP } from "../src/lib/backupData";
import { callLine, emergencyFor } from "../src/lib/emergency";
import { symptomDisclaimer } from "../src/lib/symptoms";
import { BIRTH_STORY_PARTS, CLASSICS } from "../src/lib/classics";
import { BOOK_SIZES, selectForBook, storyPages } from "../src/lib/bookPages";
import { pregnancyLastDay, usualDay } from "../src/lib/pregnancy";
import { Memory } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

// ---- the exports: every file copy is waited for
const code = ["src/lib/exportFiles.ts", "src/lib/media.ts", "src/lib/pdf.ts", "src/components/VideoExportSheet.tsx", "src/components/Voice.tsx", "src/lib/resize.ts"].map(read).join("\n");
ok("every file copy is waited for before the file is used or the original removed (the PDF and video bug)", !/(?<!await )new File\([^)]*\)\.copy\(|(?<!await )source\.copy\(/.test(code) && /await source\.copy\(dest\)/.test(code) && /await new File\(uri\)\.copy\(dest\)/.test(code));
ok("…and every caller waits for the named file", /uri: await withFriendlyName\(uri, fileName\)/.test(read("src/lib/pdf.ts")) && /setUri\(await withFriendlyName\(out, fileName\)\)/.test(read("src/components/VideoExportSheet.tsx")) && /await persistFile\(a\.uri/.test(read("src/lib/media.ts")) && /await persistFile\(out\.uri, "jpg"\)/.test(read("src/lib/resize.ts")));
ok("a copy that didn't finish whole is never handed on (the original is used instead)", /\(source\.size \?\? 0\) !== \(dest\.size \?\? -1\)\) return uri/.test(read("src/lib/exportFiles.ts")));

// ---- Drive backup: one zip, no photos copied again
const state = { kids: [{ id: "maya" }], memories: [{ id: "m1", media: [{ id: "x", uri: "file:///a.jpg", path: "maya/m1-x.jpg" }] }], relatives: [], classics: [], customDefs: {}, tags: [], activeId: "maya", milestoneAnswers: {}, tombstones: [], syncMeta: {}, familyOrder: {}, bookPrefs: {} };
const zip = zipBackup(buildBackup(state, "4D Ages 1.0.9", 6, 42));
const back = unzipBackup(zip);
ok("the backup is one zip file, and it opens again exactly", BACKUP_ZIP === "4D Ages backup.zip" && zip[0] === 0x50 && zip[1] === 0x4b && back.savedAt === 42 && (back.data.memories as Memory[])[0].media[0].path === "maya/m1-x.jpg");
ok("1.0.8's plain data file can still be restored", unzipBackup(new TextEncoder().encode(JSON.stringify(buildBackup(state, "x", 6, 7)))).savedAt === 7);
const drive = read("src/lib/driveBackup.ts");
ok("photos and videos aren't uploaded to Drive again (they're in the account already), and the old folder of copies goes to the bin", !/uploadFile\(auth\.accessToken, folder, u/.test(drive) && /trashed: true/.test(drive) && /LEGACY_FOLDER/.test(drive));
ok("after a restore the books sync, so their photos come back from the account", /syncAll\(\)\.catch/.test(drive) && /x\.path && !\(x\.uri && new File\(x\.uri\)\.exists\)/.test(read("src/lib/sync.ts")));

// ---- the emergency number
ok("the emergency number follows the phone's country: 101 (Magen David Adom) in Israel, 999 in the UK, 911 in the US, 112 in Europe", emergencyFor("IL").number === "101" && /Magen David Adom/.test(emergencyFor("IL").service) && emergencyFor("GB").number === "999" && emergencyFor("US").number === "911" && emergencyFor("DE").number === "112" && emergencyFor(null, "he").number === "101" && emergencyFor(null, null).number === "112");
ok("the tips' warnings and disclaimer use it", /In an emergency, call 101 \(Magen David Adom\)/.test(symptomDisclaimer(emergencyFor("IL"))) && /\{callLine\(emergency\)\}/.test(read("src/components/PregnancyNotes.tsx")) && callLine(emergencyFor("US")) === "call 911" && !/\(call 999/.test(read("src/lib/symptoms.ts")));

// ---- the birth story
const birth = CLASSICS.find((c) => c.id === "birth")!;
ok("the whole birth story, a part at a time (how it started, labour, the partner, meeting, going home…), each kept on the Birth story page", BIRTH_STORY_PARTS.length >= 10 && ["started", "labourStory", "partner", "firstMeeting", "home", "toBaby"].every((id) => BIRTH_STORY_PARTS.some((p) => p.id === id) && birth.fields.some((f) => f.id === id && f.kind === "long")));
const a4 = BOOK_SIZES.find((s) => /A4/.test(s.label))!;
const pages = storyPages(BIRTH_STORY_PARTS.map((p) => ({ label: p.label, text: "x".repeat(400) })), a4);
ok("in the book it gets pages of its own after the birth page, as many parts to a page as fit", pages.length >= 3 && pages.flat().length === BIRTH_STORY_PARTS.length && /kind: "birthStory"/.test(read("src/lib/bookPages.ts")) && /case "birthStory":/.test(read("src/lib/bookHtml.ts")));
ok("asked like a friend who can't wait to hear it", /We can't wait to hear how it went/.test(read("src/components/BirthStory.tsx")));
ok("it opens from “Welcome to the world” (over the whole app, so it isn't lost when the pregnancy pages close), and from the profile", /setBirthStoryFor\(child\.id\)/.test(read("src/components/Pregnancy.tsx")) && /<BirthStoryHost \/>/.test(read("app/_layout.tsx")) && /Tell us the birth story/.test(read("src/components/Screen.tsx")));
ok("confetti when the baby is here and when the story is told", /celebrate\(\);/.test(read("src/components/BirthStory.tsx")) && /else celebrate\(\);/.test(read("src/components/Pregnancy.tsx")) && /<Confetti \/>/.test(read("app/_layout.tsx")));

// ---- the pregnancy, told afterwards
ok("looking back: dates end the day before the birth, and a ticked milestone is dated to its usual week", pregnancyLastDay({ birth: "2025-06-10" }, "2026-10-12") === "2025-06-09" && pregnancyLastDay({ birth: "2027-01-01", expecting: true }, "2026-10-12") === "2026-10-12" && usualDay("2025-06-10", 20) === "2025-01-21");
ok("every profile (old ones too) can tell its pregnancy, from the profile, without tips or warnings", /Tell us how your pregnancy was/.test(read("src/components/Screen.tsx")) && /name="pregnancy"/.test(read("app/_layout.tsx")) && /const guide = symptom && !past \? symptomForTitle\(title\) : undefined/.test(read("src/components/PregnancyNotes.tsx")));

// ---- leaving the pregnancy out of the book
const mem = (id: string, date: string) => ({ id, childId: "c", date, tagIds: [] } as unknown as Memory);
const all = [mem("scan", "2025-03-01"), mem("born", "2025-06-10"), mem("smile", "2025-08-01")];
ok("the pregnancy is in the book unless you untick it", selectForBook(all, {}, [], { c: "2025-06-10" }).length === 3 && selectForBook(all, { pregnancy: false }, [], { c: "2025-06-10" }).map((m) => m.id).join() === "born,smile");
ok("the Book page has the tick box when there's anything from before the birth", /Include the pregnancy/.test(read("app/(tabs)/book.tsx")) && /set\(\{ pregnancy: prefs\.pregnancy === false \? undefined : false \}\)/.test(read("app/(tabs)/book.tsx")));

console.log(fails ? `${fails} FAILED` : "all round-five tests passed");
if (fails) process.exit(1);
