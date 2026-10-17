/*
 * Building the family tree by hand: joining someone to the person they're dropped next to, moving them to a row, couples taken for granted
 * (and separated), and pets at the end of the child's row. Plus the Family page's long press.
 */
import { untr } from "./untr";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APART, ME, connect, descentGroups, isCouple, linkChoices, placeInRow, separate, treeLayout } from "../src/lib/kinship";
import type { Relative } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => untr(readFileSync(join(__dirname, "..", f), "utf8")); // the code as written in English (see untr.ts)

const p = (id: string, relation: string, extra: Partial<Relative> = {}): Relative => ({ id, name: id, relation, ...extra });
const mum = p("sarah", "Mummy"), dad = p("tom", "Daddy");
const family = [mum, dad, p("rosa", "Grandma", { side: "sarah" }), p("henrik", "Grandpa", { side: "sarah" }), p("priya", "Aunt", { side: "tom" }), p("rex", "Our dog")];
const apply = (fam: Relative[], patches: { id: string; patch: Partial<Relative> }[]) => fam.map((r) => { const ch = patches.filter((x) => x.id === r.id); return ch.reduce((a, c) => ({ ...a, ...c.patch }), r); });

// joining
const ruthMum = connect(p("ruth", "Ruth"), mum, "parent", family)[0].patch;
ok("someone dropped on Mum as her mother or father becomes a grandparent on Mum's side", ruthMum.kin === "grandparent" && ruthMum.side === "sarah");
const bob = connect(p("bob", "Bob"), family[4], "partner", family);
ok("an aunt's partner: an aunt or uncle on her side, and the two are a couple (both ways)", bob[0].patch.kin === "aunt-uncle" && bob[0].patch.side === "tom" && bob[0].patch.partnerId === "priya" && bob.some((x) => x.id === "priya" && x.patch.partnerId === "bob"));
const kid = connect(p("lily", "Lily"), family[4], "child", family)[0].patch;
ok("an aunt's son or daughter is a cousin on her side, through her", kid.kin === "cousin" && kid.side === "tom" && kid.through === "priya");
const gg = connect(p("old", "Old"), family[2], "parent", family)[0].patch;
ok("a grandparent's parent is a great-grandparent on that side, through them", gg.kin === "great-grandparent" && gg.side === "sarah" && gg.through === "rosa");
ok("dropped on the child: a brother or sister only, once there are two parents", JSON.stringify(linkChoices(ME, family)) === JSON.stringify(["sibling"]) && connect(p("sam", "Sam"), ME, "sibling", family)[0].patch.kin === "sibling");
ok("a third parent isn't possible: a parent's new partner is a step-parent", connect(p("new", "New"), mum, "partner", family)[0].patch.kin === "step-parent");
ok("a pet isn't joined to anyone", connect(family[5], mum, "sibling", family).length === 0 && linkChoices(family[5], family).length === 0);

// rows
const moved = placeInRow(family[4], "grand", 1, family)[0].patch;
ok("dropped on an empty part of a row: that generation, on that side", moved.kin === "grandparent" && moved.side === "tom" && placeInRow(family[4], "same", null, family)[0].patch.kin === "sibling");

// couples
ok("two parents are a couple, and so are two grandparents on one side, without being told", isCouple(mum, dad, family) && isCouple(family[2], family[3], family));
const apart = apply(family, separate(family[2], family[3]));
ok("separating them (long press on the ♥) keeps them apart for good", !isCouple(apart[2], apart[3], apart) && apart[2].partnerId === APART);

// pets
const L = treeLayout([...family, p("sam", "Brother", { kin: "sibling" })]);
ok("pets sit at the end of the child's row, never in among the children", L.pets.map((r) => r.id).join() === "rex" && !L.same.mid.some((r) => r.id === "rex"));
ok("the book's tree puts the pets at the far end too", /right: \[\.\.\.L\.same\.right, \.\.\.L\.pets\]/.test(read("src/lib/bookHtml.ts")));

// the screens
const tree = read("app/tree.tsx");
ok("the tree page: press and hold to pick someone up, drop next to a person (how are they joined?) or on a row; tap for the same without dragging", /setTimeout\(async \(\) => \{\s*lifted = true/.test(tree) && /setAsk\(\{ who, target: best\.target \}\)/.test(tree) && /placeInRow\(who, row/.test(tree) && /else if \(!moved\)/.test(tree) && /LINK_WORDS\[l\]/.test(tree));
ok("…the choices read \"Ruth is Dana's… Mother or father, Partner, Brother or sister, Son or daughter\"", /\$\{name\} is \$\{tName\}'s…/.test(tree) && /child: "Son or daughter"/.test(read("src/lib/kinship.ts")));
ok("the Family page links the tree, and a long press makes everyone wiggle with a remove badge", /router\.push\("\/tree"\)/.test(read("app/family.tsx")) && /onLongPress=\{\(\) => \{ if \(!editing\) setEditing\(true\); \}\}/.test(read("app/family.tsx")) && /<Wiggle on=\{editing && !held\}/.test(read("app/family.tsx")) && /isReduceMotionEnabled/.test(read("src/components/Wiggle.tsx")));

// the lines joining parents and children
const lines = descentGroups([...family, p("marco", "Uncle", { kin: "aunt-uncle", side: "sarah" }), p("zoe", "Cousin", { kin: "cousin", through: "priya" }), p("sam", "Brother", { kin: "sibling" })]);
const has = (ps: string[], cs: string[]) => lines.some((g) => ps.every((x) => g.parents.includes(x)) && cs.every((x) => g.children.includes(x)));
ok("lines: the parents to the child and their brothers and sisters; a side's grandparents to that parent and the aunts and uncles; an aunt to her children", has(["sarah", "tom"], [ME, "sam"]) && has(["rosa", "henrik"], ["sarah", "marco"]) && has(["priya"], ["zoe"]));
ok("…drawn from where everyone sits, behind them, joining a couple with a line and hanging their children below it", /descentGroups\(latest\.current\.family\)/.test(read("app/tree.tsx")) && /onLayout=\{drawLines\}/.test(read("app/tree.tsx")) && /a couple joined by a line between them/.test(read("app/tree.tsx")));

// October 2026: the tree keeps its shape on a phone, and friends of the family have a place
const treeSrc = read("app/tree.tsx");
ok("each row is one line that never wraps (a wide tree scrolls sideways, smaller on a phone); each side as wide as its widest row, its people towards the middle", /flexWrap: "nowrap", justifyContent: z\.side === 0 \? "flex-end" : z\.side === 1 \? "flex-start" : "center"/.test(treeSrc) && /<ScrollView ref=\{scroller\} horizontal/.test(treeSrc) && /const NW = narrow \? 72 : 84/.test(treeSrc) && /left: Math\.max\(NW \+ 2 \* PAD, \.\.\.ROWS\.map\(\(r\) => span\(L\[r\]\.left\)\)\)/.test(treeSrc));
const withAunt = [...family, p("dana", "Shahar", { kin: "aunt-uncle", side: "tom" })];
const LA = treeLayout(withAunt);
const tomOnLeft = LA.parent.left.some((r) => r.id === "tom");
const tomsRow = tomOnLeft ? LA.parent.left : LA.parent.right;
ok("a parent's brother or sister sits on the outside of that parent, and the grandparents' line goes to both (an upside-down T)", tomsRow.some((r) => r.id === "dana") && (tomOnLeft ? tomsRow[tomsRow.length - 1].id === "tom" : tomsRow[0].id === "tom") && descentGroups([...withAunt, p("g", "Grandma", { kin: "grandparent", side: "tom" })]).some((g) => g.parents.includes("g") && g.children.includes("tom") && g.children.includes("dana")));
const fr = placeInRow(p("shahar", "Best friend", { kin: "aunt-uncle", side: "tom" }), "other", null, family)[0].patch;
const god = placeInRow(p("gm", "Godmother"), "other", null, family)[0].patch;
ok("Friends of the family: dropped there (or chosen from the tap menu), someone is in the tree with no line to anyone; a godparent stays a godparent", fr.kin === "friend" && fr.side === undefined && god.kin === "godparent" && treeLayout([...family, { ...p("shahar", "Best friend"), ...fr }]).other.some((r) => r.id === "shahar") && /\["other", null, "Friend of the family, not connected"\]/.test(treeSrc) && />Friends of the family</.test(treeSrc));
ok("…and nobody hangs from a friend: a cousin's line only comes from an aunt or uncle", !descentGroups([...family, p("fz", "Friend", { kin: "friend" }), p("kid", "Cousin", { kin: "cousin", through: "fz" })]).some((g) => g.parents.includes("fz")));

console.log(fails ? fails + " FAILED" : "all tree-building tests passed");
if (fails) process.exit(1);
