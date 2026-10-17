import { MediaItem, SyncFields } from "./types";
import type { Species } from "./pets";
import type { IconName } from "../components/Icon";

import { tr, wordList } from "./i18n";
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
  /** Whose pages these are: a child's (the default) or a pet's, and for a pet, which kinds (missing = every kind). */
  for?: "pet";
  species?: Species[];
  /** Kept like a page (and synced), but shown in its own tab (Health, Adventures), never as a page or in the book. */
  hidden?: boolean;
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
    { k: "E", get label() { return tr("second molar"); }, up: "25–33 months", low: "23–31 months" },
    { k: "D", get label() { return tr("first molar"); }, up: "13–19 months", low: "14–18 months" },
    { k: "C", label: "canine", up: "16–22 months", low: "17–23 months" },
    { k: "B", get label() { return tr("lateral incisor"); }, up: "9–13 months", low: "10–16 months" },
    { k: "A", get label() { return tr("central incisor"); }, up: "8–12 months", low: "6–10 months" },
  ];
  const out: { id: string; label: string; upper: boolean; slot: number; usual: string }[] = [];
  for (const upper of [true, false]) {
    const jaw = upper ? tr("Upper") : tr("Lower");
    // their right side (on the left as you look at them), back to front, then their left side, front to back
    kinds.forEach((x, i) => out.push({ id: `${upper ? "U" : "L"}R${x.k}`, label: `${jaw} right ${x.label}`, upper, slot: i, usual: upper ? x.up : x.low }));
    [...kinds].reverse().forEach((x, i) => out.push({ id: `${upper ? "U" : "L"}L${x.k}`, label: `${jaw} left ${x.label}`, upper, slot: 5 + i, usual: upper ? x.up : x.low }));
  }
  return out;
})();

const FIRSTS = wordList([
  "Smile", "Laugh", "Rolled over", "Sat up", "Crawled", "Stood up", "Steps", "Word", "Tooth", "Solid food", "Slept through the night",
  "Haircut", "Swim", "Holiday", "Wave", "Clap", "Kiss", "Drew a picture", "Rode a bike", "Day at nursery",
]).map((label) => ({ id: label.toLowerCase().replace(/[^a-z]+/g, "-"), label }));

/**
 * The whole birth story, a part at a time, asked the way a friend who can't wait to hear it would. Each part is a field of the Birth story page,
 * so it can be added to later from Classics, and each part that's filled in gets its own place in the book, after the day they were born.
 */
export const BIRTH_STORY_PARTS: { id: string; label: string; prompt: string }[] = [
  { id: "started", get label() { return tr("How it all started"); }, get prompt() { return tr("When did you know it was happening? Where were you, what were you doing, and what was the first sign: a twinge, your waters, a planned induction or caesarean?"); } },
  { id: "gettingThere", get label() { return tr("Getting there"); }, get prompt() { return tr("Who did you call first? How did you get to the hospital or birth centre, or did they come to you? Was there a mad dash?"); } },
  { id: "labourStory", get label() { return tr("Labour"); }, get prompt() { return tr("How long did it go on, and how did it feel? What helped you through: breathing, music, a warm bath, walking, gas and air, an epidural?"); } },
  { id: "partner", get label() { return tr("Your birth partner"); }, get prompt() { return tr("Who was by your side, and what did they do? The lovely bits, the funny bits, and anything you'll never let them forget."); } },
  { id: "team", get label() { return tr("The people who looked after you"); }, get prompt() { return tr("The midwives, doctors or doula. Anyone you'll always remember, and what they said or did?"); } },
  { id: "arrival", get label() { return tr("The moment they arrived"); }, get prompt() { return tr("How did your baby come into the world? What do you remember most about those last minutes?"); } },
  { id: "firstMeeting", get label() { return tr("Meeting for the first time"); }, get prompt() { return tr("The first cry, the first cuddle, the first look at that little face. What went through your mind?"); } },
  { id: "firstHours", get label() { return tr("The first hours"); }, get prompt() { return tr("Skin to skin, the first feed, the first phone calls, and who came to meet them."); } },
  { id: "unexpected", get label() { return tr("Things that didn't go to plan"); }, get prompt() { return tr("Anything that surprised you or went differently. Only if you'd like to share it."); } },
  { id: "funny", get label() { return tr("The funny moments"); }, get prompt() { return tr("Every birth has at least one!"); } },
  { id: "home", get label() { return tr("Going home"); }, get prompt() { return tr("The first car ride, the first night, and brothers, sisters or pets meeting the baby."); } },
  { id: "toBaby", get label() { return tr("A note to your little one"); }, get prompt() { return tr("What would you like them to know about the day they were born?"); } },
];

/** The places a pet has been, kept as JSON in the Adventures page (see places.ts). */
export const PLACES_ID = "pet-places";
/** A pet's details (microchip, insurance, vet), on the Health tab. */
export const PET_DETAILS_ID = "pet-details";
/** A pet's health reminders (vaccines, flea and worm, check-ups), as JSON (see reminders.ts). */
export const REMINDERS_ID = "pet-reminders";
/** Where a pet came from and the day they came home (the first page of their book). */
export const PET_HOME_ID = "pet-home";

export const CLASSICS: ClassicTemplate[] = [
  {
    id: "birth", get title() { return tr("Birth story"); }, get desc() { return tr("When, where, who was there, and how it happened"); }, icon: "birthday",
    fields: [
      { id: "date", get label() { return tr("Date"); }, kind: "date" },
      { id: "time", get label() { return tr("Time"); }, kind: "time" },
      { id: "place", get label() { return tr("Where"); }, kind: "text", get placeholder() { return tr("Example: City Hospital"); } },
      { id: "labour", get label() { return tr("Length of labour"); }, kind: "text", get placeholder() { return tr("Example: 14 hours"); } },
      { id: "type", get label() { return tr("Type of birth"); }, kind: "choice", get options() { return [tr("Vaginal birth"), tr("Assisted birth"), tr("Caesarean"), tr("Home birth"), tr("Water birth"), tr("Other")].map((w) => tr(w)); } },
      { id: "weight", get label() { return tr("Birth weight"); }, kind: "text", get placeholder() { return tr("Example: 3.4 kg"); } },
      { id: "length", get label() { return tr("Length"); }, kind: "text", get placeholder() { return tr("Example: 50 cm"); } },
      { id: "who", get label() { return tr("Who was there"); }, kind: "text", get placeholder() { return tr("Example: Mummy, Daddy and the midwife"); } },
      { id: "story", get label() { return tr("The story"); }, kind: "long", get placeholder() { return tr("Example: You arrived just as the sun came up…"); } },
      ...BIRTH_STORY_PARTS.map((p) => ({ id: p.id, label: p.label, kind: "long" as const, placeholder: p.prompt })),
      { id: "photo", get label() { return tr("Photo"); }, kind: "photo" },
    ],
  },
  {
    id: "teeth", get title() { return tr("Teeth"); }, get desc() { return tr("When did my teeth grow? A date for every tooth"); }, icon: "tooth",
    fields: [
      { id: "teeth", get label() { return tr("Tap a tooth to set the day it came through"); }, kind: "teeth" },
      { id: "notes", get label() { return tr("Notes"); }, kind: "long", get placeholder() { return tr("Example: The first one came through on holiday"); } },
    ],
  },
  {
    id: "food", get title() { return tr("Food"); }, get desc() { return tr("Allergies, first foods, and what they love and don't"); }, icon: "food",
    fields: [
      { id: "allergies", get label() { return tr("Allergies"); }, kind: "long", get placeholder() { return tr("Example: None so far"); } },
      { id: "first", get label() { return tr("First food"); }, kind: "text", get placeholder() { return tr("Example: Mashed avocado"); } },
      { id: "firstDate", get label() { return tr("Date of first food"); }, kind: "date" },
      { id: "likes", get label() { return tr("Foods I like"); }, kind: "list", get placeholder() { return tr("One per line. Example: Bananas"); } },
      { id: "dislikes", get label() { return tr("Foods I don't like"); }, kind: "list", get placeholder() { return tr("One per line. Example: Peas"); } },
      { id: "photo", get label() { return tr("Photo"); }, kind: "photo" },
    ],
  },
  {
    id: "toys", get title() { return tr("Comfort toy and favourite toys"); }, get desc() { return tr("The one they can't sleep without, and the ones they love"); }, icon: "ref-teddy",
    fields: [
      { id: "comfort", get label() { return tr("Comfort toy"); }, kind: "text", get placeholder() { return tr("Example: Bunny"); } },
      { id: "comfortStory", get label() { return tr("Where it came from"); }, kind: "long", get placeholder() { return tr("Example: A present from Grandma on the day you were born"); } },
      { id: "favourites", get label() { return tr("Favourite toys"); }, kind: "list", get placeholder() { return tr("One per line. Example: Wooden blocks"); } },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: "haircut", get title() { return tr("First haircut"); }, get desc() { return tr("With a photo of a lock of hair"); }, icon: "haircut",
    fields: [
      { id: "date", get label() { return tr("Date"); }, kind: "date" },
      { id: "place", get label() { return tr("Where"); }, kind: "text", get placeholder() { return tr("Example: In the kitchen"); } },
      { id: "who", get label() { return tr("Who cut it"); }, kind: "text", get placeholder() { return tr("Example: Daddy"); } },
      { id: "notes", get label() { return tr("How it went"); }, kind: "long" },
      { id: "lock", get label() { return tr("A lock of hair"); }, kind: "photo" },
      { id: "photos", get label() { return tr("Before and after"); }, kind: "photos" },
    ],
  },
  {
    id: "prints", get title() { return tr("Hand and footprints"); }, get desc() { return tr("Photos of their tiny hands and feet"); }, icon: "hand",
    fields: [
      { id: "date", get label() { return tr("Date"); }, kind: "date" },
      { id: "hand", get label() { return tr("Handprint"); }, kind: "photo" },
      { id: "foot", get label() { return tr("Footprint"); }, kind: "photo" },
      { id: "notes", get label() { return tr("Notes"); }, kind: "long" },
    ],
  },
  {
    id: "words", get title() { return tr("First words"); }, get desc() { return tr("Their first words, and how they said them"); }, icon: "message-circle",
    fields: [
      { id: "first", get label() { return tr("First word"); }, kind: "text", get placeholder() { return tr("Example: Dada"); } },
      { id: "firstDate", get label() { return tr("Date"); }, kind: "date" },
      { id: "more", get label() { return tr("More words"); }, kind: "list", get placeholder() { return tr("One per line. Example: Ba (ball)"); } },
      { id: "notes", get label() { return tr("Funny ways of saying things"); }, kind: "long" },
    ],
  },
  {
    id: "holiday", get title() { return tr("First holiday"); }, get desc() { return tr("Where you went and what happened"); }, icon: "trip",
    fields: [
      { id: "where", get label() { return tr("Where"); }, kind: "text", get placeholder() { return tr("Example: The seaside"); } },
      { id: "date", get label() { return tr("When"); }, kind: "date" },
      { id: "who", get label() { return tr("Who came"); }, kind: "text" },
      { id: "story", get label() { return tr("What happened"); }, kind: "long" },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: "birthday", get title() { return tr("First birthday"); }, get desc() { return tr("The party, the cake and the presents"); }, icon: "birthday",
    fields: [
      { id: "date", get label() { return tr("Date"); }, kind: "date" },
      { id: "where", get label() { return tr("Where"); }, kind: "text" },
      { id: "guests", get label() { return tr("Who came"); }, kind: "text" },
      { id: "cake", get label() { return tr("The cake"); }, kind: "text", get placeholder() { return tr("Example: Chocolate, with one candle"); } },
      { id: "presents", get label() { return tr("Presents"); }, kind: "list", get placeholder() { return tr("One per line"); } },
      { id: "story", get label() { return tr("How the day went"); }, kind: "long" },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: "letter", get title() { return tr("Letter to my child"); }, get desc() { return tr("Words for them to read when they're older"); }, icon: "mail",
    fields: [
      { id: "from", get label() { return tr("From"); }, kind: "text", get placeholder() { return tr("Example: Mummy and Daddy"); } },
      { id: "date", get label() { return tr("Date"); }, kind: "date" },
      { id: "letter", get label() { return tr("Letter"); }, kind: "long", get placeholder() { return tr("Example: Dear Maya…"); } },
    ],
  },
  {
    id: "tree", get title() { return tr("Family tree"); }, get desc() { return tr("The generations before them"); }, icon: "family",
    fields: [
      { id: "parents", get label() { return tr("Parents"); }, kind: "text" },
      { id: "siblings", get label() { return tr("Brothers and sisters"); }, kind: "text" },
      { id: "grandparents", get label() { return tr("Grandparents"); }, kind: "list", get placeholder() { return tr("One per line"); } },
      { id: "great", get label() { return tr("Great-grandparents"); }, kind: "list", get placeholder() { return tr("One per line"); } },
      { id: "aunts", get label() { return tr("Aunts and uncles"); }, kind: "list", get placeholder() { return tr("One per line"); } },
      { id: "cousins", get label() { return tr("Cousins"); }, kind: "list", get placeholder() { return tr("One per line"); } },
      { id: "photo", get label() { return tr("A family photo"); }, kind: "photo" },
    ],
  },
  {
    id: "grid", get title() { return tr("Monthly photos"); }, get desc() { return tr("One photo for each month of the first year"); }, icon: "images",
    fields: Array.from({ length: 12 }, (_, i) => ({ id: `m${i + 1}`, label: `${i + 1} month${i ? "s" : ""}`, kind: "photo" as const })),
  },
  {
    id: "favourites", get title() { return tr("Favourites"); }, get desc() { return tr("Their favourite things at this age"); }, icon: "heart",
    fields: [
      { id: "age", get label() { return tr("At what age"); }, kind: "text", get placeholder() { return tr("Example: 2 years"); } },
      { id: "food", get label() { return tr("Food"); }, kind: "text" },
      { id: "toy", get label() { return tr("Toy"); }, kind: "text" },
      { id: "song", get label() { return tr("Song"); }, kind: "text" },
      { id: "book", get label() { return tr("Book"); }, kind: "text" },
      { id: "game", get label() { return tr("Game"); }, kind: "text" },
      { id: "word", get label() { return tr("Word"); }, kind: "text" },
      { id: "place", get label() { return tr("Place"); }, kind: "text" },
      { id: "photo", get label() { return tr("Photo"); }, kind: "photo" },
    ],
  },
  {
    id: "sleep", get title() { return tr("Sleep"); }, get desc() { return tr("Bedtimes, naps, and the night they slept through"); }, icon: "sleep",
    fields: [
      { id: "bedtime", get label() { return tr("Bedtime"); }, kind: "time" },
      { id: "naps", get label() { return tr("Naps"); }, kind: "text", get placeholder() { return tr("Example: Two a day, after lunch and at 4"); } },
      { id: "how", get label() { return tr("How they fall asleep"); }, kind: "long", get placeholder() { return tr("Example: With a song and Bunny"); } },
      { id: "through", get label() { return tr("First night slept through"); }, kind: "date" },
      { id: "notes", get label() { return tr("Notes"); }, kind: "long" },
    ],
  },
  {
    id: "school", get title() { return tr("First day at nursery or school"); }, get desc() { return tr("The place, the teacher and how it went"); }, icon: "school",
    fields: [
      { id: "date", get label() { return tr("Date"); }, kind: "date" },
      { id: "place", get label() { return tr("Nursery or school"); }, kind: "text" },
      { id: "teacher", get label() { return tr("Teacher"); }, kind: "text" },
      { id: "story", get label() { return tr("How it went"); }, kind: "long" },
      { id: "photo", get label() { return tr("Photo"); }, kind: "photo" },
    ],
  },
  {
    id: "firsts", get title() { return tr("Firsts checklist"); }, get desc() { return tr("Tick each first and give it a date"); }, icon: "check-square",
    fields: [{ id: "list", get label() { return tr("Tick a first to set its date"); }, kind: "checklist", items: FIRSTS }],
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

/** A pet's pages (after the children's in CLASSICS). */
const PET_CLASSICS: ClassicTemplate[] = [
  {
    id: PET_HOME_ID, get title() { return tr("Coming home"); }, get desc() { return tr("The day they came home, where from, and the first night"); }, icon: "home", for: "pet",
    fields: [
      { id: "date", get label() { return tr("The day they came home"); }, kind: "date" },
      { id: "from", get label() { return tr("Where they came from"); }, kind: "choice", get options() { return ["A breeder", tr("A shelter or rescue"), tr("Family or friends"), tr("We found them"), tr("A pet shop"), tr("Somewhere else")].map((w) => tr(w)); } },
      { id: "place", get label() { return tr("The place"); }, kind: "text", get placeholder() { return tr("Example: Battersea Dogs Home"); } },
      { id: "address", get label() { return tr("Where it is"); }, kind: "text", get placeholder() { return tr("Example: London"); } },
      { id: "story", get label() { return tr("The first day and night"); }, kind: "long", get placeholder() { return tr("Example: You cried a little, then fell asleep on the sofa…"); } },
      { id: "photos", get label() { return tr("Photos from that day"); }, kind: "photos" },
    ],
  },
  {
    id: "pet-name", get title() { return tr("How you got your name"); }, get desc() { return tr("Who chose it, and the names that nearly won"); }, icon: "edit-2", for: "pet",
    fields: [
      { id: "story", get label() { return tr("The story of the name"); }, kind: "long", get placeholder() { return tr("Example: Your big sister picked it the moment she saw you"); } },
      { id: "nicknames", get label() { return tr("Nicknames"); }, kind: "list", get placeholder() { return tr("One per line. Example: Rexy"); } },
    ],
  },
  {
    id: "pet-favourites", get title() { return tr("Favourite things"); }, get desc() { return tr("Toys, treats, the best spot and the best walk"); }, icon: "heart", for: "pet",
    fields: [
      { id: "toys", get label() { return tr("Favourite toys"); }, kind: "list", get placeholder() { return tr("One per line. Example: The squeaky duck"); } },
      { id: "treats", get label() { return tr("Favourite treats"); }, kind: "list", get placeholder() { return tr("One per line. Example: Cheese"); } },
      { id: "spot", get label() { return tr("Favourite spot"); }, kind: "text", get placeholder() { return tr("Example: The sunny patch by the window"); } },
      { id: "walk", get label() { return tr("Favourite walk or ride"); }, kind: "text", get placeholder() { return tr("Example: The woods by the river"); } },
      { id: "game", get label() { return tr("Favourite game"); }, kind: "text", get placeholder() { return tr("Example: Tug of war"); } },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: "pet-pack", get title() { return tr("Their pack"); }, get desc() { return tr("Best friends, furry and human"); }, icon: "family", for: "pet",
    fields: [
      { id: "friends", get label() { return tr("Best animal friends"); }, kind: "list", get placeholder() { return tr("One per line. Example: Bella, the dog next door"); } },
      { id: "humans", get label() { return tr("Favourite humans"); }, kind: "list", get placeholder() { return tr("One per line. Example: Grandma, who always has a treat"); } },
      { id: "photos", get label() { return tr("Photos together"); }, kind: "photos" },
    ],
  },
  {
    id: "pet-personality", get title() { return tr("Personality"); }, get desc() { return tr("Who they are, in a few words"); }, icon: "smile", for: "pet", species: ["dog", "cat", "rabbit"],
    fields: [
      { id: "words", get label() { return tr("In three words"); }, kind: "text", get placeholder() { return tr("Example: Cuddly, cheeky, greedy"); } },
      { id: "loves", get label() { return tr("Loves"); }, kind: "text", get placeholder() { return tr("Example: Belly rubs and the postman"); } },
      { id: "scared", get label() { return tr("Scared of"); }, kind: "text", get placeholder() { return tr("Example: The hoover"); } },
      { id: "habits", get label() { return tr("Funny habits"); }, kind: "long", get placeholder() { return tr("Example: Sleeps upside down with their legs in the air"); } },
      { id: "photo", get label() { return tr("Photo"); }, kind: "photo" },
    ],
  },
  {
    id: "pet-words", get title() { return tr("Words and sounds"); }, get desc() { return tr("Everything they can say"); }, icon: "message-circle", for: "pet", species: ["bird"],
    fields: [
      { id: "words", get label() { return tr("Words and sounds"); }, kind: "list", get placeholder() { return tr("One per line. Example: Hello gorgeous (March 2026)"); } },
      { id: "best", get label() { return tr("The best one"); }, kind: "long", get placeholder() { return tr("Example: The phone ring, perfectly, every morning"); } },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: "pet-sheds", get title() { return tr("Shed log"); }, get desc() { return tr("Every shed, with a photo"); }, icon: "calendar", for: "pet", species: ["snake"],
    fields: [
      { id: "sheds", get label() { return tr("Sheds"); }, kind: "list", get placeholder() { return tr("One per line. Example: 12 March, one perfect piece"); } },
      { id: "notes", get label() { return tr("Notes"); }, kind: "long", get placeholder() { return tr("Example: Always goes quiet for a few days before"); } },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: "pet-riding", get title() { return tr("Riding and shows"); }, get desc() { return tr("Rides, shows and rosettes"); }, icon: "trophy", for: "pet", species: ["horse"],
    fields: [
      { id: "shows", get label() { return tr("Shows and rosettes"); }, kind: "list", get placeholder() { return tr("One per line. Example: County show, 2nd place, May 2026"); } },
      { id: "story", get label() { return tr("The best ride"); }, kind: "long", get placeholder() { return tr("Example: The first gallop on the beach"); } },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: "pet-nights", get title() { return tr("Nightly adventures"); }, get desc() { return tr("What happens while everyone sleeps"); }, icon: "sleep", for: "pet", species: ["hamster"],
    fields: [
      { id: "story", get label() { return tr("The stories"); }, kind: "long", get placeholder() { return tr("Example: Moved the whole food bowl into the house, one seed at a time"); } },
      { id: "photos", get label() { return tr("Photos"); }, kind: "photos" },
    ],
  },
  {
    id: PET_DETAILS_ID, get title() { return tr("Pet details"); }, get desc() { return tr("Microchip, insurance and the vet"); }, icon: "health", for: "pet", hidden: true,
    fields: [
      { id: "microchip", get label() { return tr("Microchip number"); }, kind: "text" },
      { id: "insurance", get label() { return tr("Insurance"); }, kind: "text", get placeholder() { return tr("Company and policy number"); } },
      { id: "vet", get label() { return tr("Vet"); }, kind: "text", get placeholder() { return tr("Name of the practice"); } },
      { id: "vetPhone", get label() { return tr("Vet's phone"); }, kind: "text" },
      { id: "allergies", get label() { return tr("Allergies"); }, kind: "long" },
      { id: "diet", get label() { return tr("Food and diet"); }, kind: "long" },
    ],
  },
  { id: PLACES_ID, get title() { return tr("Adventures"); }, get desc() { return tr("The places they've been"); }, icon: "place", for: "pet", hidden: true, fields: [] },
  { id: REMINDERS_ID, get title() { return tr("Reminders"); }, get desc() { return tr("Vaccines, flea and worm, check-ups"); }, icon: "bell", for: "pet", hidden: true, fields: [] },
];
CLASSICS.push(...PET_CLASSICS);

/** The pages for this child or pet (a pet's for its kind), without the hidden ones unless asked. */
export function classicsFor(c: { kind?: string; species?: string }, opts: { hidden?: boolean } = {}): ClassicTemplate[] {
  const pet = c.kind === "pet";
  return CLASSICS.filter((t) => (pet ? t.for === "pet" && (!t.species || t.species.includes(c.species as Species)) : !t.for) && (opts.hidden || !t.hidden));
}
