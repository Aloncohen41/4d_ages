/*
 * Per-child families, end to end on the REAL store: adding a second child starts them with an empty family; importing brings people over as
 * the same person; someone can be left out; and cloud sharing follows the same rules. (Phone-only libraries are stood in for, just for this test.)
 */
const Module = require("module");
const path = require("node:path");
const { readFileSync } = require("node:fs");
const stub = (f: string) => path.join(__dirname, "stubs", f);
const MAP: Record<string, string> = {
  zustand: stub("zustand.js"), "zustand/middleware": stub("zustand-middleware.js"), "@react-native-async-storage/async-storage": stub("async-storage.js"),
  "expo-file-system": stub("file-system.js"), "expo-image-picker": stub("empty.js"), expo: stub("empty.js"),
};
const orig = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) { return MAP[request] ?? orig.call(this, request, ...rest); };

const { useStore } = require("../src/lib/store");
const { familyOf, importSources, defaultSelection, toggleSelection, inFamily } = require("../src/lib/family");
const { mergeRelatives, relativesToPush } = require("../src/lib/syncMerge");
const { personTag } = require("../src/lib/tags");
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const st = () => useStore.getState();
const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const child = (id: string, name: string, theme = "pink", emoji = "🌸") => ({ id, name, birth: "2025-01-01", theme, emoji });
const names = (kidId: string) => familyOf(st().relatives, kidId).map((r: any) => r.name).sort().join(",");

// ---------- one child, a family built before families were per child
useStore.setState({ kids: [], relatives: [], memories: [], tags: [], activeId: "" });
st().addChild(child("maya", "Maya"));
ok("the first child has no siblings to add", st().relatives.length === 0);
useStore.setState({ relatives: [
  { id: "m", name: "Dana", relation: "Mom", emoji: "👩" }, { id: "d", name: "Sam", relation: "Dad", emoji: "👨" },
  { id: "g", name: "Ruth", relation: "Grandma", emoji: "👵", customLabel: "Nana" }, { id: "b", name: "Leo", relation: "Brother", emoji: "👦" }, // added by hand, before Leo became a child here
] });
ok("with one child, the existing family is hers (nothing changed for her)", names("maya") === "Dana,Leo,Ruth,Sam");

// ---------- the second child, blue → a Brother; pink Maya → a Sister
st().addChild(child("leo", "Leo", "blue", "🚀"));
ok("adding a second child: Maya keeps her whole family", names("maya") === "Dana,Leo,Ruth,Sam");
ok("…the new (blue) child is her BROTHER — the 'Leo — Brother' she already had is recognised, not duplicated", st().relatives.filter((r: any) => r.name === "Leo").length === 1 && st().relatives.find((r: any) => r.name === "Leo").childRef === "leo");
ok("…and Maya (pink) is automatically a SISTER in the new child's family: nothing else yet", names("leo") === "Maya" && familyOf(st().relatives, "leo")[0].relation === "Sister" && familyOf(st().relatives, "leo")[0].childRef === "maya");
ok("the old shared people were pinned to the child who existed", ["m", "d", "g"].every((id) => JSON.stringify(st().relatives.find((r: any) => r.id === id).childIds) === '["maya"]') && st().relatives.find((r: any) => r.id === "g").customLabel === "Nana");

// ---------- the window: everyone marked, tap once to leave someone out, approve
const src = importSources(st().relatives, st().kids, "leo");
ok("the import window offers Maya's three PARENTS and grandmother — not Leo himself (her Brother), and not Maya (already there)", src.length === 1 && src[0].child.id === "maya" && src[0].people.map((p: any) => p.name).sort().join() === "Dana,Ruth,Sam");
let marked = defaultSelection(src[0]);
ok("everyone starts marked", marked.length === 3);
marked = toggleSelection(marked, "d");   // Sam is Maya's dad only
ok("one tap leaves Sam out", marked.length === 2 && !marked.includes("d"));
st().importFamily("leo", marked);
ok("approving brings the two marked people in: Leo's family is Maya (sister), Dana and Ruth", names("leo") === "Dana,Maya,Ruth");
ok("Sam was left out, and is still only in Maya's family", !inFamily(st().relatives.find((r: any) => r.id === "d"), "leo") && names("maya") === "Dana,Leo,Ruth,Sam");
ok("nothing was copied: 6 people in total (4 + one sibling record per child), the shared ones now in both families", st().relatives.length === 5 + 0 && JSON.stringify(st().relatives.find((r: any) => r.id === "g").childIds) === '["maya","leo"]');
ok("changing Ruth once changes her for BOTH children (same person)", (st().updateRelative("g", { name: "Ruth B." }), names("leo").includes("Ruth B.") && names("maya").includes("Ruth B.")));
ok("the imported people are marked as changed (so sharing sends them)", (st().relatives.find((r: any) => r.id === "m").updatedAt ?? 0) > 0);

// ---------- renaming a child renames their sibling record everywhere
st().updateChild("leo", { name: "Leopold" });
ok("renaming Leo renames him in Maya's family too", names("maya").includes("Leopold") && !names("maya").includes("Leo,") && st().relatives.filter((r: any) => r.childRef === "leo").length === 1);
ok("changing Maya's colour pink → blue turns her 'Sister' into 'Brother' in Leo's family", (st().updateChild("maya", { theme: "blue" }), familyOf(st().relatives, "leo").find((r: any) => r.childRef === "maya").relation === "Brother"));
st().updateChild("maya", { theme: "pink" });

// ---------- tags mean the same person for both children
st().upsertTags([personTag(st().relatives.find((r: any) => r.id === "g"))]); // the tag picker registers the tag in the central list, as it does in the app
st().saveMemory({ childId: "maya", type: "photo", description: "Day out", date: "2026-03-01", media: [], tagIds: [personTag(st().relatives.find((r: any) => r.id === "g")).id], emoji: "📷" });
st().saveMemory({ childId: "leo", type: "photo", description: "Park", date: "2026-03-02", media: [], tagIds: [personTag(st().relatives.find((r: any) => r.id === "g")).id], emoji: "📷" });
ok("a memory of either child can tag the same Ruth", st().memories.filter((m: any) => m.tagIds.includes("tag-person-g")).length === 2);

// ---------- choosing whose family
st().setRelativeChildren("d", ["leo"]);
ok("“In the family of” can move someone (Sam now only Leo's)", !names("maya").includes("Sam") && names("leo").includes("Sam"));
st().removeRelative("g");
ok("removing a person removes them from every family and takes their tag off every memory", !names("leo").includes("Ruth") && !names("maya").includes("Ruth") && st().memories.every((m: any) => !m.tagIds.includes("tag-person-g")));

// ---------- a third child, green → a Sibling
st().addChild(child("zoe", "Zoe", "green", "🌿"));
ok("a third (green) child is a SIBLING in both older children's families", names("maya").includes("Zoe") && names("leo").includes("Zoe") && st().relatives.find((r: any) => r.childRef === "zoe").relation === "Sibling");
ok("…and both older children are in her family by their own colour (Maya a Sister, Leopold a Brother) — and nobody else yet", names("zoe") === "Leopold,Maya" && familyOf(st().relatives, "zoe").map((r: any) => r.relation).sort().join() === "Brother,Sister");
ok("she can import the grown-ups from either sibling", importSources(st().relatives, st().kids, "zoe").map((x: any) => x.child.id).sort().join() === "leo,maya");
ok("each child has exactly one sibling record (3 in all) however many children there are", st().relatives.filter((r: any) => r.childRef).length === 3);
st().importFamily("zoe", [st().relatives.find((r: any) => r.childRef === "leo").id]);
ok("a sibling can never be put in their own family, even by importing", !inFamily(st().relatives.find((r: any) => r.childRef === "zoe"), "zoe"));

// ---------- children who already existed: one-tap setup
useStore.setState({ kids: [child("a", "Ava"), child("b", "Ben", "blue")], relatives: [{ id: "p", name: "Pat", relation: "Mom", emoji: "👩" }], memories: [], tags: [] });
st().setupSiblings();
ok("the one-tap setup makes Ava a Sister in Ben's family and Ben a Brother in Ava's, leaving Pat shared", names("a") === "Ben,Pat" && names("b") === "Ava,Pat");

// ---------- cloud sharing follows the same rules
const rows = [{ id: "p1", name: "Pat", relation: "Aunt", emoji: "👩‍🦰", client_ts: 50 }, { id: "m", name: "Dana", relation: "Mom", emoji: "👩", client_ts: 1 }];
const merged = mergeRelatives([{ id: "m", name: "Dana", relation: "Mom", emoji: "👩", childIds: ["maya"], updatedAt: 10 }], rows, "leo");
ok("pulling for a child: a NEW person joins that child's family", JSON.stringify(merged.find((r: any) => r.id === "p1").childIds) === '["leo"]');
ok("pulling for a child: an EXISTING person gains that child (even if the cloud copy is older)", JSON.stringify(merged.find((r: any) => r.id === "m").childIds) === '["maya","leo"]' && merged.find((r: any) => r.id === "m").updatedAt === 10);
ok("someone from before families were per child (no list) is left alone — already in everyone's", mergeRelatives([{ id: "m", name: "Dana", relation: "Mom", emoji: "👩" }], rows, "leo").find((r: any) => r.id === "m").childIds === undefined);
ok("old behaviour is kept when no child is given", mergeRelatives([], rows).find((r: any) => r.id === "p1").childIds === undefined);
const all = [{ id: "a", name: "A", relation: "Mom", emoji: "x", childIds: ["maya"] }, { id: "b2", name: "B", relation: "Dad", emoji: "x", childIds: ["leo"] }, { id: "c", name: "C", relation: "Aunt", emoji: "x" }, { id: "d2", name: "D", relation: "Uncle", emoji: "x", childIds: ["maya", "leo"], updatedAt: 9 }];
ok("pushing for a child sends only that child's family (never the other child's people)", relativesToPush(all, "maya", new Map()).map((r: any) => r.id).join() === "a,c,d2");
ok("…and only what the cloud doesn't have yet or has older", relativesToPush(all, "maya", new Map([["a", 0], ["c", 0], ["d2", 5]])).map((r: any) => r.id).join() === "d2" && relativesToPush(all, "maya", new Map([["a", 0], ["c", 0], ["d2", 9]])).length === 0);

// ---------- the wiring
const fam = read("app/(tabs)/family.tsx"), sheet = read("src/components/FamilyImportSheet.tsx"), member = read("src/components/MemberSheet.tsx"), picker = read("src/components/TagPicker.tsx"), store = read("src/lib/store.ts"), sync = read("src/lib/sync.ts");
ok("the Family tab shows only the selected child's family", /familyOf\(relatives, child\.id\)/.test(fam) && /family\.map\(\(r\) =>/.test(fam) && !/relatives\.map/.test(fam));
ok("the Family tab offers “Import family from …” whenever another child has people to bring, and opens the window", /Import family from \{importFrom\}/.test(fam) && /<FamilyImportSheet visible=\{importing\}/.test(fam) && /sources\.length \? \(/.test(fam));
ok("the import window marks everyone to begin with, toggles one person per tap, and approves with a button", /setMarked\(defaultSelection\(src\)\)/.test(sheet) && /toggleSelection\(m, p\.id\)/.test(sheet) && /importFamily\(child\.id, marked\)/.test(sheet) && /accessibilityRole="checkbox"/.test(sheet) && /Mark everyone/.test(sheet) && /Clear all/.test(sheet));
ok("with several other children it lets you choose which child to import from", /sources\.length > 1/.test(sheet) && /setChosen\(x\.child\.id\)/.test(sheet));
ok("new people join the child you are looking at; “In the family of” appears only when there is more than one child they could be in", /childIds: families/.test(member) && /\.length > 1/.test(member) && /In the family of/.test(member) && /id !== existing\?\.childRef/.test(member));
ok("the tag picker lists only this child's family, and new people it creates join it", /family\.map\(\(r\) =>/.test(picker) && /childIds: active \? \[active\.id\] : undefined/.test(picker));
ok("adding a child pins the old family to the existing children (only when there are some), then adds the siblings", /s\.kids\.length \? pinToExistingChildren\(/.test(store) && /addSiblingsForNewChild\(pinned, s\.kids, child/.test(store));
ok("renaming or recolouring a child updates their sibling record", /followChild\(s\.relatives, before, after/.test(store));
ok("the Family tab offers a one-tap “Set up siblings” only when there are several children and none set up", /needsSiblingSetup\(relatives, kids\)/.test(fam) && /Set up siblings/.test(fam));
ok("cloud sharing pulls into, and pushes from, the right child's family", /mergeRelatives\(s\.relatives, rRows, childId\)/.test(sync) && /relativesToPush\(s\.relatives, childId, known\)/.test(sync));
console.log(fails ? `${fails} FAILED` : "all family-flow tests passed");
