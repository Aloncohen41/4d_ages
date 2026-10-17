/*
 * Foods and allergens: the foods a baby tries as they start solids, and the 14 major allergens, following the NHS's weaning advice (the same
 * list for everyone). Each food is tried a few times (three by default, or four or five if the family chooses, with no reaction, counts as
 * done); a reaction is noted with the try. A food can be in more than one group (cheese is Dairy and an allergen; edamame is a vegetable and
 * a protein) and is the same food in each, with the same tries. Nothing here is medical advice: the app shows the NHS's guidance and points
 * to it. Pure, for tests.
 */
import type { FoodTry } from "./types";

import { tr, withWords } from "./i18n";
/** The UK's 14 major allergens (the ones food labels must show). */
export type AllergenId =
  | "milk" | "egg" | "gluten" | "peanut" | "tree-nuts" | "sesame" | "soya" | "fish" | "crustaceans" | "molluscs"
  | "celery" | "mustard" | "lupin" | "sulphites";

export const ALLERGENS: { id: AllergenId; name: string; emoji: string }[] = [
  { id: "milk", get name() { return tr("Cows' milk"); }, emoji: "🥛" },
  { id: "egg", get name() { return tr("Egg"); }, emoji: "🥚" },
  { id: "gluten", get name() { return tr("Gluten (wheat, barley, rye, oats)"); }, emoji: "🌾" },
  { id: "peanut", get name() { return tr("Peanut"); }, emoji: "🥜" },
  { id: "tree-nuts", get name() { return tr("Tree nuts"); }, emoji: "🌰" },
  { id: "sesame", get name() { return tr("Sesame"); }, emoji: "🫘" },
  { id: "soya", get name() { return tr("Soya"); }, emoji: "🫛" },
  { id: "fish", get name() { return tr("Fish"); }, emoji: "🐟" },
  { id: "crustaceans", get name() { return tr("Shellfish (prawns, crab)"); }, emoji: "🦐" },
  { id: "molluscs", get name() { return tr("Molluscs (mussels, squid)"); }, emoji: "🦪" },
  { id: "celery", get name() { return tr("Celery"); }, emoji: "🥬" },
  { id: "mustard", get name() { return tr("Mustard"); }, emoji: "🟡" },
  { id: "lupin", get name() { return tr("Lupin"); }, emoji: "🌼" },
  { id: "sulphites", get name() { return tr("Sulphites (dried fruit)"); }, emoji: "🍇" },
];

export type FoodGroup = "allergens" | "veg" | "fruit" | "grains" | "protein" | "dairy" | "extras";
export const FOOD_GROUPS: { id: FoodGroup; label: string }[] = [
  { id: "allergens", get label() { return tr("Allergens"); } },
  { id: "veg", get label() { return tr("Vegetables"); } },
  { id: "fruit", get label() { return tr("Fruit"); } },
  { id: "grains", get label() { return tr("Grains"); } },
  { id: "protein", get label() { return tr("Protein"); } },
  { id: "dairy", get label() { return tr("Dairy"); } },
  { id: "extras", get label() { return tr("Herbs and more"); } },
];

export interface Food {
  id: string;
  name: string;
  emoji: string;
  group: Exclude<FoodGroup, "allergens">;
  /** the other groups it's shown in too (the same food, the same tries) */
  also?: Exclude<FoodGroup, "allergens">[];
  /** one of the 14 allergens it is (or contains) */
  allergen?: AllergenId;
  /** how to give it safely at the start (NHS) */
  prep?: string;
  /** not before this age, in months (honey: 12) */
  from?: number;
}

const f = (id: string, name: string, emoji: string, group: Food["group"], prep?: string, allergen?: AllergenId, from?: number): Food => withWords<Food>({ id, name, emoji, group, ...(prep ? { prep } : {}), ...(allergen ? { allergen } : {}), ...(from ? { from } : {}) }, ["name", "prep"]);

export const FOODS: Food[] = [
  // vegetables: the NHS suggests starting with vegetables, including bitter ones
  f("broccoli", "Broccoli", "🥦", "veg", "Steamed until soft, as a mash or a soft floret to hold."),
  f("cauliflower", "Cauliflower", "🥦", "veg", "Steamed until soft."),
  f("carrot", "Carrot", "🥕", "veg", "Cooked until soft; never raw sticks at first."),
  f("parsnip", "Parsnip", "🥕", "veg", "Cooked until soft."),
  f("sweet-potato", "Sweet potato", "🍠", "veg", "Mashed, or soft wedges to hold."),
  f("potato", "Potato", "🥔", "veg", "Mashed without salt."),
  f("squash", "Butternut squash", "🎃", "veg", "Roasted or steamed until soft."),
  f("courgette", "Courgette", "🥒", "veg", "Steamed, as a puree or soft sticks."),
  f("peas", "Peas", "🫛", "veg", "Mashed or squashed flat."),
  f("green-beans", "Green beans", "🫛", "veg", "Steamed until very soft."),
  f("spinach", "Spinach", "🥬", "veg", "Cooked and mixed into other foods."),
  f("cabbage", "Cabbage", "🥬", "veg", "Cooked until soft."),
  f("kale", "Kale", "🥬", "veg", "Cooked and finely chopped."),
  f("cucumber", "Cucumber", "🥒", "veg", "Peeled sticks, big enough to hold."),
  f("pepper", "Pepper", "🫑", "veg", "Roasted until soft."),
  f("tomato", "Tomato", "🍅", "veg", "Cherry tomatoes cut in quarters lengthways."),
  f("aubergine", "Aubergine", "🍆", "veg", "Roasted until soft."),
  f("sweetcorn", "Sweetcorn", "🌽", "veg", "Squashed, or blended."),
  f("beetroot", "Beetroot", "🟣", "veg", "Cooked until soft."),
  f("swede", "Swede", "🟠", "veg", "Mashed."),
  f("mushroom", "Mushroom", "🍄", "veg", "Cooked and finely chopped."),
  f("asparagus", "Asparagus", "🌱", "veg", "Steamed until soft."),
  f("leek", "Leek", "🧅", "veg", "Cooked into other foods."),
  f("onion", "Onion", "🧅", "veg", "Cooked into other foods."),
  f("sprouts", "Brussels sprouts", "🥬", "veg", "Steamed and halved."),
  f("pumpkin", "Pumpkin", "🎃", "veg", "Roasted or steamed until soft."),
  f("celery", "Celery", "🥬", "veg", "Cooked until soft, or blended into a sauce.", "celery"),
  // fruit
  f("apple", "Apple", "🍎", "fruit", "Cooked until soft, or grated; never raw chunks at first."),
  f("pear", "Pear", "🍐", "fruit", "Ripe and soft, or cooked."),
  f("banana", "Banana", "🍌", "fruit", "Mashed, or a piece to hold."),
  f("mango", "Mango", "🥭", "fruit", "Ripe slices to hold."),
  f("peach", "Peach", "🍑", "fruit", "Ripe, stone out."),
  f("plum", "Plum", "🟣", "fruit", "Ripe, stone out."),
  f("apricot", "Apricot", "🍑", "fruit", "Fresh and ripe, stone out."),
  f("melon", "Melon", "🍈", "fruit", "Soft slices, no seeds."),
  f("watermelon", "Watermelon", "🍉", "fruit", "Seedless sticks."),
  f("strawberry", "Strawberries", "🍓", "fruit", "Halved or squashed."),
  f("blueberry", "Blueberries", "🫐", "fruit", "Squashed flat."),
  f("raspberry", "Raspberries", "🍓", "fruit", "Squashed."),
  f("kiwi", "Kiwi", "🥝", "fruit", "Peeled slices."),
  f("orange", "Orange", "🍊", "fruit", "Segments, pith and pips out."),
  f("grapes", "Grapes", "🍇", "fruit", "Always cut in quarters lengthways (choking)."),
  f("pineapple", "Pineapple", "🍍", "fruit", "Ripe, in soft strips."),
  f("avocado", "Avocado", "🥑", "fruit", "Mashed, or ripe slices to hold."),
  f("papaya", "Papaya", "🧡", "fruit", "Ripe slices."),
  f("cherries", "Cherries", "🍒", "fruit", "Stones out, quartered."),
  f("prunes", "Prunes", "🟤", "fruit", "Soaked and chopped; a little at a time."),
  f("dried-apricot", "Dried apricots", "🟠", "fruit", "Soaked and chopped; often has sulphites.", "sulphites"),
  f("raisins", "Raisins", "🍇", "fruit", "Soaked and chopped, at mealtimes.", "sulphites"),
  // grains and starch (gluten is one of the allergens)
  f("baby-rice", "Rice", "🍚", "grains", "Well cooked."),
  f("oats", "Oats (porridge)", "🥣", "grains", "Porridge made with breast, formula or cows' milk.", "gluten"),
  f("wheat", "Wheat (toast, pasta)", "🍞", "grains", "Toast fingers, or soft pasta.", "gluten"),
  f("bread", "Bread", "🍞", "grains", "Toast fingers; lower-salt bread.", "gluten"),
  f("pasta", "Pasta", "🍝", "grains", "Cooked until soft.", "gluten"),
  f("couscous", "Couscous", "🍚", "grains", "Cooked, mixed with vegetables.", "gluten"),
  f("barley", "Barley", "🌾", "grains", "Well cooked, in a stew.", "gluten"),
  f("rye", "Rye", "🌾", "grains", "Rye bread fingers.", "gluten"),
  f("quinoa", "Quinoa", "🌾", "grains", "Well cooked."),
  f("polenta", "Polenta (corn)", "🌽", "grains", "Soft, or set and cut into fingers."),
  f("millet", "Millet", "🌾", "grains", "Well cooked."),
  // protein
  f("egg", "Egg", "🥚", "protein", "Hard-boiled, or cooked through. British Lion eggs can be soft.", "egg"),
  f("chicken", "Chicken", "🍗", "protein", "Cooked through, shredded or minced."),
  f("turkey", "Turkey", "🦃", "protein", "Cooked through, minced."),
  f("beef", "Beef", "🥩", "protein", "Slow-cooked and shredded, or mince."),
  f("lamb", "Lamb", "🍖", "protein", "Slow-cooked and shredded, or mince."),
  f("pork", "Pork", "🍖", "protein", "Cooked through; not ham or bacon (salty)."),
  f("lentils", "Lentils", "🟠", "protein", "Cooked until soft (dhal)."),
  f("chickpeas", "Chickpeas", "🟡", "protein", "Mashed, or hummus without added salt."),
  f("beans", "Beans", "🫘", "protein", "Cooked and mashed; no-salt baked beans."),
  f("tofu", "Tofu", "⬜", "protein", "Soft strips.", "soya"),
  f("edamame", "Edamame", "🫛", "protein", "Squashed.", "soya"),
  f("salmon", "Salmon", "🐟", "protein", "Cooked, bones out, flaked.", "fish"),
  f("white-fish", "White fish (cod, haddock)", "🐟", "protein", "Cooked, bones out, flaked.", "fish"),
  f("sardines", "Sardines or mackerel", "🐟", "protein", "Cooked or tinned in water, mashed.", "fish"),
  f("tuna", "Tuna", "🐟", "protein", "Tinned, now and then (no more than 2 portions of oily fish a week for girls).", "fish"),
  f("prawns", "Prawns", "🦐", "protein", "Cooked thoroughly, finely chopped. Never raw.", "crustaceans"),
  f("crab", "Crab", "🦀", "protein", "Cooked thoroughly. Never raw.", "crustaceans"),
  f("mussels", "Mussels", "🦪", "protein", "Cooked thoroughly, chopped. Never raw.", "molluscs"),
  f("squid", "Squid", "🦑", "protein", "Cooked and finely chopped.", "molluscs"),
  f("peanut", "Peanut", "🥜", "protein", "Smooth peanut butter (no salt or sugar), thinned. Never whole nuts.", "peanut"),
  f("almond", "Almond", "🌰", "protein", "Ground almonds, or smooth almond butter. Never whole.", "tree-nuts"),
  f("cashew", "Cashew", "🌰", "protein", "Smooth cashew butter. Never whole.", "tree-nuts"),
  f("hazelnut", "Hazelnut", "🌰", "protein", "Ground. Never whole.", "tree-nuts"),
  f("walnut", "Walnut", "🌰", "protein", "Ground. Never whole.", "tree-nuts"),
  f("pistachio", "Pistachio", "🌰", "protein", "Ground. Never whole.", "tree-nuts"),
  f("sesame", "Sesame (tahini)", "🫘", "protein", "A little tahini stirred in, or hummus.", "sesame"),
  f("lupin", "Lupin flour", "🌼", "protein", "Only if you use it (some breads and pastas).", "lupin"),
  // dairy (cows' milk as a drink only from 1 year; in food from about 6 months)
  f("yoghurt", "Yoghurt", "🥣", "dairy", "Plain, full-fat, no added sugar.", "milk"),
  f("cows-milk", "Cows' milk in food", "🥛", "dairy", "In cooking or porridge. As a drink from 1 year.", "milk"),
  f("cheese", "Cheese", "🧀", "dairy", "Pasteurised, full-fat (grated cheddar).", "milk"),
  f("cream-cheese", "Cream cheese", "🧀", "dairy", "Full-fat, pasteurised.", "milk"),
  f("cottage-cheese", "Cottage cheese", "🧀", "dairy", "Full-fat.", "milk"),
  f("fromage-frais", "Fromage frais", "🥣", "dairy", "Plain, full-fat, no added sugar.", "milk"),
  f("mozzarella", "Mozzarella", "🧀", "dairy", "Pasteurised, torn into soft pieces.", "milk"),
  f("butter", "Butter", "🧈", "dairy", "A little, unsalted.", "milk"),
  f("soya-yoghurt", "Soya yoghurt", "🥣", "dairy", "Unsweetened, with added calcium.", "soya"),
  // herbs, spices and the rest
  f("cinnamon", "Cinnamon", "🟤", "extras", "A pinch in porridge or fruit."),
  f("cumin", "Cumin", "🟤", "extras", "A pinch in cooking."),
  f("garlic", "Garlic", "🧄", "extras", "Cooked into other foods."),
  f("ginger", "Ginger", "🫚", "extras", "A little, cooked in."),
  f("herbs", "Herbs (basil, parsley)", "🌿", "extras", "Chopped into food."),
  f("mustard", "Mustard", "🟡", "extras", "A little in cooking.", "mustard"),
  f("olive-oil", "Olive oil", "🫒", "extras", "For cooking."),
  f("honey", "Honey", "🍯", "extras", "Not before 1 year (it can cause botulism).", undefined, 12),
];

/** The foods that belong in a second group as well (the group they're listed under above is their first). */
const ALSO: Record<string, Exclude<FoodGroup, "allergens">[]> = {
  peas: ["protein"], "green-beans": ["protein"], edamame: ["veg"], sweetcorn: ["grains"], polenta: ["veg"], lentils: ["veg"], chickpeas: ["veg"], beans: ["veg"],
  "soya-yoghurt": ["protein"], tofu: ["dairy"], sesame: ["extras"], lupin: ["grains"], "cows-milk": ["protein"], cheese: ["protein"], egg: ["dairy"],
  avocado: ["veg"], tomato: ["fruit"], pumpkin: ["fruit"], celery: ["extras"],
};
for (const x of FOODS) if (ALSO[x.id]) x.also = ALSO[x.id];

/** Whether a food is shown in a group: the allergens are every food that is one; the others, the foods in that group, allergen or not. */
export const inGroup = (x: Food, g: FoodGroup) => (g === "allergens" ? !!x.allergen : x.group === g || !!x.also?.includes(g));

export const foodById = (id: string) => FOODS.find((x) => x.id === id);
export const allergenFoods = (a: AllergenId) => FOODS.filter((x) => x.allergen === a);

/** How a try went. */
export type Reaction = "none" | "mild" | "serious";
export type Liked = "yes" | "meh" | "no";
export type Amount = "taste" | "some" | "portion";

/** Three tries without a reaction: the food is done (unless the family chose four or five; see triesGoal). */
export const TRIES_TO_DONE = 3;
export const TRIES_CHOICES = [3, 4, 5] as const;
/** How many tries without a reaction make a food done for this child: their family's choice, else three. */
export const triesGoal = (child?: { foodGoal?: number } | null) => (child?.foodGoal && child.foodGoal >= 3 && child.foodGoal <= 5 ? child.foodGoal : TRIES_TO_DONE);

export type FoodStatus = "new" | "trying" | "done" | "reaction";

export interface FoodProgress { food: Food; tries: number; status: FoodStatus; liked?: Liked; last?: string; reaction?: Reaction }

/**
 * Where each food stands for one child: how many tries, done (the goal, three by default, without a reaction), or a reaction. Worked out from
 * the tries each time, so changing the goal never loses a try: a food simply moves between Trying and Done.
 */
export function foodProgress(tries: FoodTry[], childId: string, goal = TRIES_TO_DONE): Map<string, FoodProgress> {
  const mine = tries.filter((x) => x.childId === childId).sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<string, FoodProgress>();
  for (const food of FOODS) out.set(food.id, { food, tries: 0, status: "new" });
  for (const t of mine) {
    const food = foodById(t.food) ?? { id: t.food, name: t.food, emoji: "🍽️", group: "extras" as const };
    const p = out.get(t.food) ?? { food, tries: 0, status: "new" as FoodStatus };
    p.tries += 1;
    p.last = t.date;
    if (t.liked) p.liked = t.liked;
    if (t.reaction && t.reaction !== "none") p.reaction = p.reaction === "serious" ? "serious" : t.reaction;
    out.set(t.food, p);
  }
  for (const p of out.values()) {
    if (!p.tries) continue;
    p.status = p.reaction ? "reaction" : p.tries >= goal ? "done" : "trying";
  }
  return out;
}

/** Each allergen: done (any of its foods done with no reaction), trying, a reaction, or not yet. */
export function allergenProgress(progress: Map<string, FoodProgress>): { allergen: (typeof ALLERGENS)[number]; status: FoodStatus; lastGiven?: string }[] {
  return ALLERGENS.map((a) => {
    const ps = allergenFoods(a.id).map((x) => progress.get(x.id)!).filter(Boolean);
    const status: FoodStatus = ps.some((p) => p.status === "reaction") ? "reaction" : ps.some((p) => p.status === "done") ? "done" : ps.some((p) => p.status === "trying") ? "trying" : "new";
    const last = ps.map((p) => p.last).filter((d): d is string => !!d).sort().pop();
    return { allergen: a, status, lastGiven: last };
  });
}

/**
 * What to try next: foods halfway there first (to finish them), then an allergen not started, then something new from a group with few
 * tries. Never a food with a reaction, never one not yet safe for their age.
 */
export function suggestions(progress: Map<string, FoodProgress>, ageMonths: number, count = 3): Food[] {
  const all = [...progress.values()].filter((p) => !(p.food.from && ageMonths < p.food.from));
  const halfway = all.filter((p) => p.status === "trying").sort((a, b) => b.tries - a.tries || (a.last ?? "").localeCompare(b.last ?? "")).map((p) => p.food);
  const startedAllergens = new Set(all.filter((p) => p.food.allergen && p.status !== "new").map((p) => p.food.allergen));
  const allergen = all.filter((p) => p.food.allergen && p.status === "new" && !startedAllergens.has(p.food.allergen)).map((p) => p.food);
  const fresh = all.filter((p) => p.status === "new" && !p.food.allergen).map((p) => p.food);
  const out: Food[] = [];
  for (const list of [halfway, allergen.slice(0, 1), fresh]) for (const x of list) if (out.length < count && !out.includes(x)) out.push(x);
  return out;
}

/**
 * A gentle nudge about allergens (NHS): one new allergen at a time, a couple of days apart, so a reaction can be traced; and once one is in
 * the diet, keep giving it regularly. Returns what to say, if anything.
 */
export function allergenNotes(tries: FoodTry[], childId: string, today: string, goal = TRIES_TO_DONE): { wait?: string; keepUp: string[] } {
  const progress = foodProgress(tries, childId, goal);
  const firsts = new Map<string, string>(); // allergen → the day it was first given
  for (const t of tries.filter((x) => x.childId === childId).sort((a, b) => a.date.localeCompare(b.date))) {
    const a = foodById(t.food)?.allergen;
    if (a && !firsts.has(a)) firsts.set(a, t.date);
  }
  const newest = [...firsts.entries()].sort((a, b) => b[1].localeCompare(a[1]))[0];
  const daysAgo = (d: string) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  const wait = newest && daysAgo(newest[1]) < 2 ? ALLERGENS.find((x) => x.id === newest[0])?.name : undefined;
  const keepUp = allergenProgress(progress).filter((a) => a.status === "done" && a.lastGiven && daysAgo(a.lastGiven) > 7).map((a) => a.allergen.name);
  return { ...(wait ? { wait } : {}), keepUp };
}

/** The NHS's weaning pages, shown on the Foods & allergens page. */
export const NHS_WEANING_URL = "https://www.nhs.uk/start-for-life/baby/weaning/";
export const NHS_ALLERGY_URL = "https://www.nhs.uk/start-for-life/baby/weaning/safe-weaning/food-allergies/";
