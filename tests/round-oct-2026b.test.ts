/*
 * The second round of October 2026 changes: sharing (the share bug, the code shown first, the share link, two parents at most, removing someone,
 * live updates), the account (forgotten and changed passwords, email, name), Settings (units, app lock, privacy, terms, feedback), European
 * dates, the website (join link, account deletion, privacy policy, terms), percentile lines, On this day, the monthly photo, the health log,
 * hearts and comments, the sibling book, pregnancy, and voice notes.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { formatDate, formatTime, pregnancy, shortDate, ageShort, ageBucket } from "../src/lib/date";
import { CENTILE_LINES, centileCurve, percentileFor, valueAtZ, lmsAt } from "../src/lib/percentiles";
import { GROWTH_REFS } from "../src/lib/growthRefs";
import { MONTHLY_PHOTO_DAYS, monthlyPhotoDue, onThisDay, planMonthlyPhotoNotifications } from "../src/lib/remember";
import { groupReactions, reactionCounts } from "../src/lib/reactionMath";
import { planBook, sizeById, calendarChapter, BEFORE_BIRTH } from "../src/lib/bookPages";
import { buildBookHtml } from "../src/lib/bookHtml";
import { parseAuthCallback } from "../src/lib/authLink";
import { memoryToRow, mergeMemories, mergeChild } from "../src/lib/syncMerge";
import { audioMedia, visualMedia } from "../src/lib/display";
import { buildNewPosts } from "../src/lib/newPosts";
import { Child, Memory, MILESTONE_DEFS } from "../src/lib/types";
import { ClassicEntry } from "../src/lib/classics";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const schema = read("supabase/schema.sql"), sync = read("src/lib/sync.ts"), share = read("app/share.tsx"), settings = read("app/settings.tsx");

const child: Child = { id: "c", name: "Maya", birth: "2024-01-10", theme: "pink", emoji: "🌸" };
let n = 0;
const mem = (type: Memory["type"], date: string, extra: Partial<Memory> = {}): Memory => ({
  id: `m${++n}`, childId: "c", type, description: "", date, media: [], tagIds: [], createdAt: n, emoji: "", palette: "peach", source: "", ...extra,
});
const photo = (date: string, extra: Partial<Memory> = {}) => mem("photo", date, { media: [{ id: `p${n}`, kind: "photo", uri: `file:///p${n}.jpg` }], ...extra });

/* ---------------- sharing */
ok("the share bug: the owner can always finish putting their own child in the cloud (a half-done first try no longer blocks it)", /children_update on public\.children for update to authenticated\s+using \(public\.is_editor\(id\) or owner_id = auth\.uid\(\)\)/.test(schema));
ok("sharing again never fails on an existing membership", /onConflict: "child_id,user_id", ignoreDuplicates: true/.test(sync));
ok("a book has at most two parents: no new parent invite or join once two are in", /p_people is null and public\.parent_count\(p_child\) >= public\.max_parents\(p_child\)/.test(schema) && /public\.parent_count\(v_inv\.child_id\) >= public\.max_parents\(v_inv\.child_id\)/.test(schema) && /then 6 else 2 end/.test(schema) && /MAX_PARENTS = 2/.test(sync));
ok("one parent removes the other (the owner can't be removed; the other parent can remove family viewers and leave)", /create or replace function public\.remove_member/.test(schema) && /The parent who created the book can''t be removed/.test(schema) && /removeMember\(child\.id, m\.userId\)/.test(share) && /"Remove and block"/.test(share) && /text: "Leave"/.test(share));
ok("someone removed loses the book on their phone too", /forgetChild\(childId\)/.test(sync) && /isn't shared with you any more, so it was taken off this phone/.test(sync));
ok("the share screen: who can see the book, then a choice of the other parent or a family member, then steps, then sending (WhatsApp, email, other apps, copy)", share.indexOf("Who can see {child.name}'s book") < share.indexOf("Invite someone") && /"The other parent"/.test(share) && /title="A family member"/.test(share) && /Send on WhatsApp/.test(share) && /Send by email/.test(share) && /Copy link/.test(share) && /Copy code/.test(share) && /Step \{shown\} of \{total\}/.test(share));
ok("when two parents share it, inviting another parent is turned off and the screen says why", /disabled=\{parentsFull \|\| !!busy\}/.test(share) && /This book already has two parents/.test(share));
ok("the share link opens a web page that opens the app (or offers it) with the code", /JOIN_PAGE = "https:\/\/aloncohen41\.github\.io\/4d_ages\/j\/"/.test(sync) && /intent:\/\/join\?code=/.test(read("docs/j/index.html")) && /intent:\/\/join\?code=/.test(read("docs/join/index.html")) && /package=com\.alonc\.fourdages/.test(read("docs/join/index.html")));
ok("the app takes the code from the link: straight away when signed in, or right after signing in", existsSync(join(root, "app/join.tsx")) && /setPendingJoin\(clean\)/.test(read("app/join.tsx")) && /pendingJoin: s\.pendingJoin/.test(read("src/lib/store.ts")) && /joinPending\(\)/.test(read("src/components/SyncManager.tsx")) && /name="join"/.test(read("app/_layout.tsx")));
ok("live updates: a change on one phone reaches the other at once (Supabase Realtime), plus a quick sync after any change here", /alter publication supabase_realtime add table/.test(schema) && /postgres_changes/.test(read("src/lib/realtime.ts")) && /useRealtime\(userId, kidIds\)/.test(read("src/components/SyncManager.tsx")) && /1500\); \/\/ soon after a change/.test(read("src/components/SyncManager.tsx")));

/* ---------------- account */
const recovery = parseAuthCallback("fourdages://auth-callback#access_token=a&refresh_token=b&type=recovery");
ok("forgot password: a reset email whose link opens the app, which then asks for a new password", /Forgot password\?/.test(read("app/login.tsx")) && /resetPasswordForEmail\(clean, \{ redirectTo: AUTH_REDIRECT \}\)/.test(read("src/lib/supabase.ts")) && recovery?.recovery === true && /<NewPasswordAfterReset \/>/.test(read("app/_layout.tsx")));
ok("[1] change password: the current one first, then the new one (not for Google accounts)", /export async function setNewPassword\(password: string, current\?: string\)/.test(read("src/lib/supabase.ts")) && /providerOf\(session\) === "email" \? <LinkRow icon="lock" label="Change password"/.test(settings));
ok("[2] the account shows its email and sign-in method, the email can be changed, and your name is shown on comments", /label="Email"/.test(settings) && /\(Google\)/.test(settings) && /updateUser\(\{ email: clean \}/.test(read("src/lib/supabase.ts")) && /display_name/.test(read("src/lib/supabase.ts")) && /label="Your name"/.test(settings));
ok("[3] who can see the children is managed in Settings", /label="Who can see your memories"/.test(settings) && /router\.push\("\/access"\)/.test(settings) && /name="access"/.test(read("app/_layout.tsx")));

/* ---------------- Settings, dates */
ok("[4] units in Settings (centimetres or inches, kilograms or pounds)", /<Section title="Units">/.test(settings) && /label: "Centimetres"/.test(settings) && /label: "Kilograms"/.test(settings));
ok("[5] dates are always European: day first, 24-hour time", formatDate("2025-03-05") === "5 March 2025" && formatTime("14:30") === "14:30" && formatTime("9:05") === "09:05" && shortDate("2025-03-05") === "5 Mar" && /is24Hour: true/.test(read("src/components/ui.tsx")));
ok("[7] app lock: fingerprint, face or the phone's PIN, on opening and after a minute away", /authenticateAsync/.test(read("src/lib/deviceLock.ts")) && /unlockDevice\(reason\)/.test(read("src/components/AppLock.tsx")) && /RELOCK_AFTER_MS = 60 \* 1000/.test(read("src/components/AppLock.tsx")) && /<AppLock \/>/.test(read("app/_layout.tsx")) && /<Section title="Privacy">/.test(settings) && /appLock: s\.appLock/.test(read("src/lib/store.ts")));
ok("[11] privacy policy, terms and feedback, in the app and on the website", /label="Privacy policy"/.test(settings) && /label="Terms of use"/.test(settings) && /Contact us \(questions, feedback, privacy\)/.test(settings) && existsSync(join(root, "docs/privacy/index.html")) && existsSync(join(root, "docs/terms/index.html")));
ok("[13] deleting the account on a web page, as Google Play requires", /rpc\("delete_my_account"\)/.test(read("docs/delete-account/index.html")) && /DELETE/.test(read("docs/delete-account/index.html")) && /sb_publishable_/.test(read("docs/delete-account/index.html")) && !/sb_secret_/.test(read("docs/delete-account/index.html")));

/* ---------------- growth: percentile lines */
const p97 = centileCurve("who", "weight", "boy", 1.881, 24);
ok("[14] the growth curve shows the 3rd, 50th and 97th percentile lines from the chosen charts", CENTILE_LINES.map((c) => c.label).join() === "97th,50th,3rd" && p97.length === 25 && Math.abs(valueAtZ(0, lmsAt(GROWTH_REFS.who.weight.boy, 12)!) - 9.6479) < 0.001 && Math.abs((percentileFor("who", "weight", "boy", 12, p97[12][1])?.percentile ?? 0) - 97) < 0.2 && /centileCurve\(source, mode, effectiveRef\(child\)/.test(read("src/components/GrowthChart.tsx")));

/* ---------------- On this day, the monthly photo */
const a = photo("2024-10-10"), b = photo("2025-10-10"), c3 = photo("2025-10-11");
ok("[15] On this day: today's date in earlier years, the most recent first", onThisDay([a, b, c3], "c", "2026-10-10").map((x) => `${x.memory.id}:${x.yearsAgo}`).join() === `${b.id}:1,${a.id}:2` && /<HomeCards child=\{child\}/.test(read("app/(tabs)/index.tsx")));
const grid: ClassicEntry = { id: "grid", childId: "c", values: {}, photos: { m4: [{ id: "x", kind: "photo", uri: "file:///x.jpg" }] } };
ok("[16] the monthly photo is due for a week from each month's birthday in the first year, until it's added", monthlyPhotoDue(child, [], "2024-05-12")?.month === 4 && monthlyPhotoDue(child, [grid], "2024-05-12") === null && monthlyPhotoDue(child, [], "2024-05-25") === null && monthlyPhotoDue(child, [], "2025-03-01") === null && MONTHLY_PHOTO_DAYS === 7);
ok("[16] and a reminder on each month's birthday (turned off with the others, or on its own), opening the Monthly photos page", planMonthlyPhotoNotifications([child], { enabled: true, daysBefore: 3, hour: 9 }, new Date("2024-02-01")).length === 12 && planMonthlyPhotoNotifications([child], { enabled: true, daysBefore: 3, hour: 9, monthlyPhoto: false }, new Date("2024-02-01")).length === 0 && /d\.kind === "monthly-photo"/.test(read("app/_layout.tsx")));

/* ---------------- health log */
const h = mem("health", "2024-06-01", { title: "MMR", healthKind: "vaccination" });
ok("[18] the health log: entries of their own kind, added by hand, synced, kept out of the story and the book", memoryToRow(h, [], 1).health_kind === "vaccination" && mergeMemories([], [memoryToRow(h, [], 2)])[0].healthKind === "vaccination" && !planBook(child, [h], sizeById("square-20")).pages.some((p) => JSON.stringify(p).includes(h.id)) && /p\.type !== "health"/.test(read("app/(tabs)/index.tsx")) && /item\("health", "Health", "\/health"\)/.test(read("src/components/Screen.tsx")));

/* ---------------- hearts and comments */
const rs = [{ memoryId: "x", userId: "u1", author: "Nana", heart: true, comment: "", at: "2" }, { memoryId: "x", userId: "u2", author: "Dad", heart: true, comment: "So cute", at: "1" }];
ok("[19] hearts and comments: one each per person per post (the database keeps one row per person per post)", /primary key \(memory_id, user_id\)/.test(schema) && reactionCounts(groupReactions(rs).x).hearts === 2 && reactionCounts(groupReactions(rs).x).comments === 1 && groupReactions(rs).x[0].author === "Dad");
ok("[19] only those who can see a post see its reactions, and each person writes only their own", /reactions_read on public\.reactions for select to authenticated using \(public\.can_see_post\(memory_id\)\)/.test(schema) && /reactions_insert on public\.reactions for insert to authenticated with check \(user_id = auth\.uid\(\)/.test(schema) && /<Reactions memory=\{p\} child=\{child\} \/>/.test(read("src/components/PostCard.tsx")));

/* ---------------- sibling book */
const leo: Child = { id: "l", name: "Leo", birth: "2025-06-01", theme: "blue", emoji: "🦁" };
const lp = { ...photo("2025-07-01"), childId: "l" };
const sib = planBook(child, [photo("2024-03-01"), lp], sizeById("square-20"), { siblings: [leo] });
ok("[20] a sibling book: both children, a birth page each, chapters by calendar year", sib.pages.filter((p) => p.kind === "birth").length === 2 && sib.pages.some((p) => p.chapter?.label === "2025") && calendarChapter("2025-07-01").label === "2025" && !sib.pages.some((p) => p.kind === "year"));
const sibHtml = buildBookHtml({ child, siblings: [leo], plan: sib, defs: MILESTONE_DEFS, style: "classic", size: sizeById("square-20"), image: (u) => u });
ok("[20] the pages say whose memory each one is, and the cover and the end name them both", /Maya &amp; Leo: Our Story|Maya & Leo: Our Story/.test(sibHtml) && /Leo · 1 July 2025/.test(sibHtml) && /The day Leo was born/.test(sibHtml));

/* ---------------- pregnancy */
const due: Child = { id: "e", name: "Baby", birth: "2027-02-01", theme: "green", emoji: "🐣", expecting: true };
const scan = { ...photo("2026-09-01"), childId: "e" };
const pre = planBook(due, [scan], sizeById("square-20"));
ok("[21] a baby who isn't born yet: a date still to come makes it a pregnancy profile (called “Bump” until named), and \"The baby is here!\" later", /const expecting = birth > todayISO\(\);/.test(read("src/components/Screen.tsx")) && /The baby is here!/.test(read("src/components/Screen.tsx")) && /name: name\.trim\(\) \|\| PREGNANCY_NAME/.test(read("src/components/Screen.tsx")) && /PREGNANCY_NAME = "Bump"/.test(read("src/lib/pregnancy.ts")) && pregnancy("2027-02-01", "2026-10-10").weeksToGo === 17);
ok("[21] pregnancy posts open the book, before the birth, in their own chapter", pre.pages[1].chapter?.key === BEFORE_BIRTH.key && !pre.pages.some((p) => p.kind === "birth") && ageShort("2027-02-01", "2026-09-01") === "Week 18 (sweet pepper)" && ageBucket("2027-02-01", "2026-09-01") === "Week 18 (sweet pepper)");
ok("[21] photos up to ten months before the birth keep their date", buildNewPosts({ child, shape: "separate", note: "", items: [{ uri: "a", kind: "photo", date: "2023-06-01" }], oneDate: "x", today: "2024-09-09", newId: (p) => p, now: 1 })[0].date === "2023-06-01");
ok("[21] the expecting flag syncs with the child", /expecting: !!child\.expecting/.test(sync) && mergeChild(child, { client_ts: 9, expecting: true, name: "Maya" }).expecting === true && /alter table public\.children add column if not exists expecting/.test(schema));

/* ---------------- voice notes */
const media = [{ id: "1", kind: "photo" as const, uri: "a" }, { id: "2", kind: "audio" as const, uri: "b" }];
ok("[22] voice notes: recorded on the spot or chosen from a file, from the + button and in the forms", /RecordingPresets\.HIGH_QUALITY/.test(read("src/components/Voice.tsx")) && /getDocumentAsync\(\{ type: "audio\/\*"/.test(read("src/components/Voice.tsx")) && /"voice"/.test(read("src/components/Fab.tsx")) && /Add a voice note/.test(read("src/components/EntrySheet.tsx")));
ok("[22] played on the post, never shown as a picture, and synced like photos", visualMedia(media).length === 1 && audioMedia(media).length === 1 && /<VoicePlayer key=\{a\.id\} item=\{a\} \/>/.test(read("src/components/PostCard.tsx")) && /m4a: "audio\/mp4"/.test(sync) && mergeMemories([], [{ ...memoryToRow({ ...mem("story", "2024-02-01"), media: [{ id: "v", kind: "audio", uri: "", path: "c/v.m4a" }] }, [], 1) }])[0].media[0].kind === "audio");
ok("[22] the microphone is allowed for recording (and only for that)", !JSON.stringify(JSON.parse(read("app.json")).expo.android.blockedPermissions).includes("RECORD_AUDIO") && JSON.stringify(JSON.parse(read("app.json")).expo.plugins).includes("expo-audio"));

/* ---------------- no screen can crash by re-rendering without end */
{
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const walk = (d: string): string[] => readdirSync(join(root, d)).flatMap((n) => { const p = `${d}/${n}`; return statSync(join(root, p)).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []; });
  // a store selector that returns a new list or object every time makes React re-render forever (Zustand 5): the "Who can see your children" crash
  const bad = [...walk("app"), ...walk("src")].flatMap((file) =>
    (read(file).match(/use(Store|Reactions)\(\(s\) => [^;\n]*?\.(filter|map|slice|concat)\([^;\n]*\)\);/g) || []).filter((m) => !/\.join\(/.test(m) && !/\.length/.test(m)).map((m) => `${file}: ${m}`));
  ok("no store selector returns a new list on every render (it would crash the screen)" + (bad.length ? " — " + bad.join(" | ") : ""), bad.length === 0);
  ok("the share screen always lists you, as the parent, even before anyone else has joined; Settings opens it for each child", share.includes("members.some((m) => m.me) ? members") && /Only you can see it so far/.test(share) && /pathname: "\/share", params: \{ child: k\.id \}/.test(read("app/access.tsx")));
}

console.log(fails ? `${fails} FAILED` : "all round-two tests passed");
if (fails) process.exit(1);
