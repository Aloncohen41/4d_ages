/*
 * The book, before v1.0.5: an export that can't run the phone out of memory (pictures sized for where they're printed, within a total
 * budget), pages filled smartly (moments sharing pages, longer chapters for a book with a little each month), voice notes left out, the
 * four kids' themes with page backgrounds chosen just before exporting, and who can see a child managed by email (invites for one email,
 * remove, block, unblock).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planBook, sizeById, inBook, KIDS_THEMES, BOOK_SIZES, chapterOf } from "../src/lib/bookPages";
import { buildBookHtml, printSizes, PRINT_BUDGET_BYTES, THEME_BACKGROUND } from "../src/lib/bookHtml";
import { Child, Memory, MILESTONE_DEFS } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

const child: Child = { id: "c", name: "Maya", birth: "2024-01-10", theme: "pink", emoji: "🌸" };
let n = 0;
const mem = (type: Memory["type"], date: string, extra: Partial<Memory> = {}): Memory => ({
  id: `m${++n}`, childId: "c", type, description: "", date, media: [], tagIds: [], createdAt: n, emoji: "", palette: "peach", source: "", ...extra,
});
const photo = (date: string, extra: Partial<Memory> = {}) => mem("photo", date, { media: [{ id: `p${n}`, kind: "photo", uri: `file:///p${n}.jpg` }], ...extra });
const day = (i: number) => { const d = new Date(2024, 0, 12 + i * 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/* ---------------- an export that can't run out of memory */
const huge = Array.from({ length: 300 }, (_, i) => photo(day(i), { description: i % 3 ? "Short" : "", media: Array.from({ length: i % 4 === 0 ? 3 : 1 }, (_, j) => ({ id: `h${i}-${j}`, kind: "photo" as const, uri: `file:///h${i}-${j}.jpg` })) }));
for (const size of BOOK_SIZES) {
  const plan = planBook(child, huge, size);
  const sizes = printSizes(plan, size);
  const bytes = [...sizes.values()].reduce((t, px) => t + px * px * 0.75 * 0.16, 0);
  ok(`${size.id}: a 300-memory book's pictures stay within the print budget (${(bytes / 1048576).toFixed(1)} MB of ${(PRINT_BUDGET_BYTES / 1048576).toFixed(0)}), none larger than its place on the page`, bytes <= PRINT_BUDGET_BYTES * 1.001 && [...sizes.values()].every((px) => px >= 200 && px <= 1600) && sizes.size <= 100);
}
const small = planBook(child, [photo("2024-03-01")], sizeById("square-20"));
ok("a picture on a page of its own is printed sharp (about 170 dpi across the page)", Math.max(...printSizes(small, sizeById("square-20")).values()) > 900);
const pdf = read("src/lib/pdf.ts");
ok("the export sizes each picture for its place, one at a time, and a picture that can't be read leaves an empty frame (never stops the book)", /printSizes\(plan, size\)/.test(pdf) && /shrunkBase64\(u, px, PRINT_QUALITY\)\.catch\(\(\) => null\)/.test(pdf) && !/PRINT_PX = 1400/.test(pdf));
ok("if the phone can't make the PDF, it says so and suggests what to try (no crash); progress is shown while it works", /The phone couldn't make the PDF/.test(pdf) && /onProgress\?\.\(`Preparing pictures/.test(pdf) && /Couldn't save to that folder/.test(read("src/lib/exportFiles.ts")) && /progress=\{progress\}/.test(read("app/(tabs)/book.tsx")));

/* ---------------- filling the pages */
const moments = Array.from({ length: 8 }, (_, i) => photo(`2024-0${2 + Math.floor(i / 4)}-${String(10 + i).padStart(2, "0")}`, { title: `Moment ${i}` }));
const filled = planBook(child, moments, sizeById("square-20"));
const shared = filled.pages.filter((p) => p.kind === "pictures");
ok("moments with short captions share pages (up to 4 a page), so there's less empty space", shared.length >= 2 && shared.every((p) => p.kind === "pictures" && p.items.length >= 2 && p.items.length <= 4) && !filled.pages.some((p) => p.kind === "picture"));
const long = Array.from({ length: 4 }, (_, i) => photo(`2024-02-${String(10 + i).padStart(2, "0")}`, { description: "x".repeat(150) }));
ok("with longer captions, two share a page", planBook(child, long, sizeById("square-20")).pages.filter((p) => p.kind === "pictures").every((p) => p.kind === "pictures" && p.items.length === 2));
ok("the small square book shares at most two a page", planBook(child, moments, sizeById("square-15")).pages.every((p) => p.kind !== "pictures" || p.items.length <= 2));
const bday = photo("2025-01-10", { title: "Cake" });
ok("a birthday or a collage still gets a page of its own", planBook(child, [...moments, bday], sizeById("square-20")).pages.some((p) => p.kind === "picture" && p.memory === bday));
const note = mem("story", "2024-02-20", { title: "First giggle" });
const withNote = planBook(child, [photo("2024-02-21", { title: "Bath" }), note], sizeById("square-20"));
ok("one or two short notes join a picture's page in their chapter instead of a page alone", withNote.pages.some((p) => p.kind === "picture" && p.notes?.[0] === note) && !withNote.pages.some((p) => p.kind === "notes"));
ok("a book with a little each month gets longer chapters (every 3 months in the first year)", chapterOf("2024-01-10", "2024-05-01", true).label === "3 to 6 months" && chapterOf("2024-01-10", "2024-05-01").label === "3 months");
const html = buildBookHtml({ child, plan: filled, defs: MILESTONE_DEFS, style: "classic", size: sizeById("square-20"), image: (u) => u });
ok("the shared pages are drawn: each moment with its picture and caption", /class="page pictures n4/.test(html) && (html.match(/class="moment"/g) || []).length === 8);

/* ---------------- voice notes stay out of the book */
const voice = mem("story", "2024-03-01", { title: "Voice note", media: [{ id: "v", kind: "audio", uri: "file:///v.m4a" }] });
const voiceWithWords = mem("story", "2024-03-02", { description: "She sang!", media: [{ id: "w", kind: "audio", uri: "file:///w.m4a" }] });
ok("voice recordings don't go to the book: a recording alone is left out, and a story with words keeps only its words", !inBook(voice) && inBook(voiceWithWords) && !planBook(child, [voice], sizeById("square-20")).pages.some((p) => JSON.stringify(p).includes(voice.id)) && !buildBookHtml({ child, plan: planBook(child, [voiceWithWords], sizeById("square-20")), defs: [], style: "classic", size: sizeById("square-20"), image: (u) => u }).includes(".m4a"));

/* ---------------- the kids' themes */
ok("four kids' themes, each with its page background (and a frame on three)", KIDS_THEMES.join() === "stars,blossom,explorer,rainbow" && KIDS_THEMES.every((id) => !!THEME_BACKGROUND[id]?.pattern) && KIDS_THEMES.filter((id) => !!THEME_BACKGROUND[id]?.frame).length === 3);
const bl = buildBookHtml({ child, plan: filled, defs: [], style: "blossom", size: sizeById("square-20"), image: (u) => u });
ok("the background is printed on every page, with the frame, and pages keep their own colour under it", /\.page\{background-image:url\("data:image\/svg\+xml/.test(bl) && /\.page:before\{content:""/.test(bl) && !/class="page cover" style="background:/.test(bl));
ok("the theme is chosen just before exporting, from cards", /title="Before you export"/.test(read("src/components/BookExportSheet.tsx")) && /<ThemeCards value=\{style\}/.test(read("src/components/BookExportSheet.tsx")) && /<BookExportSheet /.test(read("app/(tabs)/book.tsx")));

/* ---------------- who can see a child, by email */
const schema = read("supabase/schema.sql"), access = read("app/share.tsx");
ok("an invite can be for one email: only that email can join with it", /p_email text default null/.test(schema) && /This code was made for a different email address/.test(schema) && /inviteFor\(child\.id, kind, email/.test(access) && /The invite only works for this email/.test(access));
ok("block: someone removed and blocked can't join again with any code, until unblocked", /create table if not exists public\.child_blocks/.test(schema) && /You don''t have access to this book/.test(schema) && /create or replace function public\.unblock_email/.test(schema) && /"Remove and block"/.test(access) && /Unblock/.test(access));
ok("inviting a family member is different from inviting the other parent", /"The other parent"/.test(access) && /title="A family member"/.test(access) && /They see only the posts with the people you choose/.test(access));
ok("everyone with access is listed by email, with what family members see (and Change)", /m\.me \? `You\$\{m\.email \? ` \(\$\{m\.email\}\)` : ""\}` : m\.email/.test(access) && /setMemberPeople\(child\.id, member\.userId, people\)/.test(access));

console.log(fails ? `${fails} FAILED` : "all book and access tests passed");
if (fails) process.exit(1);
