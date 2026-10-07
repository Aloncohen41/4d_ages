/** One central list of tags. Memories carry tag ids; the name, category and (for people) the family member live here. */
export type TagCategory = "person" | "event" | "place" | "other";
export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  relatedFamilyMemberId?: string; // for person tags: the family member this tag stands for
}

/** Bookkeeping for syncing a shared child between phones. */
export interface SyncFields {
  updatedAt?: number; // when this record was last changed on a phone (ms)
  syncedTs?: number; // the updatedAt value that is known to be in the cloud
}

export type KidTheme = "pink" | "blue" | "green";
export type MediaKind = "photo" | "video";

/**
 * Every memory is the same kind of record — a photo, a story, a milestone, a first, a last, or a measurement.
 * The `type` says which; the common fields are shared and only a few fields belong to one type.
 */
export type MemoryType = "photo" | "story" | "milestone" | "first" | "last" | "measure";
/** The types you can create from the "+" menu (a plain photo is added through the photo picker). */
export type EntryKind = Exclude<MemoryType, "photo">;

export type GrowthRef = "girl" | "boy" | "none";

/** A weight point for charts, read from the measurements (not stored separately). */
export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
}

/** A height point for charts, read from the measurements (not stored separately). */
export interface HeightEntry {
  id: string;
  date: string;
  cm: number;
}

/** Which part of a photo shows inside a round profile picture (normalised, so it works at any size). */
export interface AvatarCrop {
  x: number; // 0..1 — the point of the image shown at the centre of the frame (left → right)
  y: number; // 0..1 (top → bottom)
  zoom: number; // 1 = the photo just fills the frame; larger = zoomed in
  aspect: number; // the photo's width / height
}

export interface Child extends SyncFields {
  shared?: boolean; // synced with another parent through the cloud
  id: string;
  name: string;
  birth: string; // YYYY-MM-DD
  theme: KidTheme;
  emoji: string;
  avatarPhotoId?: string;
  growthRef?: GrowthRef; // which WHO reference range to compare against
  avatarCrop?: AvatarCrop;
}

export interface MediaItem {
  id: string;
  uri: string; // empty while a shared file is still downloading
  path?: string; // cloud storage path
  thumb?: string; // for videos: the picture shown for them (a frame you chose)
  kind: MediaKind;
}

export interface Memory extends SyncFields {
  id: string;
  childId: string;
  type: MemoryType;
  // common to every type
  title?: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  location?: string;
  media: MediaItem[]; // photos and videos (the first photo is the cover)
  tagIds: string[]; // ids from the central tag list
  createdAt: number;
  // only some types
  milestoneId?: string; // milestone: which milestone in the catalogue
  heightCm?: number; // measure
  weightKg?: number; // measure
  // how it is drawn until there is a real photo, and where it came from
  emoji: string;
  palette: string;
  source: string;
}

export interface Relative extends SyncFields {
  id: string;
  name: string;
  relation: string; // one of RELATION_PRESETS, or "Other"
  customLabel?: string; // optional wording of your own, e.g. "Nana", "Opa", "Auntie"
  emoji: string; // used until the member has a profile picture
  photoUri?: string; // their own profile picture
  crop?: AvatarCrop;
  /**
   * Whose family this person is in. A person is ONE record shared by the children whose families they are in (so their name, picture and tags
   * stay the same for each). Missing = from before families were per child: they belong to every child that existed then (see family.ts).
   */
  childIds?: string[];
  /** Set when this person IS one of the children (a sibling): which child. Their name then follows that child, and they are never in that child's own family. */
  childRef?: string;
}

export const RELATION_PRESETS = ["Mom", "Dad", "Guardian", "Grandma", "Grandpa", "Sister", "Brother", "Sibling", "Aunt", "Uncle", "Cousin", "Family friend", "Other"] as const;
export const RELATION_EMOJI: Record<string, string> = {
  Mom: "👩", Dad: "👨", Guardian: "🧑", Grandma: "👵", Grandpa: "👴", Sister: "👧", Brother: "👦", Sibling: "🧒", Aunt: "👩‍🦰", Uncle: "🧔", Cousin: "🧒", "Family friend": "🙂", Other: "💛",
};

export interface MilestoneDef extends SyncFields {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  custom?: boolean;
  category?: string; // the area of development, e.g. "Movement"
  months?: [number, number]; // the age band it is usually seen in, in months
  aliases?: string[]; // older milestone ids that count as this same milestone (so nothing already logged is lost)
}

/** The four areas of development in the ZERO TO THREE chart (0–36 months), plus "Other" for milestones of your own. */
export const AREAS = ["Social & Emotional", "Language", "Cognitive", "Movement"] as const;
export type Area = (typeof AREAS)[number] | "Other";
export const MILESTONE_CATEGORIES = [...AREAS, "Other"] as const;
export const CATEGORY_EMOJI: Record<string, string> = {
  "Social & Emotional": "💗", Language: "💬", Cognitive: "🧩", Movement: "🏃", Other: "⭐",
  // names used by earlier versions
  "Social & emotional": "💗", "Thinking & play": "🧩", "Feeding & self-care": "🥄",
};
/** The chart's age bands, in months. */
export const BANDS: [number, number][] = [[0, 6], [6, 12], [12, 18], [18, 24], [24, 30], [30, 36]];

const m = (id: string, label: string, emoji: string, category: string, lo: number, hi: number, hint: string): MilestoneDef => ({ id, label, emoji, hint, category, months: [lo, hi] });

/** The earlier catalogue. Kept so milestones you already logged keep their names; only logged ones are shown. */
export const LEGACY_MILESTONE_DEFS: MilestoneDef[] = [
  // Movement
  m("lifts-head", "Lifts head during tummy time", "💪", "Movement", 0, 3, "Strong little neck muscles at work."),
  m("rolls-over", "Rolls over", "🔄", "Movement", 3, 6, "Tummy to back, or back to tummy."),
  m("sits-up", "Sits without support", "🪑", "Movement", 5, 8, "Upright and proud, no hands needed."),
  m("crawls", "Crawls", "🧎", "Movement", 6, 10, "Off exploring on hands and knees."),
  m("pulls-to-stand", "Pulls up to stand", "🧍", "Movement", 8, 11, "Using the sofa to get to their feet."),
  m("cruises", "Cruises along furniture", "🛋️", "Movement", 9, 12, "Side-stepping along the sofa."),
  m("walks", "Walks alone", "🚶", "Movement", 9, 15, "Steps without holding on."),
  m("runs", "Runs", "🏃", "Movement", 14, 24, "Faster than you can keep up with."),
  m("climbs-stairs", "Climbs stairs", "🪜", "Movement", 16, 24, "One step at a time."),
  m("kicks-ball", "Kicks a ball", "⚽", "Movement", 18, 30, "A first goal, probably by accident."),
  m("jumps", "Jumps with both feet", "🦘", "Movement", 20, 30, "Both feet off the ground."),
  // Language
  m("coos", "Coos and gurgles", "🗣️", "Language", 1, 4, "Those sweet first sounds."),
  m("laughs", "Laughs out loud", "😄", "Language", 3, 5, "The belly laugh you'd bottle up."),
  m("babbles", "Babbles (ba-ba, ma-ma)", "💬", "Language", 5, 9, "Strings of sounds, with feeling."),
  m("responds-name", "Responds to their name", "👂", "Language", 5, 9, "Turns their head when you call."),
  m("waves-bye", "Waves bye-bye", "👋", "Language", 8, 12, "A tiny hand waving at the world."),
  m("points", "Points at things", "👉", "Language", 9, 14, "“That one!”"),
  m("real-words", "Says real words", "🗨️", "Language", 10, 15, "Words that mean something."),
  m("two-words", "Puts two words together", "💭", "Language", 18, 26, "“More milk.”"),
  m("sentences", "Speaks in short sentences", "📣", "Language", 24, 36, "A whole thought, out loud."),
  // Social & emotional
  m("eye-contact", "Makes eye contact", "👀", "Social & emotional", 0, 2, "Looking right at you."),
  m("social-smile", "Smiles back at you", "😊", "Social & emotional", 1, 3, "A smile in reply."),
  m("peekaboo", "Plays peekaboo", "🙈", "Social & emotional", 6, 10, "Gasp, giggle, repeat."),
  m("stranger-anxiety", "Shows stranger anxiety", "😟", "Social & emotional", 6, 10, "Clingy, which means they know you best."),
  m("claps", "Claps hands", "👏", "Social & emotional", 8, 12, "Applause for everything."),
  m("hugs", "Gives hugs or kisses", "🤗", "Social & emotional", 10, 15, "Melt."),
  m("plays-alongside", "Plays alongside other children", "🧒", "Social & emotional", 18, 30, "Together, but doing their own thing."),
  m("shares", "Shares or takes turns", "🤝", "Social & emotional", 30, 42, "Sometimes, with encouragement."),
  // Thinking & play
  m("follows-objects", "Follows objects with their eyes", "🔍", "Thinking & play", 1, 3, "Tracking a toy across the room."),
  m("reaches", "Reaches and grabs toys", "🧸", "Thinking & play", 3, 6, "Aim, grab, taste."),
  m("passes-hand", "Passes a toy hand to hand", "🔁", "Thinking & play", 5, 8, "Two hands, one toy."),
  m("finds-hidden", "Finds a hidden object", "🎁", "Thinking & play", 8, 12, "They know it's still there."),
  m("pincer", "Pincer grasp", "🤏", "Thinking & play", 8, 12, "Thumb and finger pick up tiny things."),
  m("stacks-blocks", "Stacks blocks", "🧱", "Thinking & play", 12, 20, "A tower, then a crash."),
  m("pretend-play", "Pretend play", "🎭", "Thinking & play", 18, 30, "Feeding the teddy, calling on the banana phone."),
  m("puzzles", "Does simple puzzles", "🧩", "Thinking & play", 24, 36, "Shapes finding their homes."),
  // Feeding & self-care
  m("slept-through", "Sleeps through the night", "🌙", "Feeding & self-care", 2, 6, "The glorious first full night of sleep."),
  m("finger-foods", "Eats finger foods", "🍌", "Feeding & self-care", 8, 12, "Self-feeding, messily."),
  m("drinks-cup", "Drinks from a cup", "🥤", "Feeding & self-care", 9, 15, "Mostly into the mouth."),
  m("uses-spoon", "Uses a spoon", "🥄", "Feeding & self-care", 12, 18, "Some of it lands."),
  m("helps-dress", "Helps get dressed", "👕", "Feeding & self-care", 24, 36, "Arms in sleeves, or the right shoe."),
  m("potty", "Uses the potty", "🚽", "Feeding & self-care", 24, 36, "Big-kid pants ahead."),
  m("brushes-teeth", "Brushes their own teeth", "🪥", "Feeding & self-care", 30, 42, "With a little help."),
];

const c = (id: string, label: string, emoji: string, area: Area, band: number, hint: string, aliases: string[] = []): MilestoneDef => ({
  id, label, emoji, hint, category: area, months: BANDS[band], ...(aliases.length ? { aliases } : {}),
});

/**
 * The milestone catalogue, taken from ZERO TO THREE's "Developmental Milestones by Age" (birth to 36 months):
 * four areas of development × six age bands. Each statement in the chart is its own milestone, usually seen in that band.
 * It is a roadmap, not a test — children reach these at their own pace.
 */
export const MILESTONE_CATALOG: MilestoneDef[] = [
  // ---- 0–6 months
  c("se-eye-contact", "Makes eye contact", "👀", "Social & Emotional", 0, "Looking right at you.", ["eye-contact"]),
  c("se-smiles", "Smiles back", "😊", "Social & Emotional", 0, "A smile in reply.", ["social-smile"]),
  c("se-soothed", "Is soothed by a caregiver", "🤗", "Social & Emotional", 0, "Calmed by your voice and arms."),
  c("lang-sounds", "Responds to sounds", "👂", "Language", 0, "Turning toward a voice or a rattle."),
  c("lang-coos", "Communicates with cries and coos", "🗣️", "Language", 0, "Those sweet first sounds.", ["coos"]),
  c("cog-tracks", "Tracks objects with their eyes", "🔍", "Cognitive", 0, "Following a toy across the room.", ["follows-objects"]),
  c("cog-faces", "Recognizes familiar faces", "🙂", "Cognitive", 0, "Lighting up for the people they know."),
  c("mov-head", "Lifts their head", "💪", "Movement", 0, "Strong little neck muscles at work.", ["lifts-head"]),
  c("mov-reaches", "Reaches for objects", "✋", "Movement", 0, "Aim, grab, taste.", ["reaches"]),
  // ---- 6–12 months
  c("se-attachment", "Shows attachment to caregivers", "💞", "Social & Emotional", 1, "Wanting their favourite people close."),
  c("lang-babbles", "Babbles with a variety of sounds", "💬", "Language", 1, "Strings of sounds, with feeling.", ["babbles"]),
  c("lang-responds", "Responds to caregivers", "💌", "Language", 1, "Answering when you talk to them.", ["responds-name"]),
  c("cog-explores", "Explores objects", "🧸", "Cognitive", 1, "Shaking, banging, mouthing and turning things over."),
  c("cog-hidden", "Looks for hidden items", "🎁", "Cognitive", 1, "They know it's still there.", ["finds-hidden"]),
  c("mov-sits", "Sits", "🪑", "Movement", 1, "Upright and proud.", ["sits-up"]),
  c("mov-rolls", "Rolls", "🔄", "Movement", 1, "Tummy to back, or back to tummy.", ["rolls-over"]),
  c("mov-crawls", "Crawls or scoots", "🧎", "Movement", 1, "Off exploring, their own way.", ["crawls"]),
  c("mov-small", "Picks up small objects", "🤏", "Movement", 1, "Thumb and finger pick up tiny things.", ["pincer"]),
  // ---- 12–18 months
  c("se-caution", "Shows caution around unfamiliar people", "🙈", "Social & Emotional", 2, "Checking people out before saying hello.", ["stranger-anxiety"]),
  c("lang-words", "Says several simple words", "🗨️", "Language", 2, "Words that mean something.", ["real-words"]),
  c("lang-directions", "Follows simple directions", "✅", "Language", 2, "“Give me the ball.”"),
  c("lang-points", "Points at objects or people", "👉", "Language", 2, "“That one!”", ["points"]),
  c("cog-new-ways", "Explores in new ways", "🔬", "Cognitive", 2, "Dropping, stacking, poking, testing."),
  c("cog-preferences", "Shows preferences", "⭐", "Cognitive", 2, "A favourite toy, a favourite spoon."),
  c("mov-walks", "Walks independently", "🚶", "Movement", 2, "Steps without holding on.", ["walks"]),
  c("mov-feeds", "Begins to feed themselves", "🍌", "Movement", 2, "Self-feeding, messily.", ["finger-foods"]),
  // ---- 18–24 months
  c("se-independence", "Shows more independence", "🌱", "Social & Emotional", 3, "“Me do it!”"),
  c("se-strong-feelings", "Experiences strong emotions", "🌈", "Social & Emotional", 3, "Big feelings, fully felt."),
  c("lang-phrases", "Uses simple words and phrases", "📣", "Language", 3, "“More milk.”"),
  c("lang-gestures", "Uses gestures or facial expressions to communicate", "🙋", "Language", 3, "Showing you what they mean."),
  c("cog-copies", "Copies actions", "👯", "Cognitive", 3, "Sweeping, stirring, clapping — just like you."),
  c("cog-pretend", "Begins pretend play", "🎭", "Cognitive", 3, "Feeding the teddy, calling on the banana phone.", ["pretend-play"]),
  c("cog-mirror", "Recognizes themselves in a mirror", "🪞", "Cognitive", 3, "“That's me!”"),
  c("mov-runs", "Runs", "🏃", "Movement", 3, "Faster than you can keep up with.", ["runs"]),
  c("mov-ball", "Throws or kicks a ball", "⚽", "Movement", 3, "A first goal, probably by accident.", ["kicks-ball"]),
  c("mov-scribbles", "Scribbles", "🖍️", "Movement", 3, "The first masterpiece."),
  c("mov-self-feeds", "Feeds themselves", "🥄", "Movement", 3, "Some of it lands.", ["uses-spoon"]),
  // ---- 24–30 months
  c("se-many-feelings", "Expresses many emotions", "😄", "Social & Emotional", 4, "Joy, surprise, frustration, pride."),
  c("se-helping", "Enjoys helping", "🧹", "Social & Emotional", 4, "Proud little helper."),
  c("lang-combine", "Combines two or three words", "➕", "Language", 4, "“Daddy go work.”"),
  c("lang-understands", "Understands more words than they can say", "🧠", "Language", 4, "Following along, even when they can't say it yet."),
  c("cog-problems", "Solves simple problems", "🧩", "Cognitive", 4, "Figuring it out, one try at a time."),
  c("cog-imaginative", "Engages in imaginative play", "🏰", "Cognitive", 4, "A whole world made up on the spot."),
  c("mov-jumps", "Jumps", "🦘", "Movement", 4, "Up, up, and down."),
  c("mov-climbs", "Climbs", "🧗", "Movement", 4, "Sofa, stairs, anything.", ["climbs-stairs"]),
  c("mov-utensils", "Uses utensils and crayons", "🍴", "Movement", 4, "Fork, spoon, chunky crayon."),
  // ---- 30–36 months
  c("se-turns", "Takes turns", "🤝", "Social & Emotional", 5, "“My turn… your turn.”", ["shares"]),
  c("se-empathy", "Shows empathy", "💗", "Social & Emotional", 5, "Noticing how someone else feels."),
  c("se-self-control", "Developing self-control", "🧘", "Social & Emotional", 5, "Waiting, calming down, trying again."),
  c("lang-sentences", "Speaks in sentences of three or more words", "🗣️", "Language", 5, "A whole thought, out loud.", ["sentences"]),
  c("lang-conversation", "Holds short back-and-forth conversations", "💭", "Language", 5, "A real chat."),
  c("cog-sorts", "Sorts shapes and colors", "🔷", "Cognitive", 5, "Everything in its right place.", ["puzzles"]),
  c("cog-logic", "Uses memory and logic to solve problems", "💡", "Cognitive", 5, "“I remember where it goes!”"),
  c("mov-both-feet", "Jumps with both feet", "🦘", "Movement", 5, "Both feet off the ground.", ["jumps"]),
  c("mov-towers", "Builds towers", "🧱", "Movement", 5, "A tower, then a crash.", ["stacks-blocks"]),
  c("mov-handles", "Turns handles", "🚪", "Movement", 5, "Doors, knobs and lids."),
];

/** Every milestone that can be named — the catalogue plus the earlier list. Use this to look a milestone up by id. */
export const MILESTONE_DEFS: MilestoneDef[] = [...MILESTONE_CATALOG, ...LEGACY_MILESTONE_DEFS];
/** [background, hill] colours for illustrated placeholder cards */
export const PALETTES: Record<string, [string, string]> = {
  peach: ["#fbe4d4", "#e9a27a"],
  sage: ["#e4ebdc", "#a3bb8e"],
  butter: ["#f9eecb", "#e6c55f"],
  rose: ["#f7ddd6", "#e0907f"],
  sky: ["#dde9ec", "#8bb0bd"],
  lav: ["#e9e2f0", "#b09ac8"],
  cocoa: ["#ece1d5", "#b39878"],
};

/** A photo or video that arrived through Android's Share sheet, already copied into the app. */
export interface SharedItem {
  uri: string; // file:// copy inside the app
  kind: MediaKind;
  mime: string;
  name: string;
  size: number;
  date?: string; // when it was taken (YYYY-MM-DD), if the file says so
  time?: string; // HH:MM
}

/** A deletion that still has to be sent to the cloud for a shared child. */
export interface Tombstone {
  table: "memories" | "custom_defs";
  childId: string;
  id: string;
  ts: number;
  paths?: string[]; // cloud files to remove too
}

export interface NotifPrefs {
  enabled: boolean;
  daysBefore: number; // how many days before the birthday to remind
  hour: number; // local hour of day, 0-23
  milestoneAges?: boolean; // "Wow — they're 6 months old today!" (on unless turned off)
  milestoneAsks?: boolean; // "Is she starting any of these?" (on unless turned off)
}
