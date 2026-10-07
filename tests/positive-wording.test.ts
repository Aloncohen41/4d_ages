/*
 * Milestones must feel like a celebration, never a score. This reads the screens' own source and checks that nothing
 * is shown "out of" a total and that no discouraging words appear in what a parent sees.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const root = join(__dirname, "..");
const files = ["src/components/MilestoneChecklist.tsx", "src/components/ReinforceSheet.tsx", "app/(tabs)/milestones.tsx", "src/lib/development.ts", "src/lib/milestonePlan.ts", "src/components/RemindersCard.tsx"];
const src = Object.fromEntries(files.map((f) => [f, readFileSync(join(root, f), "utf8")]));

// the text a parent can actually see: string literals and on-screen JSX text (never variable names or comments)
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const shownText = (code: string): string[] => {
  const c = stripComments(code), out: string[] = [];
  for (const m of c.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  for (const m of c.matchAll(/>([^<>{}\n][^<>{}]*)</g)) out.push(m[1]);
  return out.map((x) => x.trim()).filter(Boolean);
};
const BAD = /\d\s*out of\b|\bout of\s*[\d{$]|\bbehind\b|\bdelay|\blate\b|\bfail|\bmissed\b|\boverdue\b|\bshould have\b|\bcatch up\b|\bworry|\bconcerning\b|\blagging\b|\bnot reaching\b/i;
for (const f of files) {
  const hits = shownText(src[f]).filter((x) => BAD.test(x));
  ok(`${f}: no "out of", "behind", "late", "delayed"… in what's shown` + (hits.length ? ` — found: ${hits[0].slice(0, 80)}` : ""), hits.length === 0);
}
ok("the guard really catches a counter (\"5 out of 15\") but not an ordinary phrase (\"out of reach\")", BAD.test("5 out of 15 micro-milestones achieved for this age") && BAD.test("out of 10") && !BAD.test("with a toy just out of reach") && BAD.test("running behind") && BAD.test("a delayed milestone"));
ok("the text checker really sees on-screen text (so a pass means something)", shownText(src["src/components/ReinforceSheet.tsx"]).some((x) => x.includes("Try this together")) && shownText(src["src/lib/milestonePlan.ts"]).some((x) => x.includes("Wow")));
ok("nothing is divided by a total: no `/{…length}` or `of {…}` counters in the milestone screens", !/\{[^}]*\}\s*\/\s*\{[^}]*\.length/.test(src["src/components/MilestoneChecklist.tsx"] + src["app/(tabs)/milestones.tsx"] + src["src/components/ReinforceSheet.tsx"]) && !/\} of \{/.test(src["src/components/MilestoneChecklist.tsx"] + src["src/components/ReinforceSheet.tsx"]));
ok("the old 'N more to look out for' line is gone", !/more to look out for/.test(src["app/(tabs)/milestones.tsx"] + src["src/components/MilestoneChecklist.tsx"]));
ok("counts are worded by the shared helpers (celebration / reachedText), so small numbers are celebrated", /celebration\(/.test(src["src/components/MilestoneChecklist.tsx"]) && /reachedText/.test(src["src/components/ReinforceSheet.tsx"]));
ok("the date prompt is only for much-earlier milestones (never for the current stage)", /defaultMilestoneDate/.test(src["src/components/MilestoneChecklist.tsx"]) && /if \(d\.ask\)/.test(src["src/components/MilestoneChecklist.tsx"]));
console.log(fails ? `${fails} FAILED` : "all positive-wording tests passed");
