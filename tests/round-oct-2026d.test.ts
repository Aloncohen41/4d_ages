/*
 * October 2026, fourth round: symptoms and cravings laid out like Firsts and Lasts (symptoms with a stretch of days and NHS-based tips that never
 * go into the book), a shorter invite link with a preview card, "you already have this book" instead of using an invite up, the app's own
 * notifications, Google Drive backup and restore, and saving and sharing the PDF through Android itself.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CRAVING_IDEAS, OTHER_SYMPTOM_NOTE, SYMPTOMS, SYMPTOM_DISCLAIMER, legacyIsCraving, symptomForTitle } from "../src/lib/symptoms";
import { inviteMessage } from "../src/lib/shareFlow";
import { formatSpan } from "../src/lib/date";
import { BACKUP_FORMAT, baseName, buildBackup, filesIn, parseBackup, prepareRestore, remapFiles } from "../src/lib/backupData";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

// ---- symptoms and cravings
ok("plenty of symptoms from the NHS pages, each with tips and its NHS page", SYMPTOMS.length >= 20 && SYMPTOMS.every((s) => s.tips.length > 0 && /^https:\/\/www\.nhs\.uk\/pregnancy\//.test(s.source)) && new Set(SYMPTOMS.map((s) => s.id)).size === SYMPTOMS.length);
ok("the serious signs are there (pre-eclampsia with headaches and swelling, ICP with itching, severe sickness)", !!symptomById("headache")?.urgentIf?.some((x) => /vision/.test(x)) && !!symptomById("swelling")?.urgentIf?.some((x) => /sudden swelling/.test(x)) && !!symptomById("itch")?.urgentIf?.some((x) => /palms/.test(x)) && !!symptomById("sickness")?.callIf?.some((x) => /24 hours/.test(x)));
function symptomById(id: string) { return SYMPTOMS.find((s) => s.id === id); }
ok("every set of tips ends with the disclaimer: not medical advice, see the midwife or doctor, emergency number", /aren't medical advice/.test(SYMPTOM_DISCLAIMER) && /midwife, GP or doctor/.test(SYMPTOM_DISCLAIMER) && /In an emergency, call 999/.test(SYMPTOM_DISCLAIMER) && /before taking any medicine/.test(SYMPTOM_DISCLAIMER) && /\{symptomDisclaimer\(emergency\)\}/.test(read("src/components/PregnancyNotes.tsx")));
ok("“Something else” gets no tips, just a midwife's gentle nudge to ring if it feels wrong", /give your midwife or GP a ring/.test(OTHER_SYMPTOM_NOTE) && /no question is too small/.test(OTHER_SYMPTOM_NOTE) && /const custom = symptom && !past && !!title\.trim\(\) && !guide/.test(read("src/components/PregnancyNotes.tsx")));
const notes = read("src/components/PregnancyNotes.tsx");
ok("the tips are never saved with the note, so they never reach the book", /saveMemory\(\{\s*id: edit\?\.id, childId: child\.id, type: "story", title: title\.trim\(\), description: text, date: from, endDate: end,/.test(notes) && !/description: [^,]*tips/.test(notes));
ok("a symptom lasts a stretch of days (from, to, or still going); the book and the feed show it", formatSpan("2026-03-05", "2026-04-02") === "5 March 2026 – 2 April 2026" && formatSpan("2026-03-05") === "5 March 2026" && /Still going/.test(notes) && /formatSpan\(m\.date, m\.endDate\)/.test(read("src/lib/bookHtml.ts")) && /formatSpan\(p\.date, p\.endDate\)/.test(read("src/components/PostCard.tsx")));
ok("…and it's kept in the account too (a column of its own)", /add column if not exists end_date date/.test(read("supabase/schema.sql")) && /end_date: m\.endDate \?\? null/.test(read("src/lib/syncMerge.ts")) && /\('memories','end_date'\)/.test(read("scripts/setup-database.mjs")));
ok("symptoms and cravings are their own sections in pregnancy, like Firsts and Lasts", /label: "Symptoms"/.test(read("app/(tabs)/milestones.tsx")) && /label: "Cravings"/.test(read("app/(tabs)/milestones.tsx")) && CRAVING_IDEAS.length >= 10);
ok("older notes still show, sorted into symptoms or cravings", legacyIsCraving("Craving pickles") && legacyIsCraving("Can't stand the smell of coffee") && !legacyIsCraving("Heartburn") && symptomForTitle("heartburn and indigestion")?.id === "heartburn");
ok("the terms say plainly the app isn't medical advice", /4D Ages is not a medical app/.test(read("docs/terms/index.html")) && /not a diagnosis/.test(read("docs/terms/index.html")));

// ---- the invite
const msg = inviteMessage("family", "Maya", "4F9A2C1B", "https://aloncohen41.github.io/4d_ages/j/?c=4F9A2C1B", "4D Ages", "rosa@gmail.com");
ok("the message has no separate code: it's in the link (short: …/j/?c=CODE)", !msg.split("\n").some((l) => /^Code\b/.test(l)) && msg.includes("/j/?c=4F9A2C1B") && msg.split("\n").length === 3 && /\(view only\)/.test(msg));
ok("the link shows a 4D Ages card in WhatsApp (preview tags), and older …/join/ links still work", /og:image" content="https:\/\/aloncohen41\.github\.io\/4d_ages\/img\/share-card\.png"/.test(read("docs/j/index.html")) && /params\.get\("c"\) \|\| params\.get\("code"\)/.test(read("docs/join/index.html")));
ok("opening an invite you already have: it says so and leaves the invite unused", /create or replace function public\.check_invite\(p_code text\)/.test(read("supabase/schema.sql")) && /'already', true/.test(read("supabase/schema.sql")) && /check\?\.already && check\.child_id/.test(read("src/lib/sync.ts")) && /You already have \$\{r\.name\}'s book/.test(read("src/components/SyncManager.tsx")));
ok("the app's own notification instead of a system pop-up", /<Toast \/>/.test(read("app/_layout.tsx")) && /toast\(r\.outcome === "already"/.test(read("src/components/SyncManager.tsx")) && !/Alert\.alert/.test(read("src/components/SyncManager.tsx")));

// ---- Google Drive backup
const state = {
  kids: [{ id: "maya", role: "owner", shared: true, syncedTs: 5 }, { id: "noa", role: "viewer", shared: true }],
  memories: [{ id: "m1", syncedTs: 9, media: [{ id: "x", uri: "file:///data/media/abc.jpg", thumb: "file:///data/media/abc-t.jpg" }] }],
  relatives: [{ id: "r1", photoUri: "file:///data/media/nana.jpg" }], classics: [], customDefs: {}, tags: [], activeId: "maya", milestoneAnswers: {}, tombstones: [{ id: "t" }], syncMeta: { maya: { cursor: "x" } }, familyOrder: {}, bookPrefs: {},
  appearance: "dark", appLock: true,
};
const b = buildBackup(state, "4D Ages 1.0.8", 6, 1000);
ok("the backup holds the books, not the phone's settings", b.format === BACKUP_FORMAT && "memories" in b.data && !("appearance" in b.data) && !("appLock" in b.data));
ok("every photo, thumbnail and family picture is found to upload", [...filesIn(b.data)].sort().join() === "file:///data/media/abc-t.jpg,file:///data/media/abc.jpg,file:///data/media/nana.jpg" && baseName("file:///data/media/abc.jpg") === "abc.jpg");
const moved = remapFiles(b.data, (u) => u.replace("/data/media/", "/new/media/")) as typeof state;
ok("restoring points the books at the downloaded files", moved.memories[0].media[0].uri === "file:///new/media/abc.jpg" && moved.relatives[0].photoUri === "file:///new/media/nana.jpg");
const ready = prepareRestore(b.data) as { kids: { shared: boolean; role?: string }[]; memories: { syncedTs?: number }[]; syncMeta: object; tombstones: unknown[] };
ok("a restore goes back to the account too: your own children are saved again; ones shared with you stay as they are", ready.kids[0].shared === false && ready.kids[1].shared === true && ready.memories[0].syncedTs === undefined && Object.keys(ready.syncMeta).length === 0 && ready.tombstones.length === 0);
ok("a damaged or foreign file is refused in plain words", (() => { try { parseBackup("not json"); return false; } catch (e) { return /couldn't be read/.test((e as Error).message); } })() && (() => { try { parseBackup('{"data":{}}'); return false; } catch (e) { return /isn't a 4D Ages backup/.test((e as Error).message); } })());
const drive = read("src/lib/driveBackup.ts") + read("src/lib/driveAuth.ts"); // (Google sign-in and the transfers are in driveAuth.ts)
ok("Drive access is only to the app's own files, never the rest of Drive", /drive\.file"/.test(drive) && !/auth\/drive"/.test(drive) && !/drive\.readonly/.test(drive));
ok("the automatic backup never asks anything (it waits for a tap if Drive needs connecting again)", /backupNow\(false\)/.test(read("src/components/DriveAutoBackup.tsx")) && /if \(!interactive\) throw new NeedsGoogle\(\)/.test(drive));
ok("big videos are streamed from disk, never read into memory", /LegacyFS\.uploadAsync\(/.test(drive) && /BINARY_CONTENT/.test(drive));
ok("Settings has Back up to Google Drive, Back up now and Restore", /<DriveBackupCard \/>/.test(read("app/settings.tsx")) && /Back up to Google Drive/.test(read("src/components/DriveBackupCard.tsx")) && /Restore from Google Drive\?/.test(read("src/components/DriveBackupCard.tsx")));

// ---- the PDF and video files
const kt = read("modules/file-export/android/src/main/java/expo/modules/fileexport/FileExportModule.kt");
ok("Save uses Android's save dialog, which can save into Downloads and Drive (the folder picker can't: “to protect your privacy”)", /Intent\.ACTION_CREATE_DOCUMENT/.test(kt) && /fx\.createDocument\(bookFileName\(i\), "application\/pdf"\)/.test(read("src/lib/pdf.ts")));
ok("the file is copied in pieces, and an empty file is removed if building fails", /copyTo\(o, 256 \* 1024\)/.test(kt) && /fx\.deleteDocument\(dest\)/.test(read("src/lib/pdf.ts")));
ok("sharing (WhatsApp) doesn't wait for an answer, so the app being closed in the background can't break it; videos too", /Function\("share"\)/.test(kt) && /FLAG_GRANT_READ_URI_PERMISSION/.test(kt) && /fx\.share\(uri, "video\/mp4"/.test(read("src/components/VideoExportSheet.tsx")));

ok("every database function is quoted properly (a lone $ breaks the whole schema)", !/ as \$\r?\n|\nend \$;/.test(read("supabase/schema.sql")));

console.log(fails ? `${fails} FAILED` : "all round-four tests passed");
if (fails) process.exit(1);
