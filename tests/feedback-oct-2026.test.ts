/*
 * The changes from the feedback session of 10 October 2026 (requirement IDs in brackets). The logic is tested directly; screens are read as
 * source, so their structure is pinned down even though they can't be seen without a phone.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseAuthCallback } from "../src/lib/authLink";
import { personSummary } from "../src/lib/personSummary";
import { buildNewPosts } from "../src/lib/newPosts";
import { BOOK_SIZES, BOOK_PHOTO_LIMIT, cmToPt, pagePoints, planBook, sizeById, spread } from "../src/lib/bookPages";
import { DOOR_MAX_CM, DOOR_REFS, effectiveRef, placeLabels, typicalRange } from "../src/lib/growth";
import { pickThumb } from "../src/lib/thumbChoice";
import { moveInOrder, orderedFamily, searchFamily, siblingRelationOf } from "../src/lib/family";
import { migrateRelativesV6 } from "../src/lib/migrate";
import { displayName, initialsOf, relationLine } from "../src/lib/tags";
import { AREA_META } from "../src/lib/development";
import { contrast } from "../src/lib/m3";
import { TAB_NAMES } from "../src/lib/resume";
import { Child, Memory } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const walk = (d: string): string[] => readdirSync(join(root, d)).flatMap((n) => { const p = `${d}/${n}`; return statSync(join(root, p)).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []; });
const screens = [...walk("app"), ...walk("src/components")];
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"); // without comments

const child: Child = { id: "c", name: "Maya", birth: "2024-01-10", theme: "pink", emoji: "🌸" };
let n = 0;
const mem = (type: Memory["type"], date: string, extra: Partial<Memory> = {}): Memory => ({
  id: `m${++n}`, childId: "c", type, date, description: "", media: [], tagIds: [], createdAt: 0, emoji: "", palette: "peach", source: "", ...extra,
});
const photo = (date: string, extra: Partial<Memory> = {}) => mem("photo", date, { media: [{ id: `x${n}`, uri: `file:///${n}.jpg`, kind: "photo" }], ...extra });

/* ---------------- login and sign-in (LOGIN-01 … 08) ---------------- */
const layout = read("app/_layout.tsx"), login = read("app/login.tsx"), welcome = read("app/welcome.tsx");
ok("[LOGIN-01] signed out, only the login page exists: tabs, menu pages and welcome are behind sign-in guards (back navigation and links can't reach them)",
  /<Stack\.Protected guard=\{signedIn && hasKids\}>[\s\S]*name="\(tabs\)"[\s\S]*name="family"[\s\S]*name="settings"/.test(layout) && /<Stack\.Protected guard=\{!signedIn\}>[\s\S]*name="login"/.test(layout));
ok("[LOGIN-01] the login page has no + button, no top bar and no navigation", !/TopBar|Fab|AddChildSheet|BottomBar|router\.push/.test(code(login)));
ok("[LOGIN-02] the login page doesn't scroll, and sizes itself for small phones", !/ScrollView/.test(code(login)) && /height < 720/.test(login));
ok("[LOGIN-03] the sample family is a small text link at the bottom (not a button), and still loads the same sample", /onPress=\{loadSample\}[\s\S]{0,200}textDecorationLine: "underline"/.test(login) && !/<Btn[^>]*Explore/.test(login) && /Explore with a sample family/.test(login));
ok("[LOGIN-04] “Join a partner's baby book” is text only", /label="Join a partner's baby book"/.test(welcome));
ok("[LOGIN-05] a bigger logo, no long description, one short tagline in the display face", /logoW = Math\.min\(width - 48, compact \? 280 : 340\)/.test(login) && /fontFamily: DISPLAY_FONT/.test(login) && /LOGIN_TAGLINE = "Keepsake books for the ages\."/.test(read("src/brand.ts")) && !/watch their story build itself/.test(login));
ok("[LOGIN-06] email, password and Google are on the login page itself; the share sheet no longer signs in", /placeholder="Email"/.test(login) && /secureTextEntry/.test(login) && /Sign in with Google/.test(login) && !/signIn\(|signUp\(/.test(read("src/components/ShareSheet.tsx")));
ok("[LOGIN-07] new accounts verify by email; the link reopens the app (fourdages://auth-callback) and signs in", /emailRedirectTo: AUTH_REDIRECT/.test(read("src/lib/supabase.ts")) && /AUTH_REDIRECT = "fourdages:\/\/auth-callback"/.test(read("src/lib/supabase.ts")) && /completeAuthLink/.test(layout) && existsSync(join(root, "app/auth-callback.tsx")));
ok("[LOGIN-07] the verification link is read whether it carries a code or the tokens, and anything else is ignored",
  parseAuthCallback("fourdages://auth-callback?code=abc123")?.code === "abc123" &&
  parseAuthCallback("fourdages://auth-callback#access_token=AT&refresh_token=RT&type=signup")?.accessToken === "AT" &&
  parseAuthCallback("fourdages://auth-callback#access_token=AT&refresh_token=RT")?.refreshToken === "RT" &&
  /expired/.test(parseAuthCallback("fourdages://auth-callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired")?.error ?? "") &&
  parseAuthCallback("fourdages://somewhere-else?code=x") === null && parseAuthCallback(null) === null);
ok("[LOGIN-07] you stay signed in across restarts, and the app waits for the saved session before choosing a page", /persistSession: true/.test(read("src/lib/supabase.ts")) && /&& authReady/.test(layout));
ok("[LOGIN-08] adding a child and joining a partner happen only after sign-in (the welcome page is behind the guard), and every child is saved to the account",
  /<Stack\.Protected guard=\{signedIn && !hasKids\}>[\s\S]*name="welcome"/.test(layout) && /Add your little one/.test(welcome) && /attachAndRestore/.test(read("src/components/SyncManager.tsx")) && /shareChild\(k\.id\)/.test(read("src/lib/sync.ts")));

/* ---------------- add child (CHILD-01, CHILD-02) ---------------- */
const screen = read("src/components/Screen.tsx");
ok("[CHILD-01] the emoji option shows only while there is no photo", /\{!photoUri \? \(/.test(screen) && /Remove photo/.test(screen));
ok("[CHILD-02] the child form has Girl, Boy and Prefer not to say; children without one count as Prefer not to say", /label: "Girl"[\s\S]*label: "Boy"[\s\S]*label: "Prefer not to say"/.test(screen) && /child\.gender \?\? "unspecified"/.test(screen));

/* ---------------- navigation (NAV-01 … 03, ADD-01) ---------------- */
ok("[NAV-01] a menu button top-left with Family and Settings", /accessibilityLabel="Menu"/.test(screen) && /item\("family", "Family", "\/family"\)/.test(screen) && /item\("settings", "Settings", "\/settings"\)/.test(screen));
ok("[NAV-02, NAV-03] the bottom bar is Home, Milestones, Growth, Book", TAB_NAMES.join() === "index,milestones,growth,book" && !existsSync(join(root, "app/(tabs)/add.tsx")) && !existsSync(join(root, "app/(tabs)/family.tsx")));
ok("[NAV-02] posts are still added with the + button", /<Fab /.test(read("app/(tabs)/_layout.tsx")));
ok("[ADD-01] “Whose photos are these?” is gone", !screens.some((f) => /Whose photos are these/.test(read(f))));

/* ---------------- settings (SETTINGS-01 … 05) ---------------- */
const settings = read("app/settings.tsx");
ok("[SETTINGS-01] “How to add photos”: exactly the three steps, in order, with no personal name", /title="How to add photos"/.test(settings) && /search a name — if you've named them[\s\S]*Select many at once — press and hold\.[\s\S]*Only the photos you picked are added\. Nothing is scanned\./.test(settings));
ok("[SETTINGS-02, 03] Notifications and About sections reuse the existing cards", /title="Notifications">\s*<RemindersCard \/>/.test(settings) && /title="About">\s*<AboutCard \/>/.test(settings));
ok("[SETTINGS-04] sign out keeps the data (it syncs first, then signs out; nothing is cleared)", /await syncAll\(\)[\s\S]*await signOut\(\)/.test(settings) && !/const out = async[\s\S]{0,300}resetAll/.test(settings));
ok("[SETTINGS-05] delete: a warning that it can't be undone, the password or Google again, and typing DELETE, before anything is removed",
  /This cannot be undone\./.test(settings) && /DELETE_WORD = "DELETE"/.test(settings) && /word\.trim\(\) === DELETE_WORD && \(google \|\| password\.length > 0\)/.test(settings) &&
  /await reauthenticate\([\s\S]*await deleteAccountData\(\)[\s\S]*resetAll\(\)[\s\S]*await signOut\(\)/.test(settings) && /delete_my_account/.test(read("supabase/schema.sql")));
ok("[SETTINGS-05] the old “Remove all children & data” is gone", !screens.some((f) => /Remove all children & data/.test(read(f))));

/* ---------------- book (BOOK-01 … 04) ---------------- */
const b1 = mem("story", "2024-01-10", { title: "Hello world", description: "Born at dawn" });
const b2 = photo("2024-01-10");
const ms = mem("milestone", "2024-06-01", { milestoneId: "mov-rolls" });
const first = mem("first", "2024-03-01", { title: "First bath" });
const pic = photo("2024-04-01");
const last = mem("last", "2024-05-01", { title: "Last bottle" });
const height = mem("measure", "2024-02-01", { heightCm: 60 });
const plan = planBook(child, [ms, pic, last, first, b2, b1, height], sizeById("square-20"));
const order = plan.pages.map((p) => p.kind === "picture" ? p.memory.id : p.kind === "notes" ? p.memories.map((m) => m.id).join("+") : p.kind);
ok("[BOOK-01] the book starts with the birth (story and first photo of that day), then runs in date order, mixing kinds — no sections", order.join(",") === `cover,birth,${first.id},${pic.id},${last.id}+${ms.id},end` && (plan.pages[1] as { story?: Memory }).story === b1);
ok("[BOOK-01] measurements are left out of the book (they have the Growth page)", !JSON.stringify(plan.pages).includes(height.id));
ok("[BOOK-02] five print sizes, each with full measurements, and the PDF page is that size", BOOK_SIZES.length === 5 && BOOK_SIZES.every((s) => /\d+(\.\d+)? × \d+(\.\d+)? cm \(/.test(s.label)) &&
  pagePoints(sizeById("square-20")).w === 567 && pagePoints(sizeById("a4-portrait")).w === 595 && pagePoints(sizeById("a4-portrait")).h === 842 && Math.abs(cmToPt(29.7) - 841.89) < 0.01);
ok("[BOOK-02] the export uses the plan's page size (in points) and the same layout", /printToFileAsync\(\{ html, width: M\.w, height: M\.h \}\)/.test(read("src/lib/pdf.ts")) && /@page\{size:/.test(read("src/lib/pdf.ts")));
const many = Array.from({ length: 250 }, (_, i) => photo(`2024-${String(2 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`));
const big = planBook(child, many, sizeById("square-20"));
ok(`[BOOK-03] at most ${BOOK_PHOTO_LIMIT} pictures, chosen evenly across time (first and last kept); the rest stay in as words`, big.pictures === BOOK_PHOTO_LIMIT && big.available === 250 && spread([1, 2, 3, 4, 5], 3).join() === "1,3,5" && big.pages.filter((p) => p.kind === "picture").length === BOOK_PHOTO_LIMIT);
const notesOnly = Array.from({ length: 12 }, (_, i) => mem("first", `2024-03-${String(i + 1).padStart(2, "0")}`, { title: `First ${i}` }));
ok("[BOOK-04] the page count follows the size (more memories per page on a bigger page)", planBook(child, notesOnly, sizeById("square-15")).pages.length > planBook(child, notesOnly, sizeById("square-30")).pages.length);
ok("[BOOK-04] the Book page shows the page count and a page-by-page preview", /\{plan\.pages\.length\} pages/.test(read("app/(tabs)/book.tsx")) && /<BookPreviewModal/.test(read("app/(tabs)/book.tsx")) && /Page \{index \+ 1\} of \{pages\.length\}/.test(read("src/components/BookPreview.tsx")));

/* ---------------- family (FAM-01 … 10) ---------------- */
const member = read("src/components/MemberSheet.tsx");
const labels = [...member.matchAll(/<Label>([^<]+)<\/Label>/g)].map((m) => m[1]);
ok("[FAM-01] one form, fields in order: name, photo, relationship (free text), nickname, description, then whose family", labels.slice(0, 5).join("|") === "Name|Photo (optional)|Relationship|Nickname (optional)|Description (optional)" && /placeholder="Example: Mummy"/.test(member) && /Example: Lives abroad and visits every summer/.test(member) && /In the family of/.test(member));
ok("[FAM-01] no preset relationship buttons are left anywhere", !screens.some((f) => /RELATION_PRESETS|QUICK = \[/.test(read(f))));
const migrated = migrateRelativesV6({ relatives: [{ id: "a", name: "Ruth", relation: "Grandma", customLabel: "Nana" }, { id: "b", name: "Sam", relation: "Other" }, { id: "c", name: "Tom", relation: "Dad" }] }).relatives as { relation: string; customLabel?: string }[];
ok("[FAM-01] existing people keep what they were shown as, now as text", migrated.map((r) => r.relation).join() === "Nana,Family,Dad" && migrated.every((r) => r.customLabel === undefined));
ok("[FAM-01] the title is the nickname (or name); the relationship is under it", displayName({ name: "Ruth", nickname: "Nana", relation: "Grandma" }) === "Nana" && relationLine({ name: "Ruth", nickname: "Nana", relation: "Grandma" }) === "Grandma · Ruth" && displayName({ name: "Tom", relation: "Daddy" }) === "Tom");
ok("[FAM-02] people without a photo get their initials, never an emoji", initialsOf("Rosa Lind") === "RL" && initialsOf("nana") === "N" && /initials=\{initialsOf\(/.test(read("src/components/ui.tsx")) && !/EmojiPicker/.test(member));
ok("[FAM-03] the photo buttons: Remove on the left, Change photo on the right", member.indexOf('label="Remove"') < member.indexOf('"Change photo"'));
ok("[FAM-04] profile pictures are scaled down when chosen, and earlier ones once in the background", /shrinkImage\(picked\[0\]\.uri\)/.test(member) && /photoSized/.test(read("app/family.tsx")));
const fam = read("app/family.tsx");
ok("[FAM-05] “Set up siblings” is gone", !/Set up siblings/.test(fam));
const people = [{ id: "a", name: "Ann", relation: "Mum" }, { id: "b", name: "Bob", relation: "Grandpa", nickname: "Pops" }, { id: "c", name: "Cat", relation: "Aunt" }] as never[];
ok("[FAM-06] one Add someone button, compact rows, a search over name, nickname and relationship, and an order you can change that is kept",
  /label="Add someone"/.test(fam) && /minHeight: 64/.test(fam) && searchFamily(people, "pops").length === 1 && searchFamily(people, "aunt").length === 1 && searchFamily(people, "ann").length === 1 && searchFamily(people, "an").length === 2 &&
  orderedFamily(people, ["c", "a"]).map((r: { id: string }) => r.id).join() === "c,a,b" && moveInOrder(["a", "b", "c"], "c", -1).join() === "a,c,b" && moveInOrder(["a", "b"], "a", -1).join() === "a,b" && /setFamilyOrder/.test(fam));
ok("[FAM-07] selecting someone is an outline: the row's colours never change", /borderWidth: on \? 2 : 1, borderColor: on \? t\.accent : t\.line/.test(fam) && !/on \? t\.chipOn/.test(fam) && !/t\.bg3/.test(fam));
const summary = personSummary([photo("2024-05-01", { media: [{ id: "1", uri: "a", kind: "photo" }, { id: "2", uri: "b", kind: "photo" }] }), mem("first", "2024-04-01"), mem("story", "2024-03-01"), photo("2024-02-01")]);
ok("[FAM-08] the summary counts every picture, and each item jumps to its newest memory of that kind", summary.map((s) => s.label).join(", ") === "4 memories, 3 photos, 1 first, 1 story" && summary.every((s) => !!s.firstId) && /onPress=\{\(\) => jump\(s\)\}/.test(read("app/person/[id].tsx")));
ok("[FAM-09] a person's memories are Home's own cards; tapping opens to read, Edit is separate", /<PostCard /.test(read("app/person/[id].tsx")) && /<PostCard /.test(read("app/(tabs)/index.tsx")) && /onView=\{\(\) => setViewing\(p\)\}/.test(read("app/person/[id].tsx")) && /<PostViewer /.test(read("app/person/[id].tsx")));
ok("[FAM-10] no “Tags and search” in Family; the tags themselves are kept", !/Tags & search|Tags and search|setTagSheet/.test(fam) && /tags: Tag\[\]/.test(read("src/lib/store.ts")));

/* ---------------- growth (GROWTH-01 … 03) ---------------- */
const growth = read("app/(tabs)/growth.tsx");
ok("[GROWTH-01] no explanation under the title; the title and Add button stay", /<Heading title="Growth" \/>/.test(growth) && /label="Add height \/ weight"/.test(growth));
ok("[GROWTH-02] the comparison follows the gender (Prefer not to say → All), and can still be changed", effectiveRef({ gender: "girl" }) === "girl" && effectiveRef({ gender: "boy" }) === "boy" && effectiveRef({ gender: "unspecified" }) === "all" && effectiveRef({}) === "all" && effectiveRef({ gender: "girl", growthRef: "boy" }) === "boy" && effectiveRef({ gender: "boy", growthRef: "none" }) === "boy" && /label: "All"/.test(growth));
const all12 = typicalRange("all", 12)!, g12 = typicalRange("girl", 12)!, b12 = typicalRange("boy", 12)!;
ok("[GROWTH-02] “All” sits between the girls' and boys' ranges", all12[0] > g12[0] && all12[0] < b12[0] && all12[1] > g12[1] && all12[1] < b12[1]);
ok("[GROWTH-03] the frame runs 0–2 m (65 cm sits about a third of the way up), with things at their real height across all of it, as icons", DOOR_MAX_CM === 200 && Math.abs(65 / DOOR_MAX_CM - 0.325) < 0.01 && DOOR_REFS.some((r) => r.cm >= 170) && DOOR_REFS.some((r) => r.cm <= 30) && DOOR_REFS.every((r, i) => i === 0 || r.cm > DOOR_REFS[i - 1].cm) && DOOR_REFS.every((r) => r.icon.startsWith("ref-")));
const placed = placeLabels([100, 105, 108, 300], 17, 0, 1000);
ok("[GROWTH-03] marks' labels never overlap, and stay inside the frame", placed[1] - placed[0] >= 17 && placed[2] - placed[1] >= 17 && placed[3] === 300 && placeLabels([990, 995], 17, 0, 1000).every((y) => y <= 1000));
ok("[GROWTH-03] heights are accepted up to adult size", /cm >= 20 && cm <= 230/.test(read("src/components/EntrySheet.tsx")));

/* ---------------- milestones (MILE-01 … 03) ---------------- */
ok("[MILE-01] each area is a soft pair (light tint + deeper soft accent) with a dark ink that reads at 4.5:1 on both", Object.values(AREA_META).every((m) => contrast(m.ink, m.soft) >= 4.5 && contrast(m.ink, m.color) >= 4.5 && contrast(m.color, "#ffffff") < 2.2));
const checklist = read("src/components/MilestoneChecklist.tsx");
ok("[MILE-02] ticking is immediate with today's date; the date is shown and tapping it changes it", /const reach = \(def: MilestoneDef\) => tick\(def, today\)/.test(checklist) && /onPress=\{\(\) => changeDate\(m\)\}/.test(checklist));
ok("[MILE-03] several milestones can be selected and given one date together", /setSelecting\(true\)/.test(checklist) && /label="Set date"/.test(checklist) && /const dateSelected/.test(checklist));

/* ---------------- home (HOME-01 … 03) ---------------- */
const card = read("src/components/PostCard.tsx");
ok("[HOME-01] a post without pictures is a compact card (no empty picture area)", /const media = hasPicture\(p\)/.test(card) && /\{media \? \(/.test(card) && /padding: media \? 9 : 14/.test(card));
ok("[HOME-02] a video's thumbnail is the most detailed of five frames, never a black one", pickThumb(["a", "b", "c", "d", "e"], [900, 40000, 38000, 41000, 1000]) === "d" && pickThumb(["a", "b", "c"], [5, 5, 5]) === "b" && /videoFrames\(uri, 5\)/.test(read("src/lib/videoThumbs.ts")));
ok("[HOME-02] a video without its picture yet shows its soft colour and a play button, not black", !/#1d1618/.test(read("src/components/ui.tsx")));
const posts = buildNewPosts({ child, shape: "separate", note: " Beach ", items: [{ uri: "a", kind: "photo", date: "2024-05-01" }, { uri: "b", kind: "video", thumb: "t" }, { uri: "c", kind: "photo", date: "2023-01-01" }], oneDate: "x", today: "2024-09-09", newId: (p) => `${p}-${++n}`, now: 1 });
const one = buildNewPosts({ child, shape: "one", note: "", items: [{ uri: "a", kind: "photo", date: "2024-05-01" }, { uri: "b", kind: "photo" }], oneDate: "2024-05-01", today: "2024-09-09", newId: (p) => `${p}-${++n}`, now: 1 });
ok("[HOME-03] several files: separate posts keep each file's date (unknown → today, before birth → birth); one post holds them all", posts.length === 3 && posts.map((p) => p.date).join() === "2024-05-01,2024-09-09,2024-01-10" && posts[0].description === "Beach" && posts[1].media[0].thumb === "t" && one.length === 1 && one[0].media.length === 2 && one[0].date === "2024-05-01");
ok("[HOME-03] the form asks one post or separate posts, has an optional description and an OK button; the + button uses it", /"One post"/.test(read("src/components/ImportSheet.tsx")) && /"Separate posts"/.test(read("src/components/ImportSheet.tsx")) && /label="OK"/.test(read("src/components/ImportSheet.tsx")) && /source: "picker"/.test(read("src/lib/addPhotos.ts")));

/* ---------------- copy (COPY-01, and the no-emoji rule) ---------------- */
const shown = (src: string) => [...code(src).matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
ok("[COPY-01] no “e.g.” anywhere in what the app shows", !screens.some((f) => shown(read(f)).some((s) => /\be\.g\./.test(s))));
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{FF0B}]/u;
const btnLabels = screens.flatMap((f) => [...code(read(f)).matchAll(/<Btn[^>]*?label=(\{[^}]*\}|"[^"]*")/g)].map((m) => `${f}: ${m[1]}`));
ok("[copy rule] no emoji on any button" + (btnLabels.filter((l) => EMOJI.test(l)).length ? " — " + btnLabels.filter((l) => EMOJI.test(l))[0] : ""), btnLabels.length > 30 && !btnLabels.some((l) => EMOJI.test(l)));
ok("[copy rule] no emoji in the bottom bar, the Home filters, the tag categories or the person sheet", !EMOJI.test(read("app/(tabs)/_layout.tsx")) && !/label: "[^"]*[\u{1F300}-\u{1FAFF}]/u.test(read("app/(tabs)/index.tsx")) && !EMOJI.test(code(member)));
ok("siblings follow the gender when it is set", siblingRelationOf({ theme: "pink", gender: "boy" }) === "Brother" && siblingRelationOf({ theme: "blue", gender: "unspecified" }) === "Sibling" && siblingRelationOf({ theme: "pink" }) === "Sister");

console.log(fails ? `${fails} FAILED` : "all feedback (Oct 2026) tests passed");
