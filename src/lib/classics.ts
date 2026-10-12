import { MediaItem, SyncFields } from "./types";
import type { IconName } from "../components/Icon";

/*
 * Classics: the fill-in pages of a printed baby book (teeth, the birth story, food, favourite toys, the first haircut…). Each child has at most
 * one of each, filled in whenever you like; filled ones are added to the keepsake book. Pure, so it can be tested without a phone.
 *
 * Storage: plain text values by field id (a list is one item per line; a tooth or a checklist item is "field.item" → its date), and the
 * pictures by field id.
 */

export type ClassicFieldKind = "text" | "long" | "date" | "time" | "choice" | "list" | "photo" | "photos" | "teeth" | "checklist";
export interface ClassicField {
  id: string;
  label: string;
  kind: ClassicFieldKind;
  placeholder?: string; // "Example: …"
  options?: string[]; // choice
  items?: { id: string; label: string }[]; // checklist
}
export interface ClassicTemplate {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  fields: ClassicField[];
}

export interface ClassicEntry extends SyncFields {
  id: string; // the template id
  childId: string;
  values: Record<string, string>;
  photos: Record<string, MediaItem[]>;
}

/** The 20 baby teeth, upper then lower, right to left as you look at the child, and roughly when each usually comes through. */
export const TEETH: { id: string; label: string; upper: boolean; slot: number; usual: string }[] = (() => {
  const kinds = [
    { k: "E", label: "second molar", up: "25–33 months", low: "23–31 months" },
    { k: "D", label: "first molar", up: "13–19 months", low: "14–18 months" },
    { k: "C", label: "canine", up: "16–22 months", low: "17–23 months" },
    { k: "B", label: "lateral incisor", up: "9–13 months", low: "10–16 months" },
    { k: "A", label: "central incisor", up: "8–12 months", low: "6–10 months" },
  ];
  const out: { id: string; label: string; upper: boolean; slot: number; usual: string }[] = [];
  for (const upper of [true, false]) {
    const jaw = upper ? "Upper" : "Lower";
    // their right side (on the left as you look at them), back to front, then their left side, front to back
    kinds.forEach((x, i) => out.push({ id: `${upper ? "U" : "L"}R${x.k}`, label: `${jaw} right ${x.label}`, upper, slot: i, usual: upper ? x.up : x.low }));
    [...kinds].reverse().forEach((x, i) => out.push({ id: `${upper ? "U" : "L"}L${x.k}`, label: `${jaw} left ${x.label}`, upper, slot: 5 + i, usual: upper ? x.up : x.low }));
  }
  return out;
})();

const FIRSTS = [
  "Smile", "Laugh", "Rolled over", "Sat up", "Crawled", "Stood up", "Steps", "Word", "Tooth", "Solid food", "Slept through the night",
  "Haircut", "Swim", "Holiday", "Wave", "Clap", "Kiss", "Drew a picture", "Rode a bike", "Day at nursery",
].map((label) => ({ id: label.toLowerCase().replace(/[^a-z]+/g, "-"), label }));

/**
 * The whole birth story, a part at a time, asked the way a friend who can't wait to hear it would. Each part is a field of the Birth story page,
 * so it can be added to later from Classics, and each part that's filled in gets its own place in the book, after the day they were born.
 */
export const BIRTH_STORY_PARTS: { id: string; label: string; prompt: string }[] = [
  { id: "started", label: "How it all started", prompt: "When did you know it was happening? Where were you, what were you doing, and what was the first sign: a twinge, your waters, a planned induction or caesarean?" },
  { id: "gettingThere", label: "Getting there", prompt: "Who did you call first? How did you get to the hospital or birth centre, or did they come to you? Was there a mad dash?" },
  { id: "labourStory", label: "Labour", prompt: "How long did it go on, and how did it feel? What helped you through: breathing, music, a warm bath, walking, gas and air, an epidural?" },
  { id: "partner", label: "Your birth partner", prompt: "Who was by your side, and what did they do? The lovely bits, the funny bits, and anything you'll never let them forget." },
  { id: "team", label: "The people who looked after you", prompt: "The midwives, doctors or doula. Anyone you'll always remember, and what they said or did?" },
  { id: "arrival", label: "The moment they arrived", prompt: "How did your baby come into the world? What do you remember most about those last minutes?" },
  { id: "firstMeeting", label: "Meeting for the first time", prompt: "The first cry, the first cuddle, the first look at that little face. What went through your mind?" },
  { id: "firstHours", label: "The first hours", prompt: "Skin to skin, the first feed, the first phone calls, and who came to meet them." },
  { id: "unexpected", label: "Things that didn't go to plan", prompt: "Anything that surprised you or went differently. Only if you'd like to share it." },
  { id: "funny", label: "The funny moments", prompt: "Every birth has at least one!" },
  { id: "home", label: "Going home", prompt: "The first car ride, the first night, and brothers, sisters or pets meeting the baby." },
  { id: "toBaby", label: "A note to your little one", prompt: "What would you like them to know about the day they were born?" },
];

export const CLASSICS: ClassicTemplate[] = [
  {
    id: "birth", title: "Birth story", desc: "When, where, who was there, and how it happened", icon: "birthday",
    fields: [
      { id: "date", label: "Date", kind: "date" },
      { id: "time", label: "Time", kind: "time" },
      { id: "place", label: "Where", kind: "text", placeholder: "Example: City Hospital" },
      { id: "labour", label: "Length of labour", kind: "text", placeholder: "Example: 14 hours" },
      { id: "type", label: "Type of birth", kind: "choice", options: ["Vaginal birth", "Assisted birth", "Caesarean", "Home birth", "Water birth", "Other"] },
      { id: "weight", label: "Birth weight", kind: "text", placeholder: "Example: 3.4 kg" },
      { id: "length", label: "Length", kind: "text", placeholder: "Example: 50 cm" },
      { id: "who", label: "Who was there", kind: "text", placeholder: "Example: Mummy, Daddy and the midwife" },
      { id: "story", label: "The story", kind: "long", placeholder: "Example: You arrived just as the sun came up…" },
      ...BIRTH_STORY_PARTS.map((p) => ({ id: p.id, label: p.label, kind: "long" as const, placeholder: p.prompt })),
      { id: "photo", label: "Photo", kind: "photo" },
    ],
  },
  {
    id: "teeth", title: "Teeth", desc: "When did my teeth grow? A date for every tooth", icon: "tooth",
    fields: [
      { id: "teeth", label: "Tap a tooth to set the day it came through", kind: "teeth" },
      { id: "notes", label: "Notes", kind: "long", placeholder: "Example: The first one came through on holiday" },
    ],
  },
  {
    id: "food", title: "Food", desc: "Allergies, first foods, and what they love and don't", icon: "food",
    fields: [
      { id: "allergies", label: "Allergies", kind: "long", placeholder: "Example: None so far" },
      { id: "first", label: "First food", kind: "text", placeholder: "Example: Mashed avocado" },
      { id: "firstDate", label: "Date of first food", kind: "date" },
      { id: "likes", label: "Foods I like", kind: "list", placeholder: "One per line. Example: Bananas" },
      { id: "dislikes", label: "Foods I don't like", kind: "list", placeholder: "One per line. Example: Peas" },
      { id: "photo", label: "Photo", kind: "photo" },
    ],
  },
  {
    id: "toys", title: "Comfort toy and favourite toys", desc: "The one they can't sleep without, and the ones they love", icon: "ref-teddy",
    fields: [
      { id: "comfort", label: "Comfort toy", kind: "text", placeholder: "Example: Bunny" },
      { id: "comfortStory", label: "Where it came from", kind: "long", placeholder: "Example: A present from Grandma on the day you were born" },
      { id: "favourites", label: "Favourite toys", kind: "list", placeholder: "One per line. Example: Wooden blocks" },
      { id: "photos", label: "Photos", kind: "photos" },
    ],
  },
  {
    id: "haircut", title: "First haircut", desc: "With a photo of a lock of hair", icon: "haircut",
    fields: [
      { id: "date", label: "Date", kind: "date" },
      { id: "place", label: "Where", kind: "text", placeholder: "Example: In the kitchen" },
      { id: "who", label: "Who cut it", kind: "text", placeholder: "Example: Daddy" },
      { id: "notes", label: "How it went", kind: "long" },
      { id: "lock", label: "A lock of hair", kind: "photo" },
      { id: "photos", label: "Before and after", kind: "photos" },
    ],
  },
  {
    id: "prints", title: "Hand and footprints", desc: "Photos of their tiny hands and feet", icon: "hand",
    fields: [
      { id: "date", label: "Date", kind: "date" },
      { id: "hand", label: "Handprint", kind: "photo" },
      { id: "foot", label: "Footprint", kind: "photo" },
      { id: "notes", label: "Notes", kind: "long" },
    ],
  },
  {
    id: "words", title: "First words", desc: "Their first words, and how they said them", icon: "message-circle",
    fields: [
      { id: "first", label: "First word", kind: "text", placeholder: "Example: Dada" },
      { id: "firstDate", label: "Date", kind: "date" },
      { id: "more", label: "More words", kind: "list", placeholder: "One per line. Example: Ba (ball)" },
      { id: "notes", label: "Funny ways of saying things", kind: "long" },
    ],
  },
  {
    id: "holiday", title: "First holiday", desc: "Where you went and what happened", icon: "trip",
    fields: [
      { id: "where", label: "Where", kind: "text", placeholder: "Example: The seaside" },
      { id: "date", label: "When", kind: "date" },
      { id: "who", label: "Who came", kind: "text" },
      { id: "story", label: "What happened", kind: "long" },
      { id: "photos", label: "Photos", kind: "photos" },
    ],
  },
  {
    id: "birthday", title: "First birthday", desc: "The party, the cake and the presents", icon: "birthday",
    fields: [
      { id: "date", label: "Date", kind: "date" },
      { id: "where", label: "Where", kind: "text" },
      { id: "guests", label: "Who came", kind: "text" },
      { id: "cake", label: "The cake", kind: "text", placeholder: "Example: Chocolate, with one candle" },
      { id: "presents", label: "Presents", kind: "list", placeholder: "One per line" },
      { id: "story", label: "How the day went", kind: "long" },
      { id: "photos", label: "Photos", kind: "photos" },
    ],
  },
  {
    id: "letter", title: "Letter to my child", desc: "Words for them to read when they're older", icon: "mail",
    fields: [
      { id: "from", label: "From", kind: "text", placeholder: "Example: Mummy and Daddy" },
      { id: "date", label: "Date", kind: "date" },
      { id: "letter", label: "Letter", kind: "long", placeholder: "Example: Dear Maya…" },
    ],
  },
  {
    id: "tree", title: "Family tree", desc: "The generations before them", icon: "family",
    fields: [
      { id: "parents", label: "Parents", kind: "text" },
      { id: "siblings", label: "Brothers and sisters", kind: "text" },
      { id: "grandparents", label: "Grandparents", kind: "list", placeholder: "One per line" },
      { id: "great", label: "Great-grandparents", kind: "list", placeholder: "One per line" },
      { id: "aunts", label: "Aunts and uncles", kind: "list", placeholder: "One per line" },
      { id: "cousins", label: "Cousins", kind: "list", placeholder: "One per line" },
      { id: "photo", label: "A family photo", kind: "photo" },
    ],
  },
  {
    id: "grid", title: "Monthly photos", desc: "One photo for each month of the first year", icon: "images",
    fields: Array.from({ length: 12 }, (_, i) => ({ id: `m${i + 1}`, label: `${i + 1} month${i ? "s" : ""}`, kind: "photo" as const })),
  },
  {
    id: "favourites", title: "Favourites", desc: "Their favourite things at this age", icon: "heart",
    fields: [
      { id: "age", label: "At what age", kind: "text", placeholder: "Example: 2 years" },
      { id: "food", label: "Food", kind: "text" },
      { id: "toy", label: "Toy", kind: "text" },
      { id: "song", label: "Song", kind: "text" },
      { id: "book", label: "Book", kind: "text" },
      { id: "game", label: "Game", kind: "text" },
      { id: "word", label: "Word", kind: "text" },
      { id: "place", label: "Place", kind: "text" },
      { id: "photo", label: "Photo", kind: "photo" },
    ],
  },
  {
    id: "sleep", title: "Sleep", desc: "Bedtimes, naps, and the night they slept through", icon: "sleep",
    fields: [
      { id: "bedtime", label: "Bedtime", kind: "time" },
      { id: "naps", label: "Naps", kind: "text", placeholder: "Example: Two a day, after lunch and at 4" },
      { id: "how", label: "How they fall asleep", kind: "long", placeholder: "Example: With a song and Bunny" },
      { id: "through", label: "First night slept through", kind: "date" },
      { id: "notes", label: "Notes", kind: "long" },
    ],
  },
  {
    id: "school", title: "First day at nursery or school", desc: "The place, the teacher and how it went", icon: "school",
    fields: [
      { id: "date", label: "Date", kind: "date" },
      { id: "place", label: "Nursery or school", kind: "text" },
      { id: "teacher", label: "Teacher", kind: "text" },
      { id: "story", label: "How it went", kind: "long" },
      { id: "photo", label: "Photo", kind: "photo" },
    ],
  },
  {
    id: "firsts", title: "Firsts checklist", desc: "Tick each first and give it a date", icon: "check-square",
    fields: [{ id: "list", label: "Tick a first to set its date", kind: "checklist", items: FIRSTS }],
  },
];

export const classicById = (id: string) => CLASSICS.find((c) => c.id === id);

/** A list field's items (one per line). */
export const listItems = (text?: string) => (text || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Everything a template has been given, counted: how many fields have something in them. */
export function filledCount(t: ClassicTemplate, e?: ClassicEntry): number {
  if (!e) return 0;
  return t.fields.filter((f) => {
    if (f.kind === "photo" || f.kind === "photos") return (e.photos[f.id]?.length ?? 0) > 0;
    if (f.kind === "teeth" || f.kind === "checklist") return Object.keys(e.values).some((k) => k.startsWith(`${f.id}.`) && e.values[k]);
    return !!e.values[f.id]?.trim();
  }).length;
}
export const isFilled = (t: ClassicTemplate, e?: ClassicEntry) => filledCount(t, e) > 0;

/** The dated items of a teeth or checklist field, in date order. */
export function datedItems(e: ClassicEntry, field: ClassicField): { id: string; label: string; date: string }[] {
  const all = field.kind === "teeth" ? TEETH : field.items ?? [];
  return all
    .map((x) => ({ id: x.id, label: x.label, date: e.values[`${field.id}.${x.id}`] ?? "" }))
    .filter((x) => x.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Every picture a classic holds (for syncing and the book). */
export const classicMedia = (e: ClassicEntry): MediaItem[] => Object.values(e.photos).flat();
