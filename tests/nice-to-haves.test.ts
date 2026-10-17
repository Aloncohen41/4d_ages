/*
 * Part B of the October 2026 feedback ("nice to haves", NTH-01 … NTH-09), and the finishing touches to FAM-06 (drag to reorder). The logic is
 * tested directly; screens and the database are read as source, so their wiring is pinned down even though they can't be run here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLASSICS, TEETH, datedItems, filledCount, listItems, classicById, ClassicEntry } from "../src/lib/classics";
import { BOOK_COLOURS, BOOK_STYLES, chunks, colourById, planBook, selectForBook, sizeById, startsAtBirth, styleById } from "../src/lib/bookPages";
import { buildBookHtml, THEME_MOTIFS } from "../src/lib/bookHtml";
import { searchMemories } from "../src/lib/search";
import { CHART_SOURCES, inStep, lmsAt, normalCdf, percentileFor, percentileLabel, zScore } from "../src/lib/percentiles";
import { GROWTH_REFS } from "../src/lib/growthRefs";
import { classicToRow, mergeClassics, memoryToRow, mergeMemories } from "../src/lib/syncMerge";
import { dropIndex, moveTo } from "../src/lib/family";
import { Child, Memory, MILESTONE_DEFS, Tag } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

const child: Child = { id: "c", name: "Maya", birth: "2024-01-10", theme: "pink", emoji: "🌸" };
let n = 0;
const mem = (type: Memory["type"], date: string, extra: Partial<Memory> = {}): Memory => ({
  id: `m${++n}`, childId: "c", type, description: "", date, media: [], tagIds: [], createdAt: n, emoji: "", palette: "peach", source: "", ...extra,
});
const photo = (date: string, extra: Partial<Memory> = {}) => mem("photo", date, { media: [{ id: `p${n}`, kind: "photo", uri: `file:///p${n}.jpg` }], ...extra });

/* ---------------- NTH-01 Classics */
const ids = CLASSICS.map((c) => c.id);
ok("[NTH-01] the four templates Yael named: teeth, birth story, food, comfort toy and favourite toys", ["teeth", "birth", "food", "toys"].every((x) => ids.includes(x)));
ok("[NTH-01] and the suggested ones: haircut, hand and footprints, first words, holiday, first birthday, letter, family tree, monthly photos, favourites, sleep, nursery or school, firsts checklist",
  ["haircut", "prints", "words", "holiday", "birthday", "letter", "tree", "grid", "favourites", "sleep", "school", "firsts"].every((x) => ids.includes(x)));
const birthT = classicById("birth")!;
ok("[NTH-01] the birth story asks when, where, length of labour, type of birth, birth weight, who was there and the story", ["date", "place", "labour", "type", "weight", "who", "story"].every((f) => birthT.fields.some((x) => x.id === f)));
ok("[NTH-01] teeth: a mouth of 20 baby teeth, each with its own date", TEETH.length === 20 && new Set(TEETH.map((x) => x.id)).size === 20 && TEETH.filter((x) => x.upper).length === 10);
ok("[NTH-01] food: allergies, foods they like and don't", ["allergies", "likes", "dislikes"].every((f) => classicById("food")!.fields.some((x) => x.id === f)));
ok("[NTH-01] placeholders say “Example:” (no “e.g.”)", CLASSICS.every((c) => c.fields.every((f) => !f.placeholder || !/e\.g\./i.test(f.placeholder))));
const teethEntry: ClassicEntry = { id: "teeth", childId: "c", values: { "teeth.LRA": "2024-08-01", "teeth.LLA": "2024-07-20", notes: "" }, photos: {} };
ok("[NTH-01] filled-in fields are counted, and dated teeth come out in date order", filledCount(classicById("teeth")!, teethEntry) === 1 && datedItems(teethEntry, classicById("teeth")!.fields[0]).map((x) => x.id).join() === "LLA,LRA");
ok("[NTH-01] a list field is one item per line", listItems("Bananas\n\n Pasta \n").join() === "Bananas,Pasta");
const birthEntry: ClassicEntry = { id: "birth", childId: "c", values: { place: "City Hospital", weight: "3.4 kg", type: "Caesarean", who: "Mummy and Daddy", story: "At sunrise." }, photos: { photo: [{ id: "bp", kind: "photo", uri: "file:///birth.jpg" }] } };
const food: ClassicEntry = { id: "food", childId: "c", values: { likes: "Bananas" }, photos: {} };
const withClassics = planBook(child, [photo("2024-03-01")], sizeById("square-20"), { classics: [birthEntry, teethEntry, food] });
const birthPage = withClassics.pages.find((p) => p.kind === "birth") as Extract<(typeof withClassics.pages)[number], { kind: "birth" }>;
ok("[NTH-01] the Birth story fills in the book's birth page (place, weight, type, who was there, the story, the photo)", birthPage.details.place === "City Hospital" && birthPage.details.weightText === "3.4 kg" && birthPage.details.type === "Caesarean" && birthPage.details.who === "Mummy and Daddy" && birthPage.storyText === "At sunrise." && birthPage.photoUri === "file:///birth.jpg");
ok("[NTH-01] every other filled-in Classic gets a keepsake page in the book, in the Classics order", withClassics.pages.filter((p) => p.kind === "classic").map((p) => (p as { entry: ClassicEntry }).entry.id).join() === "teeth,food");
const classicHtml = buildBookHtml({ child, plan: withClassics, defs: MILESTONE_DEFS, style: "classic", size: sizeById("square-20"), image: (u) => u });
ok("[NTH-01] the keepsake pages show their words, and teeth a drawing of the mouth", /Keepsake/.test(classicHtml) && /class="mouth"/.test(classicHtml) && /Bananas/.test(classicHtml) && /Caesarean/.test(classicHtml));
const row = classicToRow({ ...teethEntry, photos: { photo: [{ id: "a", kind: "photo", uri: "file:///a.jpg", path: "c/classic-teeth-a.jpg" }, { id: "b", kind: "photo", uri: "file:///b.jpg" }] } }, 5);
const back = mergeClassics([], [{ ...row, updated_at: "x" }]);
ok("[NTH-01] Classics sync: words and uploaded pictures go up, and come back on the other phone", row.child_id === "c" && row.id === "teeth" && row.media.photo.length === 1 && back[0].values["teeth.LRA"] === "2024-08-01" && back[0].photos.photo[0].path === "c/classic-teeth-a.jpg" && back[0].syncedTs === 5);
ok("[NTH-01] a Classic cleared on the other phone is cleared here", mergeClassics(back, [{ ...row, client_ts: 9, deleted: true }]).length === 0);
const schema = read("supabase/schema.sql");
ok("[NTH-01] the cloud keeps Classics in their own table, private to the family (editors only)", /create table if not exists public\.classics/.test(schema) && /enable row level security/.test(schema) && /member_read on public\.classics for select to authenticated using \(public\.is_editor\(child_id\)\)/.test(schema));
ok("[NTH-01] Classics is in the top menu, behind sign-in, with a page per template", /item\("classics", "Classics", "\/classics"\)/.test(read("src/components/Screen.tsx")) && /name="classics"/.test(read("app/_layout.tsx")) && /name="classic\/\[id\]"/.test(read("app/_layout.tsx")) && /<Mouth /.test(read("app/classic/[id].tsx")));
ok("[NTH-01] the book gets the child's Classics", /planBook\(child, chosen, size, \{ family, intro, classics, siblings, places, mapUri, memorial: memorialPage, together \}\)/.test(read("app/(tabs)/book.tsx")) && /classics: i\.classics/.test(read("src/lib/pdf.ts")));

/* ---------------- NTH-02 date range, NTH-03 include / exclude, NTH-06 a book about someone */
const a = photo("2024-02-01"), b = photo("2024-05-01"), c2 = photo("2024-09-01", { tagIds: ["tag-person-rosa"] });
ok("[NTH-02] the book covers only the dates you choose", selectForBook([a, b, c2], { from: "2024-03-01", to: "2024-06-30" }).map((m) => m.id).join() === b.id);
ok("[NTH-02] a book that starts after the birth has no birth and family pages", !startsAtBirth(child, { from: "2024-03-01" }) && startsAtBirth(child, {}) && startsAtBirth(child, { from: child.birth }));
ok("[NTH-03] posts you untick are left out of the book", selectForBook([a, b, c2], { excluded: [b.id] }).map((m) => m.id).join() === [a.id, c2.id].join());
ok("[NTH-03] the Book page has From / To dates and a Choose posts list with a tick per post", /<DateField value=\{prefs\.from/.test(read("app/(tabs)/book.tsx")) && /Choose posts/.test(read("app/(tabs)/book.tsx")) && /accessibilityRole="checkbox"/.test(read("src/components/BookPostsSheet.tsx")));
const rosaTag: Tag = { id: "tag-person-rosa", name: "Grandma Rosa", category: "person", relatedFamilyMemberId: "rosa" };
ok("[NTH-06] a book about someone has only the posts they're tagged in", selectForBook([a, b, c2], { personId: "rosa" }, [rosaTag]).map((m) => m.id).join() === c2.id && !startsAtBirth(child, { personId: "rosa" }));
ok("[NTH-06] a person's page has “Make a book about …”, which opens Book with only their posts", /Make a book about/.test(read("app/person/[id].tsx")) && /setBookPrefs\(child\.id, \{ personId: person\.id \}\)/.test(read("app/person/[id].tsx")) && /router\.navigate\("\/book"\)/.test(read("app/person/[id].tsx")));
ok("[NTH-02, 03, 06] the book's settings are kept for each child", /bookPrefs: s\.bookPrefs/.test(read("src/lib/store.ts")) && /setBookPrefs: \(childId, patch\)/.test(read("src/lib/store.ts")));

/* ---------------- NTH-04 themes */
ok("[NTH-04] the themes: Classic graphics, Nature, Child's games (Playful), Modern (plain), and four kids' themes with page backgrounds", BOOK_STYLES.map((s) => s.id).slice(0, 8).join() === "classic,nature,playful,modern,stars,blossom,explorer,rainbow" && /games/i.test(BOOK_STYLES.find((s) => s.id === "playful")!.desc));
ok("[NTH-04] each in several colours (by age, or one colour all through)", BOOK_COLOURS.length >= 5 && colourById("nope") === "age");
ok("[NTH-04] themes from earlier versions still open", styleById("minimal") === "modern" && styleById("storybook") === "playful" && styleById(undefined) === "classic");
ok("[NTH-04] each illustrated theme has its own drawings for every age", (["classic", "nature", "playful"] as const).every((t) => ["newborn", "early", "late", "toddler", "kid"].every((b) => !!THEME_MOTIFS[t][b as "newborn"])) && THEME_MOTIFS.nature.toddler === "tree" && THEME_MOTIFS.playful.early === "ball");
const plan = planBook(child, [photo("2024-03-01")], sizeById("square-20"));
const draw = (style: "nature" | "modern", colour: "age" | "sky") => buildBookHtml({ child, plan, defs: [], style, colour, size: sizeById("square-20"), image: (u) => u });
ok("[NTH-04] a colour runs through the whole book; Modern has no drawings", draw("nature", "sky").includes("#55819f") && !/class="motif/.test(draw("modern", "age")) && /class="motif/.test(draw("nature", "age")));

/* ---------------- NTH-05 search a person's timeline */
const walk = mem("milestone", "2025-03-05", { milestoneId: "mov-walks" });
const beach = photo("2024-07-15", { title: "Beach day", location: "Brighton" });
const found = (q: string) => searchMemories([walk, beach], q, [], [], 40, { birth: child.birth, defs: MILESTONE_DEFS }).map((m) => m.id).join();
ok("[NTH-05] search by date (as written or as numbers)", found("March 2025") === walk.id && found("2024-07") === beach.id);
ok("[NTH-05] search by event, place or age", found("beach") === beach.id && found("brighton") === beach.id && found("6 months") === beach.id);
ok("[NTH-05] a person's page has a search field over their timeline", /searchMemories\(posts, query/.test(read("app/person/[id].tsx")) && /Search by date or event/.test(read("app/person/[id].tsx")));

/* ---------------- NTH-07 sharing by person */
ok("[NTH-07] an invite gives full access or view-only access to the posts with chosen people", /create_invite\(p_child text, p_people text\[\] default null, p_email text default null\)/.test(schema) && /case when p_people is null then 'editor' else 'viewer' end/.test(schema));
ok("[NTH-07] a viewer only sees memories tagged with one of their people; only editors can change anything", /can_see_memory/.test(schema) && /member_read on public\.memories for select to authenticated using \(public\.can_see_memory\(child_id, tags\)\)/.test(schema) && /editor_write on public\.%I for insert to authenticated with check \(public\.is_editor\(child_id\)\)/.test(schema) && /media_editor_insert/.test(schema));
ok("[NTH-07] earlier app versions keep working: an invite without people gives full access, and the old function is replaced, not doubled", /drop function if exists public\.create_invite\(text\);/.test(schema));
ok("[NTH-07] a viewer is never handed the book when its owner deletes their account", /m\.role <> 'viewer' order by m\.created_at limit 1\) as heir/.test(schema));
const sync = read("src/lib/sync.ts");
ok("[NTH-07] the app sends the chosen people, learns its own access, and a viewer's phone never sends changes", /p_people: people/.test(sync) && /myAccess\(childId\)/.test(sync) && /if \(!viewer\) await pushChild/.test(sync));
ok("[NTH-07] view only on the phone: nothing can be changed (the store refuses it), no + button, no Edit, and a note on Home", /isViewOnly\(get\(\), input\.childId\)/.test(read("src/lib/store.ts")) && /active\.role !== "viewer" && !wide \? <Fab/.test(read("app/(tabs)/_layout.tsx")) && /child\.role !== "viewer" \? \(/.test(read("src/components/PostCard.tsx")) && /View only: you see the posts/.test(read("app/(tabs)/index.tsx")));
ok("[NTH-07] the share screen invites family to view, with a tick for each family member", /A family member/.test(read("app/share.tsx")) && /accessibilityRole=\{single \? "radio" : "checkbox"\}/.test(read("app/share.tsx")) && /inviteFor\(child\.id, kind, email, kind === "family" \? people : \[\]\)/.test(read("app/share.tsx")));

/* ---------------- NTH-08 tags on Home */
ok("[NTH-08] Home's timeline can be filtered by tags, shown as chips you can remove", /itemsWithTags\(byKind, homeTags\)/.test(read("app/(tabs)/index.tsx")) && /<TagChip key=\{id\} tag=\{tag\} onRemove=/.test(read("app/(tabs)/index.tsx")) && /Show these on the timeline/.test(read("src/components/TagBrowser.tsx")));
ok("[NTH-08] Home's search also finds dates and ages", /searchMemories\(memories, query, tags, relatives, 40, \{ birth: child\?\.birth \}\)/.test(read("src/components/SearchSheet.tsx")));

/* ---------------- NTH-09 growth percentiles */
ok("[NTH-09] the maths: a median is the 50th percentile, the normal curve is right", Math.abs(normalCdf(0) - 0.5) < 1e-6 && Math.abs(normalCdf(1.96) - 0.975) < 1e-4 && Math.abs(zScore(10, [1, 10, 0.1])) < 1e-9);
ok("[NTH-09] WHO: a boy of 12 months at 9.65 kg is on the 50th percentile; a girl of 24 months at 86.4 cm about the 54th", Math.round(percentileFor("who", "weight", "boy", 12, 9.6479)!.percentile) === 50 && Math.round(percentileFor("who", "height", "girl", 24, 86.4)!.percentile) === 54);
ok("[NTH-09] head circumference too (WHO to 5 years, CDC to 3)", percentileFor("who", "head", "boy", 6, 43.3) !== null && percentileFor("who", "head", "boy", 70, 50) === null && percentileFor("cdc", "head", "girl", 30, 48) !== null);
ok("[NTH-09] CDC (US) charts as an option, to 20 years", percentileFor("cdc", "height", "boy", 120, 138.4) !== null && CHART_SOURCES.map((c) => c.id).join() === "who,cdc");
ok("[NTH-09] respects gender: “Prefer not to say” averages girls and boys", (() => { const g = percentileFor("who", "weight", "girl", 12, 9.2)!.z, b = percentileFor("who", "weight", "boy", 12, 9.2)!.z, all = percentileFor("who", "weight", "all", 12, 9.2)!.z; return Math.abs(all - (g + b) / 2) < 1e-9 && g > b; })());
ok("[NTH-09] the tables cover the ages they should (WHO weight to 10 years, height to 19; CDC to 20)", GROWTH_REFS.who.weight.boy.at(-1)![0] >= 120 && GROWTH_REFS.who.height.girl.at(-1)![0] >= 228 && GROWTH_REFS.cdc.height.boy.at(-1)![0] >= 240 && lmsAt(GROWTH_REFS.who.weight.boy, 999) === null);
ok("[NTH-09] percentiles read naturally", percentileLabel(52.4) === "52nd percentile" && percentileLabel(11.2) === "11th percentile" && percentileLabel(0.4) === "Below the 1st percentile" && percentileLabel(99.6) === "Above the 99th percentile");
ok("[NTH-09] the combined indicator: height and weight in step, or one ahead of the other", inStep({ z: 0, percentile: 50 }, { z: 0.5, percentile: 69 }) === "in-step" && inStep({ z: -1, percentile: 16 }, { z: 1, percentile: 84 }) === "heavier" && inStep({ z: 1, percentile: 84 }, { z: -1, percentile: 16 }) === "lighter");
const hm = mem("measure", "2024-06-01", { headCm: 42.5 });
ok("[NTH-09] head circumference is a measurement like height and weight, and syncs", memoryToRow(hm, [], 1).head_cm === 42.5 && mergeMemories([], [{ ...memoryToRow(hm, [], 2) }])[0].headCm === 42.5 && /head_cm numeric/.test(schema) && /Head circumference/.test(read("src/components/EntrySheet.tsx")));
ok("[NTH-09] the Growth page opens with height (left), weight (right) and head, each with its percentile; the charts are chosen in Settings", /<GrowthSummary child=\{child\} memories=\{memories\} \/>/.test(read("app/(tabs)/growth.tsx")) && /cell\("Height"[\s\S]*cell\("Weight"[\s\S]*cell\("Head circumference"/.test(read("src/components/GrowthSummary.tsx")) && /<Section title="Growth charts">/.test(read("app/settings.tsx")));
ok("[NTH-09] the reference data is generated from the published WHO and CDC tables, with the sources on record", /cdc\.gov\/growthcharts/.test(read("scripts/make-growth-refs.mjs")) && /WorldHealthOrganization/.test(read("scripts/make-growth-refs.mjs")) && /UK90 parts are licensed/.test(read("scripts/make-growth-refs.mjs")));

/* ---------------- FAM-06 drag to reorder */
ok("[FAM-06] a dragged person lands where they're dropped", moveTo(["a", "b", "c", "d"], "a", 2).join() === "b,c,a,d" && moveTo(["a", "b", "c"], "c", 0).join() === "c,a,b" && dropIndex([30, 100, 170, 240], 0, 180) === 2 && dropIndex([30, 100, 170, 240], 3, 40) === 1 && dropIndex([30, 100, 170, 240], 3, 20) === 0 && dropIndex([30, 100, 170], 1, 110) === 1);
ok("[FAM-06] the Family page has a drag handle per row in Edit mode (the arrows stay, for accessibility)", /<Icon name="drag"/.test(read("app/family.tsx")) && /PanResponder\.create/.test(read("app/family.tsx")) && /Move \$\{displayName\(r\)\} up/.test(read("app/family.tsx")));

/* ---------------- dark mode in Settings */
ok("Settings → Appearance: Light (the default for everyone), Same as phone or Dark; the app and the phone's own pickers follow it",
  /<Section title="Appearance">/.test(read("app/settings.tsx")) && /label: "Same as phone"/.test(read("app/settings.tsx")) && /appearance: "light",/.test(read("src/lib/store.ts")) && /s\.appearance === "system" \? \{ \.\.\.s, appearance: "light" \}/.test(read("src/lib/migrate.ts")) &&
  /appearance: s\.appearance/.test(read("src/lib/store.ts")) && /appearance === "system" \? phone === "dark" : appearance === "dark"/.test(read("src/lib/useTheme.ts")) &&
  /Appearance\.setColorScheme\(appearance === "system" \? "unspecified" : appearance\)/.test(read("app/_layout.tsx")));

/* ---------------- the book: long lists are shared evenly over pages */
ok("lists over several pages are shared evenly (no page with one lonely item)", chunks(Array.from({ length: 13 }, (_, i) => i), 12).map((p) => p.length).join() === "7,6" && chunks([1, 2, 3], 12).length === 1);

console.log(fails ? `${fails} FAILED` : "all nice-to-have tests passed");
if (fails) process.exit(1);
