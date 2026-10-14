/*
 * The book's family page as a family tree, and family lists without deleted profiles: a child's or pet's sibling entry ("Sister", "Our dog")
 * leaves every family when that profile is deleted, on every phone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { familyRows, generationOf } from "../src/lib/familyTree";
import { mergeRelatives, relativesToPush } from "../src/lib/syncMerge";
import { BOOK_SIZES, planBook } from "../src/lib/bookPages";
import { Relative } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

// ---- who goes on which row
ok("grandparents, in the family's own words (Nana, Savta, Opa, Great-grandma)", ["Nana", "Savta", "Opa", "Great-grandma", "Grandpa Joe"].every((r) => generationOf(r) === "grand"));
ok("the parents' generation: mums, dads, step-parents, aunts and uncles", ["Mummy", "Dad", "Stepmum", "Auntie", "Uncle Ben", "Ima", "Abba"].every((r) => generationOf(r) === "parent"));
ok("their own row: brothers, sisters, cousins, and pets (Our dog)", ["Sister", "Big brother", "Cousin", "Our dog", "Twin"].every((r) => generationOf(r) === "same"));
ok("everyone else (friends, godparents, the nanny) below the tree", ["Family friend", "Godmother", "Nanny Sue's neighbour"].every((r) => generationOf(r) !== "same") && generationOf("Godmother") === "other" && generationOf("Family friend") === "other");
const rows = familyRows([{ relation: "Nana" }, { relation: "Daddy" }, { relation: "Sister" }, { relation: "Friend" }, { relation: "Mummy" }]);
ok("each row keeps the family's own order", rows.parent.length === 2 && rows.grand.length === 1 && rows.same.length === 1 && rows.other.length === 1);

// ---- the book
const fam = [{ id: "f", name: "Tom", relation: "Family friend" }, { id: "g", name: "Rosa", relation: "Nana" }, { id: "m", name: "Yael", relation: "Mummy" }] as Relative[];
const child = { id: "c", name: "Chloe", birth: "2025-04-01", theme: "pink", emoji: "🌸" } as never;
const plan = planBook(child, [], BOOK_SIZES[2], { family: fam });
const tree = plan.pages.find((p) => p.kind === "family" && p.tree);
ok("the family page is a tree, grandparents first", !!tree && tree.kind === "family" && tree.people.map((r) => r.name).join() === "Rosa,Yael,Tom");
const many = Array.from({ length: 20 }, (_, k) => ({ id: `p${k}`, name: `P${k}`, relation: k < 3 ? "Grandma" : "Friend" })) as Relative[];
ok("a big family: the tree holds 18, the rest are listed on the pages after it", planBook(child, [], BOOK_SIZES[2], { family: many }).pages.filter((p) => p.kind === "family").reduce((n, p) => n + (p.kind === "family" ? p.people.length : 0), 0) === 20 && (planBook(child, [], BOOK_SIZES[2], { family: many }).pages.find((p) => p.kind === "family" && p.tree) as { people: unknown[] }).people.length === 18);
const html = read("src/lib/bookHtml.ts");
ok("drawn as a tree: rows joined by lines, the child in the middle of their row (That's me!)", /class="tree"/.test(html) && /\.tree \.stem\{/.test(html) && /relation: "That's me!"/.test(html) && /face\(me, true\)/.test(html));
ok("and a little different in each theme (leaves, soft squares, dotted and dashed lines), kept simple", /\.tree-nature \.node \.face,\.tree-leafscale \.node \.face\{border-radius:60% 0 60% 0\}/.test(html) && /border-style:dotted/.test(html) && /border-style:dashed/.test(html));

// ---- deleted profiles leave every family
const bumpy: Relative = { id: "sib-bumpy", name: "Bumpy", relation: "Brother", childRef: "kid-gone", childIds: ["chloe", "nick"], updatedAt: 100 };
const after = mergeRelatives([bumpy], [{ id: "sib-bumpy", child_id: "chloe", deleted: true, client_ts: 200 }], "chloe");
ok("a deletion from the cloud takes them out of that child's family", after[0].childIds?.join() === "nick");
const gone = mergeRelatives(after, [{ id: "sib-bumpy", child_id: "nick", deleted: true, client_ts: 200 }], "nick");
ok("…and out of the phone once they're in no family (before, deletions were skipped and they stayed)", gone.length === 0);
ok("an older deletion doesn't remove a newer change", mergeRelatives([{ ...bumpy, updatedAt: 300 }], [{ id: "sib-bumpy", deleted: true, client_ts: 200 }], "chloe").length === 1);
ok("the link to their profile goes to the cloud (and comes back)", mergeRelatives([], [{ id: "x", name: "Nick", relation: "Brother", child_ref: "kid-nick", client_ts: 5 }], "chloe")[0].childRef === "kid-nick" && relativesToPush([{ ...bumpy, childIds: ["chloe"] }], "chloe", new Map([["sib-bumpy", 100]]), new Map([["sib-bumpy", null]])).length === 1);
const sync = read("src/lib/sync.ts"), schema = read("supabase/schema.sql");
ok("deleting a profile takes their sibling entry out of every family, on this phone and in the cloud", /if \(plan\.outcome === "deleted"\) await leaveFamilies\(childId\)/.test(sync) && /deleted: true \}\)\)/.test(sync) && /child_ref: r\.childRef \?\? null/.test(sync));
ok("the database does it too, and clears any left over from profiles already gone", /add column if not exists child_ref text/.test(schema) && /where child_ref = p_child and not deleted/.test(schema) && /where r\.child_ref is not null and not r\.deleted and not exists/.test(schema));

console.log(fails ? `${fails} FAILED` : "all family tree tests passed");
if (fails) process.exit(1);
