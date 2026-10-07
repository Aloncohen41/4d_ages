/* Per-child families, and importing one child's family into another's with "tap to leave someone out". */
import { inFamily, familyOf, pinToExistingChildren, importSources, defaultSelection, toggleSelection, addToFamily, setFamilies, looksLikeSomeoneIn } from "../src/lib/family";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const kid = (id: string, name: string): any => ({ id, name, birth: "2025-01-01", theme: "pink", emoji: "🌸" });
const rel = (id: string, name: string, relation: string, childIds?: string[], extra: any = {}): any => ({ id, name, relation, emoji: "🙂", childIds, ...extra });
const maya = kid("maya", "Maya"), leo = kid("leo", "Leo"), zoe = kid("zoe", "Zoe");
const ids = (xs: any[]) => xs.map((x) => x.id).join();

// ---- who is in whose family
const legacy = rel("g", "Grandma Ruth", "Grandma");                 // from before families were per child
ok("someone from before per-child families is in EVERY child's family (nothing disappears on update)", inFamily(legacy, "maya") && inFamily(legacy, "leo") && ids(familyOf([legacy], "zoe")) === "g");
const mom = rel("m", "Dana", "Mom", ["maya"]);
ok("someone pinned to one child is only in that child's family", inFamily(mom, "maya") && !inFamily(mom, "leo") && ids(familyOf([mom, legacy], "leo")) === "g");

// ---- adding a child
const before = [mom, rel("d", "Sam", "Dad", ["maya"]), legacy];
const pinned = pinToExistingChildren(before, ["maya"]);
ok("when a new child is added, the old shared people are pinned to the children who exist, so the newcomer starts EMPTY", JSON.stringify(pinned.find((r) => r.id === "g")?.childIds) === '["maya"]' && familyOf(pinned, "leo").length === 0);
ok("people who were already pinned are left exactly as they were", pinned[0] === before[0] && pinned[1] === before[1]);

// ---- the import window
let rels = pinned;                                                  // Maya's family: Dana (Mom), Sam (Dad), Grandma Ruth
rels = [...rels, rel("b", "Leo", "Brother", ["maya"]), rel("a", "Aunt Bea", "Aunt", ["maya"])];
const src = importSources(rels, [maya, leo], "leo");
ok("for Leo, one source — Maya — offering her whole family", src.length === 1 && src[0].child.id === "maya" && src[0].people.length === 5);
ok("everyone is marked to begin with", defaultSelection(src[0]).length === 5 && ids(src[0].people) === defaultSelection(src[0]).join());
ok("a child never offers to import from themselves", importSources(rels, [maya, leo], "maya").length === 0 || importSources(rels, [maya, leo], "maya").every((s) => s.child.id !== "maya"));
ok("a child with nothing to offer is left out of the choice", importSources(rels, [maya, leo, zoe], "leo").every((s) => s.child.id !== "zoe"));
ok("with two children who have family, both are offered", importSources([...rels, rel("z1", "Zed", "Uncle", ["zoe"])], [maya, leo, zoe], "leo").map((s) => s.child.id).join() === "maya,zoe");

// ---- tap once to leave someone out
let sel = defaultSelection(src[0]);
sel = toggleSelection(sel, "b");                                    // Leo shouldn't import himself as his own brother
ok("one tap on a marked person leaves them out", !sel.includes("b") && sel.length === 4);
ok("another tap marks them again", toggleSelection(sel, "b").includes("b") && toggleSelection(sel, "b").length === 5);
ok("tapping one person never changes anyone else", JSON.stringify(sel.filter((x) => x !== "b")) === JSON.stringify(defaultSelection(src[0]).filter((x) => x !== "b")));

// ---- importing
const after = addToFamily(rels, "leo", sel, 999);
ok("importing adds Leo to the 4 people left marked", ids(familyOf(after, "leo")) === "m,d,g,a");
ok("the person left out is NOT added", !inFamily(after.find((r) => r.id === "b"), "leo"));
ok("Maya's family is untouched (she still has everyone)", familyOf(after, "maya").length === 5);
ok("it is the SAME person, not a copy: Grandma Ruth has one record, now in both families, with the same id", after.filter((r) => r.name === "Grandma Ruth").length === 1 && JSON.stringify(after.find((r) => r.id === "g")?.childIds) === '["maya","leo"]');
ok("so a change to her (name, photo) is seen by both children", familyOf(after.map((r) => (r.id === "g" ? { ...r, name: "Nana Ruth" } : r)), "leo").some((r) => r.name === "Nana Ruth") && familyOf(after.map((r) => (r.id === "g" ? { ...r, name: "Nana Ruth" } : r)), "maya").some((r) => r.name === "Nana Ruth"));
ok("imported people are marked as changed, so cloud sharing sends them", after.find((r) => r.id === "m")?.updatedAt === 999 && after.find((r) => r.id === "b")?.updatedAt === undefined);
ok("importing twice changes nothing more", JSON.stringify(addToFamily(after, "leo", sel, 1000).map((r) => r.childIds)) === JSON.stringify(after.map((r) => r.childIds)));
ok("after importing, there is nothing left to offer except the one left out", (() => { const s = importSources(after, [maya, leo], "leo"); return s.length === 1 && ids(s[0].people) === "b"; })());
ok("importing no one (everyone left out) changes nothing", JSON.stringify(addToFamily(rels, "leo", [], 5)) === JSON.stringify(rels));

// ---- probable duplicates
const leoOwnMom = rel("m2", "Dana", "Mom", ["leo"]);
const dup = importSources([...rels, leoOwnMom], [maya, leo], "leo")[0];
ok("someone who looks like a person Leo already has (same name and relationship) is listed but NOT marked by default", dup.likelyDuplicates.join() === "m" && !defaultSelection(dup).includes("m") && defaultSelection(dup).length === 4);
ok("…names are compared ignoring capitals and spaces", looksLikeSomeoneIn(rel("x", "  DANA ", "Mom"), [rel("y", "dana", "Mom")]) && !looksLikeSomeoneIn(rel("x", "Dana", "Dad"), [rel("y", "Dana", "Mom")]) && !looksLikeSomeoneIn(rel("x", "", "Mom"), [rel("y", "", "Mom")]));
ok("a legacy 'everyone's' person is already in every family, so is never offered", importSources([legacy], [maya, leo], "leo").length === 0);

// ---- choosing whose family someone is in
const edited = setFamilies(after, "d", ["maya", "leo", "zoe"], 5);
ok("“Family of” sets exactly the children chosen (and removes duplicates)", JSON.stringify(edited.find((r) => r.id === "d")?.childIds) === '["maya","leo","zoe"]' && JSON.stringify(setFamilies(after, "d", ["leo", "leo"], 5).find((r) => r.id === "d")?.childIds) === '["leo"]');
ok("…and only that person changes", edited.filter((r) => r.id !== "d").every((r, i) => r === after.filter((x) => x.id !== "d")[i]));
console.log(fails ? `${fails} FAILED` : "all family tests passed");

// ======================= siblings, set up automatically =======================
(() => {
  const { siblingRelation, addSiblingsForNewChild, setUpSiblings, followChild, needsSiblingSetup, SIBLING_RELATIONS } = require("../src/lib/family");
  let n = 0; const mk = () => "sib" + ++n;
  const K = (id: string, name: string, theme: string, emoji = "🙂"): any => ({ id, name, birth: "2025-01-01", theme, emoji });
  const pink = K("maya", "Maya", "pink", "🌸"), blue = K("leo", "Leo", "blue", "🚀"), green = K("zoe", "Zoe", "green", "🌿");
  const who = (rs: any[], kidId: string) => familyOf(rs, kidId).filter((r: any) => r.childRef).map((r: any) => `${r.name}:${r.relation}`).sort().join(",");

  ok("colour decides the word: pink → Sister, blue → Brother, green → Sibling", siblingRelation("pink") === "Sister" && siblingRelation("blue") === "Brother" && siblingRelation("green") === "Sibling");
  ok("the first child has no siblings to set up", addSiblingsForNewChild([], [], pink, 1, mk).length === 0);

  // Maya is here; Leo (blue) arrives
  let rs: any[] = [rel("m", "Dana", "Mom", ["maya"])];
  rs = addSiblingsForNewChild(rs, [pink], blue, 10, mk);
  ok("adding a blue child: he is a BROTHER in the existing child's family…", who(rs, "maya") === "Leo:Brother");
  ok("…and the existing pink child is a SISTER in the new child's family — both set up automatically", who(rs, "leo") === "Maya:Sister");
  ok("nobody is in their own family as a sibling", !familyOf(rs, "leo").some((r: any) => r.childRef === "leo") && !familyOf(rs, "maya").some((r: any) => r.childRef === "maya"));
  ok("each sibling is one person record linked to the child (and their emoji is the child's)", rs.find((r: any) => r.childRef === "leo")?.emoji === "🚀" && rs.find((r: any) => r.childRef === "maya")?.emoji === "🌸" && rs.filter((r: any) => r.childRef).length === 2);
  ok("the parents already in Maya's family are untouched", rs[0].name === "Dana" && JSON.stringify(rs[0].childIds) === '["maya"]');

  // a third child, green
  rs = addSiblingsForNewChild(rs, [pink, blue], green, 20, mk);
  ok("a third (green) child is a SIBLING in both older children's families", who(rs, "maya") === "Leo:Brother,Zoe:Sibling" && who(rs, "leo") === "Maya:Sister,Zoe:Sibling");
  ok("…and both older children are in the new child's family, by their own colour (Maya a Sister, Leo a Brother)", who(rs, "zoe") === "Leo:Brother,Maya:Sister");
  ok("still exactly one sibling record per child (3), shared across the others' families", rs.filter((r: any) => r.childRef).length === 3);

  // it only ever adds
  let kept = rs.map((r: any) => (r.childRef === "leo" ? { ...r, childIds: ["maya"] } : r));   // Leo was taken out of Zoe's family on purpose
  const four = K("kai", "Kai", "blue");
  kept = addSiblingsForNewChild(kept, [pink, blue, green], four, 30, mk);
  ok("adding another child doesn't undo a family someone arranged by hand (Leo stays out of Zoe's)", !familyOf(kept, "zoe").some((r: any) => r.childRef === "leo") && who(kept, "kai") === "Leo:Brother,Maya:Sister,Zoe:Sibling");

  // someone added by hand is adopted, not duplicated
  const byHand = [rel("h", "Leo", "Brother", ["maya"])];
  const adopted = addSiblingsForNewChild(byHand, [pink], blue, 5, mk);
  ok("a 'Leo — Brother' someone already added by hand is recognised and linked to the child, not duplicated", adopted.filter((r: any) => r.name === "Leo").length === 1 && adopted.find((r: any) => r.name === "Leo").childRef === "leo" && who(adopted, "leo") === "Maya:Sister");
  ok("…but a different relationship with the same name is NOT mistaken for the child", addSiblingsForNewChild([rel("u", "Leo", "Uncle", ["maya"])], [pink], blue, 5, mk).filter((r: any) => r.name === "Leo").length === 2);

  // never offered / added to their own family
  const src2 = importSources(rs, [pink, blue, green], "leo");
  ok("importing into Leo never offers Leo himself (Maya's 'Brother Leo')", src2.every((s: any) => s.people.every((p: any) => p.childRef !== "leo")));
  ok("…even if forced, Leo can't be added to his own family", addToFamily(rs, "leo", [rs.find((r: any) => r.childRef === "leo").id], 9).find((r: any) => r.childRef === "leo").childIds.includes("leo") === false);
  ok("“In the family of” can never put a child in their own family", !setFamilies(rs, rs.find((r: any) => r.childRef === "leo").id, ["maya", "leo", "zoe"], 9).find((r: any) => r.childRef === "leo").childIds.includes("leo"));

  // children that existed before this feature
  const old = [rel("m", "Dana", "Mom")];
  ok("with several children and no siblings anywhere, the one-tap setup is offered; with one child, or once set up, it isn't", needsSiblingSetup(old, [pink, blue]) && !needsSiblingSetup(old, [pink]) && !needsSiblingSetup(setUpSiblings(old, [pink, blue], 1, mk), [pink, blue]));
  const made = setUpSiblings(old, [pink, blue, green], 1, mk);
  ok("the setup gives every child a sibling record in everyone else's family", who(made, "maya") === "Leo:Brother,Zoe:Sibling" && who(made, "leo") === "Maya:Sister,Zoe:Sibling" && who(made, "zoe") === "Leo:Brother,Maya:Sister");
  ok("running the setup twice changes nothing more", JSON.stringify(setUpSiblings(made, [pink, blue, green], 2, mk).map((r: any) => [r.childRef, r.childIds])) === JSON.stringify(made.map((r: any) => [r.childRef, r.childIds])));
  ok("the sibling words are all real relationship choices", SIBLING_RELATIONS.every((w: string) => ["Sister", "Brother", "Sibling"].includes(w)));

  // renaming follows the child
  const renamed = followChild(rs, blue, { ...blue, name: "Leopold" }, 40);
  ok("renaming a child renames their sibling record in every family they are in", renamed.find((r: any) => r.childRef === "leo").name === "Leopold" && familyOf(renamed, "maya").some((r: any) => r.name === "Leopold"));
  ok("…but a name changed by hand is left alone", followChild(rs.map((r: any) => (r.childRef === "leo" ? { ...r, name: "Lee-Lee" } : r)), blue, { ...blue, name: "Leopold" }, 40).find((r: any) => r.childRef === "leo").name === "Lee-Lee");
  ok("changing a child's colour pink → blue changes 'Sister' to 'Brother' — unless it had been customised", followChild(rs, pink, { ...pink, theme: "blue" }, 40).find((r: any) => r.childRef === "maya").relation === "Brother" && followChild(rs.map((r: any) => (r.childRef === "maya" ? { ...r, relation: "Cousin" } : r)), pink, { ...pink, theme: "blue" }, 40).find((r: any) => r.childRef === "maya").relation === "Cousin");
  console.log(fails ? `${fails} FAILED` : "all family tests passed (incl. siblings)");
})();
