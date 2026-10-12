import type { MilestoneDef } from "./types";

/**
 * The last day a pregnancy note can have: today while expecting; for a child already born (telling the pregnancy afterwards, "looking back"),
 * the day before the birth. Their birth date stands in for the due date, so weeks are counted back from it.
 */
export const pregnancyLastDay = (child: { birth: string; expecting?: boolean }, today: string) => {
  if (child.expecting) return today;
  const d = new Date(child.birth + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** The day a pregnancy milestone usually happens, counted back from the birth (for ticking one off when looking back). */
export const usualDay = (birth: string, week: number) => {
  const d = new Date(birth + "T00:00:00");
  d.setDate(d.getDate() - Math.max(0, 40 - week) * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** What a pregnancy profile is called until the name is chosen. */
export const PREGNANCY_NAME = "Bump";

/*
 * The pregnancy, before the baby arrives: how big the baby is this week (as a fruit, with a typical length and weight), the pregnancy
 * milestones (the first scan, the heartbeat, the first kick…), and ideas for noting symptoms and cravings. Pure, so it can be tested.
 *
 * Sizes are typical averages from the common pregnancy guides (length crown to rump up to week 19, then head to heel); every baby is different.
 */

export interface WeekSize {
  week: number;
  fruit: string;
  pic: string; // the photo of it, assets/fruit/<pic>.jpg (see fruitPictures.ts)
  emoji: string; // the fruit as an emoji, where a photo doesn't fit (a notification)
  cm: number; // typical length
  g?: number; // typical weight (from week 8)
}

export const FRUIT_WEEKS: WeekSize[] = [
  { week: 4, fruit: "a poppy seed", pic: "poppy-seed", emoji: "🌱", cm: 0.1 },
  { week: 5, fruit: "a sesame seed", pic: "sesame-seed", emoji: "🌱", cm: 0.2 },
  { week: 6, fruit: "a lentil", pic: "lentil", emoji: "🫘", cm: 0.6 },
  { week: 7, fruit: "a blueberry", pic: "blueberry", emoji: "🫐", cm: 1.3 },
  { week: 8, fruit: "a raspberry", pic: "raspberry", emoji: "🍇", cm: 1.6, g: 1 },
  { week: 9, fruit: "a cherry", pic: "cherry", emoji: "🍒", cm: 2.3, g: 2 },
  { week: 10, fruit: "a strawberry", pic: "strawberry", emoji: "🍓", cm: 3.1, g: 4 },
  { week: 11, fruit: "a fig", pic: "fig", emoji: "🟣", cm: 4.1, g: 7 },
  { week: 12, fruit: "a lime", pic: "lime", emoji: "🍋‍🟩", cm: 5.4, g: 14 },
  { week: 13, fruit: "a lemon", pic: "lemon", emoji: "🍋", cm: 7.4, g: 23 },
  { week: 14, fruit: "a peach", pic: "peach", emoji: "🍑", cm: 8.7, g: 43 },
  { week: 15, fruit: "an apple", pic: "apple", emoji: "🍎", cm: 10.1, g: 70 },
  { week: 16, fruit: "an avocado", pic: "avocado", emoji: "🥑", cm: 11.6, g: 100 },
  { week: 17, fruit: "a pear", pic: "pear", emoji: "🍐", cm: 13, g: 140 },
  { week: 18, fruit: "a sweet pepper", pic: "sweet-pepper", emoji: "🫑", cm: 14.2, g: 190 },
  { week: 19, fruit: "a mango", pic: "mango", emoji: "🥭", cm: 15.3, g: 240 },
  { week: 20, fruit: "a banana", pic: "banana", emoji: "🍌", cm: 25.6, g: 300 },
  { week: 21, fruit: "a carrot", pic: "carrot", emoji: "🥕", cm: 26.7, g: 360 },
  { week: 22, fruit: "a papaya", pic: "papaya", emoji: "🥭", cm: 27.8, g: 430 },
  { week: 23, fruit: "a grapefruit", pic: "grapefruit", emoji: "🍊", cm: 28.9, g: 500 },
  { week: 24, fruit: "a corn cob", pic: "corn", emoji: "🌽", cm: 30, g: 600 },
  { week: 25, fruit: "a cauliflower", pic: "cauliflower", emoji: "🥦", cm: 34.6, g: 660 },
  { week: 26, fruit: "a curly lettuce", pic: "lettuce", emoji: "🥬", cm: 35.6, g: 760 },
  { week: 27, fruit: "a cabbage", pic: "cabbage", emoji: "🥬", cm: 36.6, g: 875 },
  { week: 28, fruit: "an aubergine", pic: "aubergine", emoji: "🍆", cm: 37.6, g: 1000 },
  { week: 29, fruit: "a butternut squash", pic: "butternut-squash", emoji: "🎃", cm: 38.6, g: 1150 },
  { week: 30, fruit: "a cucumber", pic: "cucumber", emoji: "🥒", cm: 39.9, g: 1300 },
  { week: 31, fruit: "a coconut", pic: "coconut", emoji: "🥥", cm: 41.1, g: 1500 },
  { week: 32, fruit: "an acorn squash", pic: "squash", emoji: "🎃", cm: 42.4, g: 1700 },
  { week: 33, fruit: "a pineapple", pic: "pineapple", emoji: "🍍", cm: 43.7, g: 1900 },
  { week: 34, fruit: "a cantaloupe melon", pic: "cantaloupe", emoji: "🍈", cm: 45, g: 2100 },
  { week: 35, fruit: "a honeydew melon", pic: "honeydew", emoji: "🍈", cm: 46.2, g: 2400 },
  { week: 36, fruit: "a romaine lettuce", pic: "romaine", emoji: "🥬", cm: 47.4, g: 2600 },
  { week: 37, fruit: "a bunch of chard", pic: "chard", emoji: "🥬", cm: 48.6, g: 2900 },
  { week: 38, fruit: "a leek", pic: "leek", emoji: "🥬", cm: 49.8, g: 3100 },
  { week: 39, fruit: "a small watermelon", pic: "watermelon", emoji: "🍉", cm: 50.7, g: 3300 },
  { week: 40, fruit: "a small pumpkin", pic: "pumpkin", emoji: "🎃", cm: 51.2, g: 3500 },
];

/** This week's size (weeks before 4 count as week 4, after 40 as week 40). */
export const sizeForWeek = (week: number): WeekSize => FRUIT_WEEKS.find((w) => w.week === Math.min(40, Math.max(4, Math.round(week))))!;

/** "First trimester" (to week 13), second (to 27), third. */
export const trimesterOf = (week: number) => (week <= 13 ? 1 : week <= 27 ? 2 : 3);
export const TRIMESTER_NAMES = ["", "First trimester", "Second trimester", "Third trimester"];

/** The pregnancy week on a date, from the due date (week 40). */
export function weekOn(due: string, date: string): number {
  const ms = new Date(due + "T00:00:00").getTime() - new Date(date + "T00:00:00").getTime();
  const daysToGo = Math.round(ms / 86400000);
  return Math.max(1, Math.min(42, 40 - Math.ceil(daysToGo / 7)));
}

const p = (id: string, label: string, emoji: string, week: number, hint: string): MilestoneDef => ({ id: `preg-${id}`, label, emoji, hint, category: "Pregnancy", months: undefined, aliases: undefined, ...({ week } as object) });

/** The gender reveal: the day you found out, and whether it's a girl or a boy (it sets the child's gender). The id is kept from before. */
export const GENDER_REVEAL_ID = "preg-boy-or-girl";
/** The last one: the baby is born. It sets the real birthday and turns the pregnancy into the child's own profile. */
export const BORN_ID = "preg-born";

/** The pregnancy milestones, in the order they usually happen (the week is when, roughly), ending with the birth. */
export const PREGNANCY_MILESTONES: (MilestoneDef & { week?: number })[] = [
  p("positive-test", "Positive pregnancy test", "💗", 4, "The moment you found out."),
  p("heartbeat", "Heard the heartbeat", "💓", 8, "The first time you heard it."),
  p("told-family", "Told the family", "📣", 12, "Who you told first, and how they reacted."),
  p("first-scan", "First scan", "🩻", 12, "The first look at the baby."),
  p("bump-showing", "The bump is showing", "🤰", 16, "When others started to notice."),
  p("boy-or-girl", "Gender reveal", "🎈", 18, "The day you found out: a girl or a boy, or keeping it a surprise."),
  p("anatomy-scan", "Anatomy scan", "🩻", 20, "The mid-pregnancy scan."),
  p("first-kick", "First kick", "🦶", 20, "The first flutter you felt."),
  p("partner-felt", "Partner felt the baby move", "🤲", 24, "The first kick felt from outside."),
  p("hiccups", "Baby has hiccups", "🫧", 28, "Those rhythmic little jumps."),
  p("name-chosen", "Chose the name", "✏️", 30, "And how you chose it."),
  p("baby-shower", "Baby shower", "🎁", 32, "Who came, and the presents."),
  p("nursery-ready", "Nursery ready", "🧸", 34, "Their room, or their corner."),
  p("bag-packed", "Hospital bag packed", "🧳", 36, "Ready to go."),
  p("born", "Welcome to the world", "👶", 40, "The day they arrived. It sets their birthday and starts their own profile."),
];

/** The milestones in each trimester (the birth is shown on its own, at the end). */
export function milestonesByTrimester(): { trimester: 1 | 2 | 3; name: string; defs: (MilestoneDef & { week?: number })[] }[] {
  return ([1, 2, 3] as const).map((n) => ({
    trimester: n, name: TRIMESTER_NAMES[n],
    defs: PREGNANCY_MILESTONES.filter((d) => d.id !== BORN_ID && trimesterOf(pregnancyWeekOf(d) ?? 40) === n),
  }));
}

/** "banana" from "a banana": the fruit on its own, for short labels. */
export const fruitName = (fruit: string) => fruit.replace(/^(a|an) /, "");

/**
 * A date before the birth, said as the week of the pregnancy and the baby's size then: "Week 20 (banana)". Used wherever an age would be
 * shown (posts, the feed, the book). Weeks 1 to 3 have no size yet; a date long before the pregnancy is just "Before birth".
 */
export function weekLabel(due: string, date: string): string {
  const days = Math.round((new Date(due + "T00:00:00").getTime() - new Date(date + "T00:00:00").getTime()) / 86400000);
  if (days > 42 * 7) return "Before birth";
  const week = weekOn(due, date);
  return week < 4 ? `Week ${week}` : `Week ${week} (${fruitName(sizeForWeek(week).fruit)})`;
}

/*
 * The weekly bump photo: once a week, a picture of the bump from the same spot, so that after the birth they play as a video of the bump
 * growing. The photos are kept as posts with this source (and "Bump, week 21" as the title).
 */
export const BUMP_SOURCE = "Bump";
export const BUMP_TIPS = [
  "The same spot each week, in front of a plain wall or door.",
  "Stand side-on, in the same pose (a hand under the bump works well).",
  "Keep the phone at the same height and distance: a strip of tape on the floor for your feet helps, and so does a shelf or tripod.",
  "The same light: the same time of day, by the same window.",
  "A fitted top, the same one each week if you can.",
  "Portrait, with the whole bump and a little space around it.",
];

export interface PlannedBumpReminder { date: Date; title: string; body: string; data: { kind: "bump-photo"; childId: string; week: number } }

/** "Week 21: time for the bump photo", on the first day of each pregnancy week from now until the due date (the hour you chose for reminders). */
export function planBumpPhotoNotifications(kids: { id: string; name: string; birth: string; expecting?: boolean; role?: string }[], prefs: { enabled: boolean; hour: number; bumpPhoto?: boolean }, now: Date): PlannedBumpReminder[] {
  if (!prefs.enabled || prefs.bumpPhoto === false) return [];
  const out: PlannedBumpReminder[] = [];
  for (const k of kids) {
    if (!k.expecting || k.role === "viewer") continue;
    for (let back = 1; back <= 36; back++) {
      const d = new Date(k.birth + "T00:00:00");
      d.setDate(d.getDate() - back * 7); // a new pregnancy week starts on the due date's day of the week
      d.setHours(Math.min(20, prefs.hour + 1), 0, 0, 0);
      if (d <= now) break;
      const week = 40 - back;
      if (week < 4) continue;
      out.push({ date: d, title: `Week ${week}: time for the bump photo 📸`, body: `${k.name} is the size of ${sizeForWeek(week).fruit}. Same spot, same pose, same light, and after the birth the photos play as a video of the bump growing.`, data: { kind: "bump-photo", childId: k.id, week } });
    }
  }
  return out;
}
export const pregnancyWeekOf = (d: MilestoneDef) => (d as MilestoneDef & { week?: number }).week;


