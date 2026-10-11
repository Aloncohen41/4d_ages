import type { MilestoneDef } from "./types";

/*
 * The pregnancy, before the baby arrives: how big the baby is this week (as a fruit, with a typical length and weight), the pregnancy
 * milestones (the first scan, the heartbeat, the first kick…), and ideas for noting symptoms and cravings. Pure, so it can be tested.
 *
 * Sizes are typical averages from the common pregnancy guides (length crown to rump up to week 19, then head to heel); every baby is different.
 */

export interface WeekSize {
  week: number;
  fruit: string;
  emoji: string; // the fruit, as a picture
  cm: number; // typical length
  g?: number; // typical weight (from week 8)
}

export const FRUIT_WEEKS: WeekSize[] = [
  { week: 4, fruit: "a poppy seed", emoji: "🌱", cm: 0.1 },
  { week: 5, fruit: "a sesame seed", emoji: "🌱", cm: 0.2 },
  { week: 6, fruit: "a lentil", emoji: "🫘", cm: 0.6 },
  { week: 7, fruit: "a blueberry", emoji: "🫐", cm: 1.3 },
  { week: 8, fruit: "a raspberry", emoji: "🍇", cm: 1.6, g: 1 },
  { week: 9, fruit: "a cherry", emoji: "🍒", cm: 2.3, g: 2 },
  { week: 10, fruit: "a strawberry", emoji: "🍓", cm: 3.1, g: 4 },
  { week: 11, fruit: "a fig", emoji: "🟣", cm: 4.1, g: 7 },
  { week: 12, fruit: "a lime", emoji: "🍋‍🟩", cm: 5.4, g: 14 },
  { week: 13, fruit: "a lemon", emoji: "🍋", cm: 7.4, g: 23 },
  { week: 14, fruit: "a peach", emoji: "🍑", cm: 8.7, g: 43 },
  { week: 15, fruit: "an apple", emoji: "🍎", cm: 10.1, g: 70 },
  { week: 16, fruit: "an avocado", emoji: "🥑", cm: 11.6, g: 100 },
  { week: 17, fruit: "a pear", emoji: "🍐", cm: 13, g: 140 },
  { week: 18, fruit: "a sweet pepper", emoji: "🫑", cm: 14.2, g: 190 },
  { week: 19, fruit: "a mango", emoji: "🥭", cm: 15.3, g: 240 },
  { week: 20, fruit: "a banana", emoji: "🍌", cm: 25.6, g: 300 },
  { week: 21, fruit: "a carrot", emoji: "🥕", cm: 26.7, g: 360 },
  { week: 22, fruit: "a papaya", emoji: "🥭", cm: 27.8, g: 430 },
  { week: 23, fruit: "a grapefruit", emoji: "🍊", cm: 28.9, g: 500 },
  { week: 24, fruit: "a corn cob", emoji: "🌽", cm: 30, g: 600 },
  { week: 25, fruit: "a cauliflower", emoji: "🥦", cm: 34.6, g: 660 },
  { week: 26, fruit: "a lettuce", emoji: "🥬", cm: 35.6, g: 760 },
  { week: 27, fruit: "a cabbage", emoji: "🥬", cm: 36.6, g: 875 },
  { week: 28, fruit: "an aubergine", emoji: "🍆", cm: 37.6, g: 1000 },
  { week: 29, fruit: "a butternut squash", emoji: "🎃", cm: 38.6, g: 1150 },
  { week: 30, fruit: "a cucumber", emoji: "🥒", cm: 39.9, g: 1300 },
  { week: 31, fruit: "a coconut", emoji: "🥥", cm: 41.1, g: 1500 },
  { week: 32, fruit: "a squash", emoji: "🎃", cm: 42.4, g: 1700 },
  { week: 33, fruit: "a pineapple", emoji: "🍍", cm: 43.7, g: 1900 },
  { week: 34, fruit: "a cantaloupe melon", emoji: "🍈", cm: 45, g: 2100 },
  { week: 35, fruit: "a honeydew melon", emoji: "🍈", cm: 46.2, g: 2400 },
  { week: 36, fruit: "a romaine lettuce", emoji: "🥬", cm: 47.4, g: 2600 },
  { week: 37, fruit: "a bunch of chard", emoji: "🥬", cm: 48.6, g: 2900 },
  { week: 38, fruit: "a leek", emoji: "🥬", cm: 49.8, g: 3100 },
  { week: 39, fruit: "a small watermelon", emoji: "🍉", cm: 50.7, g: 3300 },
  { week: 40, fruit: "a small pumpkin", emoji: "🎃", cm: 51.2, g: 3500 },
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

/** The pregnancy milestones, in the order they usually happen (the week is when, roughly). */
export const PREGNANCY_MILESTONES: (MilestoneDef & { week?: number })[] = [
  p("positive-test", "Positive pregnancy test", "💗", 4, "The moment you found out."),
  p("told-family", "Told the family", "📣", 12, "Who you told first, and how they reacted."),
  p("heartbeat", "Heard the heartbeat", "💓", 8, "The first time you heard it."),
  p("first-scan", "First scan", "🩻", 12, "The first look at the baby."),
  p("bump-showing", "The bump is showing", "🤰", 16, "When others started to notice."),
  p("anatomy-scan", "Anatomy scan", "🩻", 20, "The mid-pregnancy scan."),
  p("boy-or-girl", "Found out boy or girl", "🎈", 20, "Or decided to keep it a surprise."),
  p("first-kick", "First kick", "🦶", 20, "The first flutter you felt."),
  p("partner-felt", "Partner felt the baby move", "🤲", 24, "The first kick felt from outside."),
  p("hiccups", "Baby has hiccups", "🫧", 28, "Those rhythmic little jumps."),
  p("name-chosen", "Chose the name", "✏️", 30, "And how you chose it."),
  p("baby-shower", "Baby shower", "🎁", 32, "Who came, and the presents."),
  p("nursery-ready", "Nursery ready", "🧸", 34, "Their room, or their corner."),
  p("bag-packed", "Hospital bag packed", "🧳", 36, "Ready to go."),
];
export const pregnancyWeekOf = (d: MilestoneDef) => (d as MilestoneDef & { week?: number }).week;

/** Ideas for noting how the pregnancy feels: symptoms, cravings and the odd ones nobody warns you about. */
export const SYMPTOM_IDEAS = [
  "Morning sickness", "Craving", "Can't stand the smell of", "Tiredness", "Heartburn", "Back ache", "Strange dreams", "Swollen feet",
  "Hiccups (baby's)", "Nesting", "Baby brain", "Couldn't sleep",
];
/** The source on a symptom or craving note, so they can be listed together. */
export const SYMPTOM_SOURCE = "Pregnancy";
