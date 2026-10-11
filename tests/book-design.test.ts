/*
 * The keepsake book's design: chapters by age, the birth details, the family pages, collages, birthdays, the look back at firsts, the
 * themed pages, one HTML for the print and the preview, and saving the PDF to a folder on the phone (not only sharing it).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOOK_PHOTO_LIMIT, birthDetails, birthdayOn, chapterOf, ordinal, planBook, sizeById, yearTitle } from "../src/lib/bookPages";
import { buildBookHtml, picturesInBook } from "../src/lib/bookHtml";
import { Child, Memory, MILESTONE_DEFS, Relative } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

const child: Child = { id: "c", name: "Maya", birth: "2024-01-10", theme: "pink", emoji: "🌸" };
let n = 0;
const mem = (type: Memory["type"], date: string, extra: Partial<Memory> = {}): Memory => ({
  id: `m${++n}`, childId: "c", type, description: "", date, media: [], tagIds: [], createdAt: n, emoji: "", palette: "peach", source: "", ...extra,
});
const photos = (k: number) => Array.from({ length: k }, (_, i) => ({ id: `p${n}-${i}`, kind: "photo" as const, uri: `file:///p${n}-${i}.jpg` }));
const photo = (date: string, k = 1, extra: Partial<Memory> = {}) => { const m = mem("photo", date, extra); m.media = photos(k); return m; };

/* ---------------- chapters by age */
ok("chapters: Newborn for the first four weeks, then every month in the first year", chapterOf("2024-01-10", "2024-01-30").label === "Newborn" && chapterOf("2024-01-10", "2024-02-12").label === "1 month" && chapterOf("2024-01-10", "2024-12-20").label === "11 months");
ok("then every 3 months up to 3 years, then every year", chapterOf("2024-01-10", "2025-01-10").label === "1 year" && chapterOf("2024-01-10", "2025-08-01").label === "1 year, 6 months" && chapterOf("2024-01-10", "2028-03-01").label === "4 years");
ok("each age has its own look (newborn, early months, later months, toddler, child)", ["2024-01-20", "2024-04-01", "2024-09-01", "2025-03-01", "2026-06-01"].map((d) => chapterOf("2024-01-10", d).band).join() === "newborn,early,late,toddler,kid");
ok("birthdays are recognised (and the birth day itself is not one)", birthdayOn("2024-01-10", "2025-01-10") === 1 && birthdayOn("2024-01-10", "2026-01-10") === 2 && birthdayOn("2024-01-10", "2024-01-10") === 0 && birthdayOn("2024-01-10", "2025-01-11") === 0);
ok("year openers are titled in words, birthdays as ordinals", yearTitle(1) === "Year two" && yearTitle(4) === "Year five" && ordinal(1) === "1st" && ordinal(2) === "2nd" && ordinal(3) === "3rd" && ordinal(11) === "11th" && ordinal(22) === "22nd");

/* ---------------- the plan */
const birthStory = mem("story", "2024-01-10", { title: "Hello", description: "Born at dawn", time: "06:12", location: "St Mary's" });
const weigh = mem("measure", "2024-01-11", { weightKg: 3.4, heightCm: 50 });
const newborn = photo("2024-01-20");
const month3 = photo("2024-04-15", 3);
const firstBday = photo("2025-01-10", 1, { title: "Cake!" });
const steps = mem("first", "2025-02-01", { title: "First steps" });
const smile = mem("first", "2024-02-20", { title: "First smile" });
const rolls = mem("milestone", "2024-05-01", { milestoneId: "mov-rolls" });
const longStory = mem("story", "2024-06-01", { title: "A long day", description: "x".repeat(400) });
const family: Relative[] = [{ id: "r1", name: "Rosa", relation: "Grandma", photoUri: "file:///rosa.jpg" }, { id: "r2", name: "Tom", relation: "Daddy" }];
const all = [steps, firstBday, month3, newborn, weigh, birthStory, smile, rolls, longStory];
const plan = planBook(child, all, sizeById("square-20"), { family });
const kinds = plan.pages.map((p) => p.kind);

ok("it opens like a baby book: the cover, the day they were born, then the people who love them", kinds.slice(0, 3).join() === "cover,birth,family");
const birth = plan.pages[1] as Extract<(typeof plan.pages)[number], { kind: "birth" }>;
ok("the birth page has that day's details: time and place, and the weight and length from the first days", birth.details.time === "06:12" && birth.details.place === "St Mary's" && birth.details.weightKg === 3.4 && birth.details.heightCm === 50 && birth.story === birthStory);
ok("birth details only come from the first three days", birthDetails(child, [mem("measure", "2024-01-20", { weightKg: 4 })]).weightKg === undefined);
ok("the family pages list the child's family", (plan.pages[2] as { people?: Relative[] }).people?.length === 2);
ok("a book with no family has no family page", !planBook(child, all, sizeById("square-20")).pages.some((p) => p.kind === "family"));
ok("the cover shows a picture of them (their profile picture when set, else the first picture)", (plan.pages[0] as { photo?: string }).photo === newborn.media[0].uri && (planBook({ ...child, avatarPhotoId: month3.id }, all, sizeById("square-20")).pages[0] as { photo?: string }).photo === month3.media[0].uri);

const chapterStarts = plan.pages.filter((p) => p.opens).map((p) => p.chapter?.label);
ok("each chapter's first page carries its heading, in date order (only chapters that have memories; a book with a little each month gets 3-month chapters)", chapterStarts.join() === "The first 3 months,3 to 6 months,1 year");
ok("chapters stay in date order and memories are never regrouped by kind", plan.pages.filter((p) => p.chapter).every((p, i, a) => i === 0 || (a[i - 1].chapter!.year <= p.chapter!.year)));
const yearIdx = kinds.indexOf("year");
ok("a new year of life opens with a page of its own, before that year's first memory", yearIdx > 0 && (plan.pages[yearIdx] as { year?: number }).year === 1 && plan.pages[yearIdx + 1].kind === "picture" && (plan.pages[yearIdx + 1] as { memory?: Memory }).memory === firstBday);
ok("a picture taken on a birthday is a birthday page", (plan.pages[yearIdx + 1] as { birthday?: number }).birthday === 1);
const collage = plan.pages.find((p) => p.kind === "picture" && p.memory === month3) as { photos: string[] } | undefined;
ok("a memory with several pictures shows them together, as a collage", collage?.photos.length === 3);
ok("a long story without a picture gets a page of its own", plan.pages.some((p) => p.kind === "story" && p.memory === longStory));
ok("near the end: a look back at every first and milestone (when there are a few), then today", kinds.slice(-2).join() === "firsts,end" && (plan.pages[plan.pages.length - 2] as { memories: Memory[] }).memories.map((m) => m.id).join() === [smile, rolls, steps].map((m) => m.id).join());
ok("the photo count includes the collage pictures and the birth picture", plan.pictures === 1 + 3 + 1 && plan.available === 3);
ok("every picture shown is loaded once for the PDF (cover, pages, family faces)", picturesInBook(plan).sort().join() === [newborn.media[0].uri, ...month3.media.map((x) => x.uri), firstBday.media[0].uri, "file:///rosa.jpg"].sort().join());

// the picture limit still holds, collages included: extra pictures only use what's left of it
const many = Array.from({ length: 150 }, (_, i) => photo(`2024-${String(2 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`, 3));
const big = planBook(child, many, sizeById("square-20"));
const pictured = (pl: typeof big) => pl.pages.flatMap((p) => (p.kind === "picture" ? [p.memory] : p.kind === "pictures" ? p.items.map((x) => x.memory) : []));
ok(`at most ${BOOK_PHOTO_LIMIT} pictures, collages included`, big.pictures === BOOK_PHOTO_LIMIT && pictured(big).length === BOOK_PHOTO_LIMIT);
const few = planBook(child, many.slice(0, 10), sizeById("square-20"));
ok("with room to spare, every picture of a memory is shown (up to 4)", few.pictures === 30);

ok("a year in review keeps its cover but has no birth or family pages", (() => { const p = planBook(child, all, sizeById("square-20"), { family, intro: false }); return p.pages[0].kind === "cover" && !p.pages.some((x) => x.kind === "birth" || x.kind === "family"); })());

/* ---------------- the pages, drawn */
const html = (style: "classic" | "modern" | "playful" | "nature", mode: "print" | "pager" | "overview" = "print") =>
  buildBookHtml({ child, plan, defs: MILESTONE_DEFS, style, size: sizeById("square-20"), relatives: family, image: (u) => `data:${u}`, mode, start: 2, overview: [{ index: 0, width: 300 }, { index: 1, width: 90 }] });
const classic = html("classic");
ok("pages are themed by what they hold: a ribbon for a first or milestone, a birthday banner", />First</.test(classic) && />Milestone</.test(classic) && /1st birthday/.test(classic));
ok("the birth page lists the details of the day", /The day Maya was born/.test(classic) && /Wednesday, 10 January 2024/.test(classic) && /06:12/.test(classic) && /St Mary&#39;s|St Mary's/.test(classic) && /3\.4 kg/.test(classic) && /50 cm/.test(classic));
ok("the family page shows faces and how each person is related", /The people who love you/.test(classic) && /data:file:\/\/\/rosa\.jpg/.test(classic) && /Grandma/.test(classic) && /Daddy/.test(classic));
ok("the year opener and the end page", /Year two/.test(classic) && /Happy first birthday/.test(classic) && /Maya today/.test(classic));
ok("page numbers run through the book, with the chapter in the footer", /class="folio"><span>The first 3 months<\/span><span>3<\/span>/.test(classic));
ok("the little drawings change with age in Classic, Nature and Playful, and Modern has none", /class="motif/.test(classic) && /class="motif/.test(html("playful")) && /class="motif/.test(html("nature")) && !/class="motif/.test(html("modern")) && !/class="mini"/.test(html("modern")));
ok("people's names and words are escaped", !/<script/.test(buildBookHtml({ child: { ...child, name: "<script>x" }, plan, defs: [], style: "classic", size: sizeById("square-20"), image: () => null })));
ok("pictures come from where the caller says (data URLs for the PDF, the file itself for the preview)", /src="data:file:\/\/\/p/.test(classic));
ok("the preview is the same pages, in a swipeable pager that reports the page and can be sent to one", /class="pager"/.test(html("classic", "pager")) && /postMessage\(JSON\.stringify\(\{page:i\}\)\)/.test(html("classic", "pager")) && /window\.go=/.test(html("classic", "pager")) && html("classic", "pager").includes('pager.scrollLeft=2*window.innerWidth'));
ok("the overview shows the cover large and pages small; tapping one opens it", (html("classic", "overview").match(/class="frame"/g) || []).length === 2 && /onclick="tap\(1\)"/.test(html("classic", "overview")));
ok("the preview scales each page exactly (a transform, not zoom, which would lay the page out again)", /transform:scale\(/.test(html("classic", "overview")) && !/zoom:/.test(html("classic", "pager")));

/* ---------------- wiring: one HTML for both, and saving as well as sharing */
const preview = read("src/components/BookPreview.tsx"), pdf = read("src/lib/pdf.ts"), tab = read("app/(tabs)/book.tsx"), files = read("src/lib/exportFiles.ts"), recap = read("src/components/Memories.tsx");
ok("the preview and the PDF are drawn from the same HTML", /buildBookHtml\(/.test(preview) && /buildBookHtml\(/.test(pdf) && /<WebView/.test(preview) && /allowFileAccess: true/.test(preview));
ok("the PDF can be saved to a folder you pick, not only shared", /Directory\.pickDirectoryAsync/.test(files) && /folder\.createFile\(fileName, mimeType\)/.test(files) && /if \(to === "save"\)/.test(pdf) && /saveToFolder\("application\/pdf"\)/.test(pdf));
ok("the folder is picked before the PDF is built, so closing the picker costs nothing", pdf.indexOf('saveToFolder("application/pdf")') < pdf.indexOf("const { uri, fileName } = await printBook(i, onProgress);"));
ok("the Book page offers Save PDF to phone and Share PDF (just before exporting, with the theme); so does the year in review", /Save PDF to phone/.test(read("src/components/BookExportSheet.tsx")) && /Share PDF/.test(read("src/components/BookExportSheet.tsx")) && /onExport\("save"\)/.test(read("src/components/BookExportSheet.tsx")) && /onExport=\{doExport\}/.test(tab) && /Save this year as PDF/.test(recap) && /Share this year as PDF/.test(recap));
ok("the book gets the family in the parent's order and the chosen weight and length units", /orderedFamily\(familyOf\(relatives, k\.id\)/.test(tab) && /weightUnit, heightUnit/.test(tab));

console.log(fails ? `${fails} FAILED` : "all book design tests passed");
if (fails) process.exit(1);
