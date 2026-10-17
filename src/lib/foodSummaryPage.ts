/*
 * The First foods summary for the doctor or health visitor, as a page (see foodSummary.ts for sharing it). Pure, for tests.
 */
import type { Child, FoodTry } from "./types";
import { ALLERGENS, allergenFoods, allergenProgress, foodById, foodProgress, triesGoal } from "./foods";
import { formatDate } from "./date";
import { cleanPart, FILE_BRAND } from "./fileNames";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The page, as HTML (pure, for tests). */
export function foodSummaryHtml(child: Child, tries: FoodTry[], today: string): string {
  const mine = tries.filter((x) => x.childId === child.id);
  const progress = foodProgress(mine, child.id, triesGoal(child));
  const allergens = allergenProgress(progress);
  const first = (a: string) => mine.filter((x) => foodById(x.food)?.allergen === a).map((x) => x.date).sort()[0];
  const reactions = mine.filter((x) => x.reaction && x.reaction !== "none").sort((a, b) => a.date.localeCompare(b.date));
  const tried = [...progress.values()].filter((p) => p.tries).length;
  const words = { new: "Not given yet", trying: "Started", done: "Given 3+ times, no reaction", reaction: "Reaction" } as const;
  const rows = allergens.map((a) => {
    const foods = allergenFoods(a.allergen.id).filter((f) => progress.get(f.id)?.tries).map((f) => f.name).join(", ");
    return `<tr${a.status === "reaction" ? ' class="bad"' : ""}><td>${esc(a.allergen.name)}</td><td>${words[a.status]}</td><td>${first(a.allergen.id) ? formatDate(first(a.allergen.id)!) : ""}</td><td>${a.lastGiven ? formatDate(a.lastGiven) : ""}</td><td>${esc(foods)}</td></tr>`;
  }).join("");
  const reactionRows = reactions.map((x) => `<tr class="${x.reaction === "serious" ? "bad" : ""}"><td>${formatDate(x.date)}</td><td>${esc(foodById(x.food)?.name ?? x.food)}</td><td>${x.reaction === "serious" ? "Serious" : "Mild"}</td><td>${esc(x.note ?? "")}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(child.name)} First foods summary</title><style>
body{font:12px/1.45 -apple-system,"Segoe UI",Roboto,sans-serif;color:#222;margin:28px}
h1{font-size:20px;margin:0}h2{font-size:14px;margin:20px 0 6px}.muted{color:#666}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #ddd;vertical-align:top}th{background:#f4f0f1}
tr.bad td{color:#a3221a;font-weight:600}
</style></head><body>
<h1>${esc(child.name)}: first foods and allergens</h1>
<p class="muted">Born ${formatDate(child.birth)} · made on ${formatDate(today)} with 4D Ages · ${tried} foods tried</p>
<h2>The 14 allergens</h2>
<table><thead><tr><th>Allergen</th><th>Where they are</th><th>First given</th><th>Last given</th><th>Foods</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Reactions</h2>
${reactions.length ? `<table><thead><tr><th>Date</th><th>Food</th><th>How bad</th><th>What happened</th></tr></thead><tbody>${reactionRows}</tbody></table>` : `<p>None noted.</p>`}
<p class="muted" style="margin-top:24px">Written down by the family; not a medical record. Allergens follow the UK's 14 major allergens (${ALLERGENS.length}).</p>
</body></html>`;
}

/** "Maya First Foods By 4D-Ages.pdf" */
export const foodSummaryName = (child: Child) => `${cleanPart(child.name) || "Baby"} First Foods By ${FILE_BRAND}.pdf`;

