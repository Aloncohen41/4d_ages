/*
 * First foods: the NHS-based list with the UK's 14 allergens, three tries to "done", reactions, what to try next, the allergen nudges,
 * the doctor's summary, and the tries kept in the account (parents and editors only).
 */
import { untr } from "./untr";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALLERGENS, FOODS, allergenNotes, allergenProgress, foodProgress, inGroup, suggestions, triesGoal } from "../src/lib/foods";
import { existsSync } from "node:fs";
import { foodSummaryHtml, foodSummaryName } from "../src/lib/foodSummaryPage";
import { buildSample } from "../src/lib/sample";
import type { Child, FoodTry } from "../src/lib/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => untr(readFileSync(join(__dirname, "..", f), "utf8")); // the code as written in English (see untr.ts)

ok("the UK's 14 allergens, each with at least one food", ALLERGENS.length === 14 && ALLERGENS.every((a) => FOODS.some((f) => f.allergen === a.id)));
ok("about a hundred foods across the groups, each id once", FOODS.length >= 90 && new Set(FOODS.map((f) => f.id)).size === FOODS.length && ["veg", "fruit", "grains", "protein", "dairy"].every((g) => FOODS.some((f) => f.group === g)));
ok("safety notes where they matter: grapes quartered, nuts never whole, honey not before 1", /quarters/.test(FOODS.find((f) => f.id === "grapes")!.prep!) && /Never whole/.test(FOODS.find((f) => f.id === "peanut")!.prep!) && FOODS.find((f) => f.id === "honey")!.from === 12);

const t = (food: string, date: string, reaction: FoodTry["reaction"] = "none"): FoodTry => ({ id: `${food}-${date}`, childId: "c", food, date, reaction });
const tries = [t("egg", "2026-01-01"), t("egg", "2026-01-04"), t("egg", "2026-01-08"), t("carrot", "2026-01-02"), t("strawberry", "2026-01-03", "mild")];
const p = foodProgress(tries, "c");
ok("three tries with no reaction: done; fewer: trying; any reaction: marked", p.get("egg")!.status === "done" && p.get("carrot")!.status === "trying" && p.get("strawberry")!.status === "reaction" && p.get("pear")!.status === "new");
const a = allergenProgress(p);
ok("an allergen is done when one of its foods is", a.find((x) => x.allergen.id === "egg")!.status === "done" && a.find((x) => x.allergen.id === "peanut")!.status === "new");
const next = suggestions(p, 8);
ok("try next: the ones halfway first, then a new allergen; never a reaction, never honey under 1", next[0].id === "carrot" && next.some((f) => !!f.allergen) && !next.some((f) => f.id === "strawberry") && !suggestions(foodProgress([], "c"), 8, 200).some((f) => f.id === "honey"));
ok("one new allergen at a time: a couple of days' wait after a new one", allergenNotes([t("peanut", "2026-02-10")], "c", "2026-02-11").wait === "Peanut" && !allergenNotes([t("peanut", "2026-02-10")], "c", "2026-02-14").wait);
ok("and keep giving them: done allergens not given for a week are listed", allergenNotes(tries, "c", "2026-01-20").keepUp.includes("Egg"));

const child = { id: "c", name: "Maya", birth: "2025-06-01" } as Child;
const html = foodSummaryHtml(child, tries, "2026-02-01");
ok("the doctor's summary: every allergen with where they are, and each reaction with what happened", ALLERGENS.every((x) => html.includes(x.name.replace(/'/g, "'"))) && /Strawberries/.test(html) && /Mild/.test(html) && /not a medical record/.test(html) && foodSummaryName(child) === "Maya First Foods By 4D-Ages.pdf");

const schema = read("supabase/schema.sql");
ok("kept in the account in their own table, read by parents and editors only (not view-only family), and live", /create table if not exists public\.food_tries/.test(schema) && /member_read on public\.food_tries for select to authenticated using \(public\.is_editor\(child_id\)\)/.test(schema) && /'classics','food_tries','child_members'/.test(schema) && /"food_tries"/.test(read("src/lib/realtime.ts")));
const sync = read("src/lib/sync.ts");
ok("synced like the rest: pulled (not for viewers), merged, sent, deleted, and an older database just waits", /from\("food_tries"\)\.select/.test(sync) && /mergeFoodTries/.test(sync) && /from\("food_tries"\)\.upsert/.test(sync) && /noFoods/.test(sync) && /table: "food_tries"/.test(read("src/lib/store.ts")) && /"foodTries"/.test(read("src/lib/accounts.ts")));
ok("the sample family has Maya's first foods, with one mild reaction", buildSample().foodTries.length > 20 && buildSample().foodTries.some((x) => x.reaction === "mild"));
ok("where it shows: Foods & allergens, the third section of Milestones (beside Milestones and Firsts & lasts), its own page, Food tried in the + menus, reactions in Health", /label: "Foods & allergens"/.test(read("app/(tabs)/milestones.tsx")) && /<FirstFoodsView \/>/.test(read("app/(tabs)/milestones.tsx")) && !/FirstFoodsCard child/.test(read("app/(tabs)/growth.tsx")) && /<FirstFoodsView startMeal=/.test(read("app/foods.tsx")) && /<Stack\.Screen name="foods" \/>/.test(read("app/_layout.tsx")) && /a === "food" \? "Food tried"/.test(read("src/components/Fab.tsx")) && /<FoodReactions childId=/.test(read("app/health.tsx")));
ok("a serious reaction says to call 999, and First foods points to the NHS and isn't medical advice", /Call 999/.test(read("src/components/FirstFoods.tsx")) && /not medical advice/.test(read("src/components/FirstFoodsView.tsx")) && /NHS_WEANING_URL/.test(read("src/components/FirstFoodsView.tsx")));

// October 2026: real photos, the family's own number of tries, and foods in more than one group
const pictures = readFileSync(join(__dirname, "..", "src/lib/foodPictures.ts"), "utf8"); // (read as words: the photos themselves can't be loaded here)
const sources = JSON.parse(readFileSync(join(__dirname, "..", "assets/foods/sources.json"), "utf8")) as Record<string, { licence: string; source: string }>;
ok("every food has a real photo (no emoji), and each new one says where it came from and its licence", FOODS.every((f) => pictures.includes(`"${f.id}": require("../../assets/foods/`) || pictures.includes(`"${f.id}": require("../../assets/fruit/`)) && Object.entries(sources).every(([id, s]) => existsSync(join(__dirname, "..", "assets/foods/" + id + ".jpg")) && /public domain|cc0|^pd|cc by/i.test(s.licence) && /^https:\/\/commons\.wikimedia\.org\//.test(s.source)) && /<FoodPicture food=\{p\.food\} size=\{64\} \/>/.test(read("src/components/FirstFoods.tsx")));
const licences = readFileSync(join(__dirname, "..", "public/licences/index.html"), "utf8");
ok("…and the photos that need a credit are credited on the Licences page", Object.values(sources).filter((s) => /cc by/i.test(s.licence)).every((s) => licences.includes(s.source)));
const goal4 = foodProgress(tries, "c", 4);
ok("tries to done: 3, 4 or 5, chosen by the family (3 when not set); changing it keeps every try, a food just moves between Trying and Done", goal4.get("egg")!.status === "trying" && goal4.get("egg")!.tries === 3 && foodProgress(tries, "c", 3).get("egg")!.status === "done" && triesGoal({}) === 3 && triesGoal({ foodGoal: 5 }) === 5 && triesGoal({ foodGoal: 9 }) === 3);
ok("…a slider at the top of Foods & allergens, saved with the child (and synced)", /<AppSlider label="Tries before a food is done"/.test(read("src/components/FirstFoodsView.tsx")) && /updateChild\(child\.id, \{ foodGoal: n \}\)/.test(read("src/components/FirstFoodsView.tsx")) && /food_goal: child\.foodGoal \?\? null/.test(read("src/lib/sync.ts")) && /add column if not exists food_goal/.test(read("supabase/schema.sql")));
const food = (id: string) => FOODS.find((f) => f.id === id)!;
ok("Dairy has the milk, cheese, yoghurt and butter (allergens show in their own group too); a food can be in two groups and is the same food in both", ["cows-milk", "cheese", "yoghurt", "butter", "mozzarella"].every((id) => inGroup(food(id), "dairy") && inGroup(food(id), "allergens")) && inGroup(food("edamame"), "veg") && inGroup(food("edamame"), "protein") && /inGroup\(p\.food, group\)/.test(read("src/components/FirstFoodsView.tsx")));

console.log(fails ? fails + " FAILED" : "all first foods tests passed");
if (fails) process.exit(1);
