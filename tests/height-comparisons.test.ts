import { FUN_REFS, funComparisons, funReference, nextUp, frameRefs } from "../src/lib/growth";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
ok("list is sorted and has all six categories", FUN_REFS.every((x, i) => i === 0 || x.cm >= FUN_REFS[i - 1].cm) && new Set(FUN_REFS.map((x) => x.category)).size === 6);
for (const [label, cm] of [["newborn", 50], ["3 months", 61], ["6 months", 67], ["9 months", 72], ["1 year", 76], ["18 months", 82], ["2 years", 88], ["3 years", 97], ["5 years", 110]] as [string, number][]) {
  const c = funComparisons(cm, 3);
  console.log(`  ${label.padEnd(10)} ${cm} cm → ${c.map((x) => `${x.ref.emoji} ${x.phrase.toLowerCase()} ${x.ref.name}`).join(" | ")}`);
}
const c50 = funComparisons(50, 3);
ok("comparisons are never taller than the child", [40, 50, 61, 72, 88, 110, 130].every((cm) => funComparisons(cm, 6).every((x) => x.ref.cm <= cm)));
ok("different categories in one set", [61, 88, 110].every((cm) => { const s = funComparisons(cm, 3); return new Set(s.map((x) => x.ref.category)).size === s.length; }));
ok("nearest first", [61, 88, 110].every((cm) => { const s = funComparisons(cm, 3); return s.every((x, i) => i === 0 || s[i - 1].ref.cm >= x.ref.cm); }));
ok("'more comparisons' rotates to new ones", JSON.stringify(funComparisons(97, 3, 0).map((x) => x.ref.name)) !== JSON.stringify(funComparisons(97, 3, 1).map((x) => x.ref.name)));
ok("phrase: about as tall vs taller than", funComparisons(66, 1)[0].phrase === "About as tall as" && funComparisons(75, 6).some((x) => x.phrase === "Taller than"));
ok("very small → nothing; tall → still works", funComparisons(15).length === 0 && funComparisons(160).length === 3);
ok("next up", nextUp(66)!.ref.name === "a rocking horse" && Math.abs(nextUp(66)!.gap - 2) < 1e-9 && nextUp(150) === null);
ok("tallest single reference", funReference(66)!.name === "a baguette" && funReference(10) === null);
const fr = frameRefs(100, 380, 30);
ok("door-frame objects thinned out (no overlaps)", fr.length > 5 && fr.every((x, i) => i === 0 || (x.cm - fr[i - 1].cm) / 100 * 380 >= 29.9));
console.log(fails ? `${fails} FAILED` : "all comparison tests passed");
