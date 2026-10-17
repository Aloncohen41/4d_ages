/*
 * Sharing into the app (whose it is, what it is, sound files too), confetti (a real burst, birthdays and big moments), and family relations
 * (who someone is, whose side, couples) with the family tree that follows from them.
 */
import { untr } from "./untr";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addableProfiles, contents, shareOptions, startDate } from "../src/lib/shareTargets";
import { normalizeShared, skippedMessage, splitShared, summarize } from "../src/lib/sharedMedia";
import { burst, celebrationsToday, seeded, CONFETTI_MS } from "../src/lib/confetti";
import { inferKin, inferSide, kinOf, sideChoices, sideIndex, sideLabel, treeLayout, pairUp, parentRole } from "../src/lib/kinship";
import { kinColumns, kinFromRow } from "../src/lib/syncMerge";
import { planBook, BOOK_SIZES } from "../src/lib/bookPages";
import { buildBookHtml } from "../src/lib/bookHtml";
import { Child, Relative } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => untr(readFileSync(join(__dirname, "..", f), "utf8")); // the code as written in English (see untr.ts)

/* ---------------- sharing in */
const kid = { id: "k", name: "Maya", birth: "2024-01-01", theme: "green", emoji: "👶" } as Child;
const bump = { ...kid, id: "b", expecting: true } as Child;
const pet = { ...kid, id: "p", kind: "pet" } as Child;
const viewer = { ...kid, id: "v", role: "viewer" } as Child;
const pics = [{ kind: "photo" as const }, { kind: "video" as const }];
const voice = [{ kind: "audio" as const }];
const ids = (c: Child, items: { kind: "photo" | "video" | "audio" }[]) => shareOptions(c, items).map((o) => o.id).join();
ok("only the profiles you can add to are offered (not the ones you can only look at)", addableProfiles([kid, viewer, pet]).map((k) => k.id).join() === "k,p");
ok("a child's photos: just the photos, a story, a first, a last, a milestone, growth or health", ids(kid, pics) === "post,story,first,last,milestone,measure,health");
ok("a bump's: just the photos, a bump photo, an ultrasound, a pregnancy milestone or a story", ids(bump, pics) === "post,bump,ultrasound,milestone,story");
ok("a pet's: just the photos, a story, a trick or first, health, or weight", ids(pet, pics) === "post,story,first,health,measure");
ok("a sound file is a voice note first, and never growth or weight (they don't take sound)", ids(kid, voice) === "voice,story,first,last,milestone,health" && ids(pet, voice) === "voice,story,first,health" && !ids(bump, voice).includes("bump"));
ok("photos with a recording: a voice note with the pictures, not “just the photos”", shareOptions(kid, [...pics, ...voice])[0].id === "voice" && !ids(kid, [...pics, ...voice]).includes("post") && contents([...pics, ...voice]).audio === 1);
ok("anything but photo posts opens its own add screen (a voice note is a story with the recording)", shareOptions(kid, voice)[0].entry === "story" && shareOptions(kid, pics).find((o) => o.id === "milestone")!.entry === "milestone" && !shareOptions(kid, pics)[0].entry);
ok("the date starts from the files, never before the profile allows or after today", startDate([{ date: "2025-05-02" }, { date: "2025-04-01" }], "2023-03-01", "2026-10-14") === "2025-04-01" && startDate([{ date: "2001-01-01" }], "2023-03-01", "2026-10-14") === "2023-03-01" && startDate([{}], "2023-03-01", "2026-10-14") === "2026-10-14");
const sh = splitShared([
  { uri: "file:///a.jpg", mime: "image/jpeg", name: "a.jpg", size: 1 },
  { uri: "file:///n.opus", mime: "audio/ogg", name: "PTT-20250301-WA0001.opus", size: 1 },
  { uri: "", mime: "", name: "", size: 0, skipped: "report.pdf" },
  { uri: "", mime: "", name: "", size: 0, text: "At the beach!" },
]);
ok("recordings come in as voice notes (WhatsApp's .opus too), with their date from the name", sh.items[1].kind === "audio" && sh.items[1].date === "2025-03-01" && normalizeShared({ uri: "/x.ogg", mime: "application/ogg", name: "x.ogg", size: 1 }).kind === "audio");
ok("files that can't come in are named, and the caption shared with them is kept", sh.skipped.join() === "report.pdf" && sh.text === "At the beach!" && /Couldn't add report\.pdf\. Only photos, videos and sound recordings/.test(skippedMessage(sh.skipped)) && skippedMessage(["a file", "a file"]) === "2 files couldn't be added. Only photos, videos and sound recordings can be added.");
ok("the summary counts recordings too", summarize(sh.items, (d) => d) === "1 photo · 1 recording · taken 2025-03-01");
const native = read("modules/share-intake/android/src/main/java/expo/modules/shareintake/ShareIntakeModule.kt");
ok("Android: 4D Ages is in the share menu for sound too, and reads files whose app doesn't say what they are", /"mimeType": "audio\/\*"/.test(read("app.json")) && /"opus" to "audio\/ogg"/.test(native) && /mime\.startsWith\("audio\/"\)/.test(native) && /Intent\.EXTRA_TEXT/.test(native));
const sheet = read("src/components/ImportSheet.tsx");
ok("the share screen: whose (only ones you can add to), what is it, then its own add screen with the files and date in it", /<Label>What is it\?<\/Label>/.test(sheet) && /addableProfiles\(allKids\)/.test(sheet) && /setEntrySheet\(\{\s*kind: what\.entry!, media, date: startDate/.test(sheet) && /Nowhere to add these yet/.test(sheet));
ok("…the add screen starts on that date", /useState\(editing\?\.date \?\? prefill\.date \?\? todayISO\(\)\)/.test(read("src/components/EntrySheet.tsx")));

/* ---------------- confetti */
const W = 400, H = 860;
const b1 = burst(W, H, 340, seeded(3));
const at = (p: (typeof b1)[number], k: number) => ({ x: p.x[k], y: p.y[k] });
ok("a dense burst: hundreds of pieces in four shapes and many colours", b1.length === 340 && new Set(b1.map((p) => p.shape)).size === 4 && new Set(b1.map((p) => p.colour)).size >= 8);
ok("it starts in the middle of the screen", b1.every((p) => Math.abs(p.x[0]) < 20 && Math.abs(p.y[0]) < 20));
const early = b1.map((p) => at(p, 4));
const dirs = new Set(early.map((e) => (e.x > 30 ? "r" : e.x < -30 ? "l" : "c") + (e.y > 30 ? "d" : e.y < -30 ? "u" : "c")));
ok("…and goes everywhere: up, down, left and right", ["lu", "ru", "ld", "rd"].every((d) => dirs.has(d)));
const fallen = b1.filter((p) => p.y[p.y.length - 1] > p.y[6]).length;
ok("then gravity takes over: nearly every piece ends lower than it was early on", fallen > b1.length * 0.9);
ok("pieces flutter and turn over as they fall (they flip from face on to edge on)", b1.every((p) => Math.min(...p.flip) < -0.5 && Math.max(...p.flip) > 0.5) && CONFETTI_MS >= 4000);
ok("the middle isn't left empty (slow throws fill it)", early.filter((e) => Math.abs(e.x) < W * 0.2 && Math.abs(e.y) < H * 0.12).length > 20);
const kids = [
  { id: "a", name: "Maya", birth: "2024-10-14" }, { id: "b", name: "Leo", birth: "2026-10-14" }, { id: "c", name: "Rex", birth: "2020-10-14", kind: "pet", gotchaDay: "2021-10-14" },
  { id: "d", name: "Bump", birth: "2026-10-14", expecting: true }, { id: "e", name: "Feb", birth: "2020-02-29" },
];
const today = celebrationsToday(kids, "2026-10-14").map((c) => c.text);
ok("birthdays: a child's, and a pet's real one (in human years), plus a pet's gotcha day", today.includes("Happy 2nd birthday, Maya!") && today.includes("Happy 6th birthday, Rex!") && today.includes("5 years since Rex came home!"));
ok("…not on the day they were born, not for a bump, and 29 February is kept on the 28th", !today.some((x) => x.includes("Leo") || x.includes("Bump")) && celebrationsToday(kids, "2026-02-28").some((c) => c.text === "Happy 6th birthday, Feb!"));
ok("confetti for a milestone, a first, a trick, the baby's arrival and birthdays (once each)", /celebrate\(`\$\{emoji \?\? "⭐"\}/.test(read("src/components/EntrySheet.tsx")) && /kind === "first"\) setTimeout\(\(\) => useStore\.getState\(\)\.celebrate/.test(read("src/components/EntrySheet.tsx")) && /learned “/.test(read("src/components/PetTricks.tsx")) && /s\.markCelebrated\(due\[0\]\.id\)/.test(read("src/components/BirthdayConfetti.tsx")));

/* ---------------- family relations */
ok("who someone is, from the family's own words", inferKin("Savta") === "grandparent" && inferKin("Nanny Sue") === "grandparent" && inferKin("Our nanny") === "carer" && inferKin("Great-grandma") === "great-grandparent"
  && inferKin("Dad's sister") === "aunt-uncle" && inferKin("Uncle Ben") === "aunt-uncle" && inferKin("Cousin") === "cousin" && inferKin("Half-brother") === "half-sibling" && inferKin("Stepdad") === "step-parent"
  && inferKin("Mum's partner") === "step-parent" && inferKin("Mummy") === "parent" && inferKin("Godmother") === "godparent" && inferKin("Our dog") === "pet" && inferKin("Family friend") === "friend" && inferKin("Ima") === "parent" && inferKin("Great-aunt Sue") === "great-aunt-uncle");
ok("…and whose side, when the words say", inferSide("Mum's mum") === "mother" && inferSide("Dad's sister") === "father" && inferSide("Maternal grandma") === "mother" && inferSide("Savta") === undefined && parentRole("Mummy") === "mother" && parentRole("Abba") === "father");
const R = (id: string, name: string, relation: string, extra: Partial<Relative> = {}) => ({ id, name, relation, childIds: ["k"], ...extra }) as Relative;
const fam = [
  R("mum", "Dana", "Mummy"), R("dad", "Alon", "Daddy"),
  R("g1", "Rosa", "Savta", { side: "mum", partnerId: "g2" }), R("g2", "David", "Saba", { side: "mum", partnerId: "g1" }),
  R("g3", "Linda", "Nana", { side: "dad" }), R("g4", "Peter", "Grandpa", { side: "father", partnerId: "g3" }),
  R("a1", "Noa", "Aunt Noa", { side: "mum", partnerId: "a2" }), R("a2", "Ben", "Uncle Ben", { kin: "aunt-uncle", partnerId: "a1" }),
  R("c1", "Lily", "Cousin", { through: "a1" }), R("x", "Ruth", "Godmother"),
];
ok("whose side: by the parent's own entry, by mother/father, from a partner, or from a cousin's parent", sideIndex(fam[2], fam) === 0 && sideIndex(fam[5], fam) === 1 && sideIndex(fam[7], fam) === 0 && sideIndex(fam[8], fam) === 0 && sideIndex(fam[9], fam) === null);
ok("the side choices name the parents (“Dana's side”); without parents, Mum's and Dad's side", sideChoices(fam).map((c) => c.label).join() === "Dana's side,Alon's side" && sideChoices([R("g", "G", "Gran")]).map((c) => c.label).join() === "Mum's side,Dad's side");
ok("two mums work: the first mum's side and the second's", sideIndex(R("g", "G", "Gran", { side: "m2" }), [R("m1", "Ana", "Mama"), R("m2", "Lee", "Mummy")]) === 1);
const L = treeLayout(fam);
const names = (xs: Relative[]) => xs.map((r) => r.name).join();
ok("the tree: each parent's side on its own half, couples side by side, the parents meeting in the middle", names(L.grand.left) === "Rosa,David" && names(L.grand.right) === "Linda,Peter" && names(L.parent.left) === "Noa,Ben,Dana" && names(L.parent.right) === "Alon" && names(L.same.left) === "Lily" && names(L.other) === "Ruth" && L.sides?.join() === "Dana's side,Alon's side");
ok("couples are kept together however they were added", names(pairUp([fam[2], fam[4], fam[3], fam[5]])) === "Rosa,David,Linda,Peter");
ok("the Family list says whose side, and asks where it isn't known", sideLabel(fam[2], fam) === "Dana's side" && sideLabel(R("q", "Q", "Grandma"), fam) === null && sideLabel(fam[0], fam) === "" && /Choose whose side/.test(read("app/family.tsx")));
ok("a sibling who is one of the children is a sibling; a pet is a pet", kinOf(R("s", "Theo", "Brother", { childRef: "t" })) === "sibling" && kinOf(R("p", "Rex", "Our dog", { childRef: "p" })) === "pet");
const html = buildBookHtml({ child: kid, plan: planBook(kid, [], BOOK_SIZES[2], { family: fam }), defs: [], style: "classic", size: BOOK_SIZES[2], image: (u) => u });
ok("the book draws both sides, labelled, with a heart between couples", html.includes("Dana&#39;s side") || (html.includes("Dana's side") && html.includes("Alon's side") && html.includes('class="bond"')));
const tall = planBook(kid, [], BOOK_SIZES[2], { family: [...fam, R("gg", "Esther", "Great-grandma", { side: "mum" })] }).pages.filter((p) => p.kind === "family");
ok("a tall tree (great-grandparents too) leaves godparents and friends for the next page, so it fits", tall[0].kind === "family" && !tall[0].people.some((r) => r.name === "Ruth") && tall.some((p) => p.kind === "family" && p.people.some((r) => r.name === "Ruth")));
ok("how they're related goes to the cloud and comes back", JSON.stringify(kinColumns({ kin: "cousin", side: "mum", partnerId: undefined, through: "a1" })) === JSON.stringify({ kin: "cousin", side: "mum", partner_id: null, through_id: "a1" }) && kinFromRow({ kin: "grandparent", side: "father" }).side === "father"
  && /add column if not exists through_id text/.test(read("supabase/schema.sql")) && /\.\.\.kinColumns\(r\)/.test(read("src/lib/sync.ts")));
ok("the add-a-family-member form asks who they are, whose side, and who they're with", /Who are they to \$?\{childName\}\?/.test(read("src/components/KinshipFields.tsx")) && /Whose side of the family\?/.test(read("src/components/KinshipFields.tsx")) && /Together with \(optional\)/.test(read("src/components/KinshipFields.tsx")) && /<KinshipFields /.test(read("src/components/MemberSheet.tsx")));

console.log(fails ? `${fails} FAILED` : "all share, confetti and family tests passed");
if (fails) process.exit(1);
