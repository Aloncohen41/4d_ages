import { AREAS, Area, BANDS, Memory, MilestoneDef } from "./types";
import { addMonths, daysBetween } from "./date";
import { monthsOld } from "./growth";
import { withAlpha } from "./m3";

/*
 * How milestones are matched, asked about and understood. Everything here is meant to be encouraging:
 * nothing is counted against a maximum, and "not yet" is never treated as a failure.
 */

export interface AreaMeta {
  label: string;
  phrase: string; // for sentences: "really good at ___"
  emoji: string;
  icon: string; // an icon name (see Icon.tsx)
  /** the softer-but-deeper accent of the pair: ticked circles, area discs, the "Yes!" button */
  color: string;
  /** the very light tint of the pair: the area's header and quiet grounds */
  soft: string;
  /** a dark ink of the same hue, for text and icons on `soft` and on `color` (at least 4.5:1 on both) */
  ink: string;
}
/**
 * Soft, paired pastels in the same spirit as the children's colours: peach, blue, green and yellow for the four areas, lavender for your own.
 * Each pair is a very light tint and a slightly deeper (still soft) accent of one hue; text and icons on them use the area's dark ink.
 */
export const AREA_META: Record<Area, AreaMeta> = {
  "Social & Emotional": { label: "Social & Emotional", phrase: "social and emotional skills", emoji: "💗", icon: "heart", color: "#F2BC9C", soft: "#FDEEE5", ink: "#6E3517" },
  Language: { label: "Language", phrase: "language", emoji: "💬", icon: "message-circle", color: "#A9C9E9", soft: "#E8F1FA", ink: "#1D4870" },
  Cognitive: { label: "Cognitive", phrase: "thinking and problem-solving", emoji: "🧩", icon: "zap", color: "#AFD6B3", soft: "#E8F4E9", ink: "#285530" },
  Movement: { label: "Movement", phrase: "movement", emoji: "🏃", icon: "activity", color: "#EDD083", soft: "#FCF4DA", ink: "#5E470C" },
  Other: { label: "Your own", phrase: "their own milestones", emoji: "⭐", icon: "star", color: "#C9BCE2", soft: "#F1ECF7", ink: "#463868" },
};

/** An area's soft ground: its pastel in the light theme, its own colour at 24% in the dark one (a pastel there would glare and hide the text). */
export const areaSoft = (meta: { color: string; soft: string }, theme: { dark: boolean }) => (theme.dark ? withAlpha(meta.color, 0.24) : meta.soft);
/** Text and icons in an area's colour, on the page or its soft ground: the dark ink in the light theme, the pastel itself in the dark one. */
export const areaInk = (meta: { color: string; ink: string }, theme: { dark: boolean }) => (theme.dark ? meta.color : meta.ink);

const AREA_ALIASES: Record<string, Area> = {
  "Social & Emotional": "Social & Emotional", "Social & emotional": "Social & Emotional", Language: "Language", Cognitive: "Cognitive",
  "Thinking & play": "Cognitive", Movement: "Movement", "Feeding & self-care": "Other", Other: "Other",
};
/** Which area a milestone belongs to (earlier versions used other names). */
export const areaOf = (def: { category?: string }): Area => AREA_ALIASES[def.category ?? ""] ?? "Other";

/* ---------- ages ---------- */
export const ageMonths = (birth: string, today: string) => monthsOld(birth, today);
export const CHART_END = BANDS[BANDS.length - 1][1]; // 36 months
export const pastChart = (months: number) => months >= CHART_END;
export const bandIndex = (months: number) => Math.min(BANDS.length - 1, Math.max(0, Math.floor(months / 6)));
export const bandLabel = (i: number) => `${BANDS[i][0]}–${BANDS[i][1]} months`;
export const bandOfDef = (d: MilestoneDef) => (d.months ? Math.min(BANDS.length - 1, Math.floor(d.months[0] / 6)) : -1);

export function ageLabel(months: number): string {
  const m = Math.floor(months);
  if (m < 24) return `${m} month${m === 1 ? "" : "s"}`;
  const y = Math.floor(m / 12), r = m % 12;
  return r === 0 ? `${y} years` : `${y} years ${r} month${r === 1 ? "" : "s"}`;
}

/** A short age for tight spaces: "18 mo", "2y 6m". */
export function ageChip(months: number): string {
  const m = Math.floor(months);
  if (m < 24) return `${m} mo`;
  const y = Math.floor(m / 12), r = m % 12;
  return r ? `${y}y ${r}m` : `${y}y`;
}

/* ---------- which milestones count as reached ---------- */

/** The memory that says this milestone happened — under its own id, or under an older id that means the same thing. */
export function memoryForDef(def: MilestoneDef, logged: Record<string, Memory>): Memory | undefined {
  if (logged[def.id]) return logged[def.id];
  for (const a of def.aliases || []) if (logged[a]) return logged[a];
  return undefined;
}
export function reachedDefIds(defs: MilestoneDef[], logged: Record<string, Memory>): Set<string> {
  const out = new Set<string>();
  for (const d of defs) if (memoryForDef(d, logged)) out.add(d.id);
  return out;
}

/* ---------- asking "did it happen?" ---------- */

/** We start asking 1/6 of the way before a milestone's window opens: 6 months → 5, 12 → 10, 18 → 15, 24 → 20, 30 → 25. */
export const askStartMonths = (d: MilestoneDef) => (d.months ? d.months[0] - d.months[0] / 6 : Infinity);
const NOT_YET_QUIET_DAYS = 30; // after "not yet", don't ask again for a month

const relevance = (d: MilestoneDef, months: number) => (d.months ? (months < d.months[0] ? d.months[0] - months : months > d.months[1] ? months - d.months[1] : 0) : 999);

/** A short, varied list of milestones worth asking about now (one area at a time, nearest to their age first). */
export function suggestionsFor(defs: MilestoneDef[], logged: Record<string, Memory>, notYet: Record<string, string>, months: number, today: string, limit = 4): MilestoneDef[] {
  const open = defs
    .filter((d) => d.months && !memoryForDef(d, logged) && months >= askStartMonths(d) && months < d.months[1] + 2)
    .filter((d) => !notYet[d.id] || daysBetween(notYet[d.id], today) >= NOT_YET_QUIET_DAYS);
  const byArea = new Map<Area, MilestoneDef[]>();
  for (const d of [...open].sort((a, b) => relevance(a, months) - relevance(b, months))) byArea.set(areaOf(d), [...(byArea.get(areaOf(d)) || []), d]);
  const out: MilestoneDef[] = [];
  for (let round = 0; out.length < limit; round++) {
    let added = false;
    for (const a of AREAS) {
      const d = byArea.get(a)?.[round];
      if (d && out.length < limit) { out.push(d); added = true; }
    }
    if (!added) break;
  }
  return out;
}

/** When ticking a milestone off: today, unless its usual time is long past — then offer "around X months" instead. */
export function defaultMilestoneDate(def: MilestoneDef, birth: string, today: string): { date: string; ask: boolean; aroundMonths?: number } {
  const months = monthsOld(birth, today);
  if (!def.months || months <= def.months[1] + 2) return { date: today, ask: false };
  const mid = Math.round((def.months[0] + def.months[1]) / 2);
  const around = addMonths(birth, mid);
  return { date: around > today ? today : around, ask: true, aroundMonths: mid };
}

/* ---------- the "Reinforce" view ---------- */

export type Status = "outstanding" | "ontrack" | "reinforce" | "unanswered";
export interface AreaReport {
  area: Area;
  status: Status;
  reached: number; // milestones reached in this area (shown as a plain count, never "out of")
  ahead: MilestoneDef[]; // reached a month or more before their usual window opened
  notYet: MilestoneDef[]; // the parent said "not yet" and the usual window has passed
  toCheck: MilestoneDef[]; // due, and nobody has said either way
}
export interface Development {
  areas: AreaReport[];
  highlight: AreaReport | null; // what they're really good at
  reinforce: AreaReport[]; // where a little extra practice could help
  anyData: boolean;
}

/**
 * Looks at the milestones that have been answered (never at the ones nobody has answered):
 *  - reinforce  : the parent said "not yet" to a milestone whose usual window has already passed
 *  - outstanding: something reached a month or more ahead of its window
 *  - on track   : something reached, and nothing to reinforce
 *  - unanswered : nothing marked in this area yet — so we say nothing, rather than guess
 * A "not yet" for a milestone still inside its window is completely normal and is ignored.
 */
export function analyze(defs: MilestoneDef[], logged: Record<string, Memory>, notYet: Record<string, string>, months: number): Development {
  const areas: AreaReport[] = AREAS.map((area) => {
    const mine = defs.filter((d) => d.months && areaOf(d) === area);
    const reached = mine.filter((d) => memoryForDef(d, logged));
    const ahead = reached.filter((d) => d.months![0] - months >= 1);
    const overdue = mine.filter((d) => d.months![1] <= months);
    const notYetOverdue = overdue.filter((d) => !memoryForDef(d, logged) && notYet[d.id]);
    const inWindow = mine.filter((d) => d.months![0] <= months && months < d.months![1]);
    const toCheck = [...overdue, ...inWindow].filter((d) => !memoryForDef(d, logged) && !notYet[d.id]);
    const status: Status = notYetOverdue.length ? "reinforce" : ahead.length ? "outstanding" : reached.length ? "ontrack" : "unanswered";
    return { area, status, reached: reached.length, ahead, notYet: notYetOverdue, toCheck };
  });
  const pool = areas.filter((a) => a.status === "outstanding").sort((a, b) => b.ahead.length - a.ahead.length || b.reached - a.reached);
  const fallback = areas.filter((a) => a.status === "ontrack").sort((a, b) => b.reached - a.reached);
  return { areas, highlight: pool[0] ?? fallback[0] ?? null, reinforce: areas.filter((a) => a.status === "reinforce"), anyData: areas.some((a) => a.reached > 0) };
}

/** How a count is worded. One is "a first", never a bare "1" — small numbers are celebrated, not announced. */
export const reachedText = (n: number) => (n === 1 ? "A first one reached 🎉" : `${n} milestones reached`);

/** The headline on the Milestones tab. A small total is a lovely start, not a score to be compared with anything. */
export function celebration(n: number, name: string): { title: string; sub: string } {
  if (n <= 0) return { title: `Tick off what ${name} can do`, sub: "Each tick is a little celebration." };
  if (n === 1) return { title: "A first milestone reached! 🎉", sub: "What a lovely start." };
  if (n < 5) return { title: `${n} milestones reached`, sub: "A lovely start — every one is worth celebrating." };
  return { title: `${n} milestones reached`, sub: "Every one is worth celebrating." };
}

export function highlightText(name: string, r: AreaReport): string {
  const what = AREA_META[r.area].phrase;
  if (r.status === "outstanding" && r.ahead.length) {
    const more = r.ahead.length > 1 ? ` and ${r.ahead.length - 1} more` : "";
    return `Wow, ${name} is really good at ${what}! They've already reached “${r.ahead[0].label}”${more} — ahead of the usual timing.`;
  }
  return `Wow, ${name} is doing great at ${what}!`;
}

/* ---------- things to try together ---------- */

type Core = (typeof AREAS)[number];
/** Three simple ideas for each area and age band. */
export const ACTIVITIES: Record<Core, string[][]> = {
  "Social & Emotional": [
    ["Hold them close and make eye contact while you talk or sing — they're learning your face.", "Smile and wait: when they smile back, smile even bigger. It's their first conversation.", "Soothe with a calm voice, gentle rocking and skin-to-skin; being comforted builds trust."],
    ["Play peekaboo with a cloth — it teaches that you always come back.", "Answer warmly when they reach for you; it builds a secure attachment.", "Sit face to face and copy their sounds and expressions back to them."],
    ["Introduce new people slowly while they sit on your lap — a familiar base helps them warm up.", "Name feelings out loud: “You look surprised!” “That was a big giggle.”", "Wave hello and goodbye together whenever someone arrives or leaves."],
    ["Offer two small choices (the red cup or the blue one) so they can practise independence.", "When big feelings come, stay close, name the feeling, and cuddle once it passes.", "Play side by side with another child and narrate: “You're both building!”"],
    ["Invite them to help: putting socks in the basket or wiping the table counts as teamwork.", "Read a story about feelings and ask “How do you think they feel?”", "Play pretend with a doll or teddy and let them comfort it."],
    ["Practise taking turns: roll a ball back and forth saying “my turn, your turn.”", "Notice kindness out loud: “You gave your friend a hug — that made them smile.”", "Try a calm-down routine together — three slow “smell the flower” breaths."],
  ],
  Language: [
    ["Talk through what you're doing — nappy changes, baths, walks — even if they only coo back.", "Pause after you speak and wait for a coo or gurgle, then answer it like a conversation.", "Sing the same songs every day; repetition is how they learn sounds."],
    ["Copy their babbles (“ba-ba”) and add a word: “Ba-ba… ball!”", "Name things as you point: “That's a spoon. Spoon!”", "Read short board books with big pictures and let them pat the pages."],
    ["Point and name: ask “Where's the dog?” and cheer when they look or point.", "Give one-step directions with a gesture: “Give me the ball.”", "Narrate the day in short, simple sentences and leave pauses for their words."],
    ["Add to what they say: if they say “milk”, answer “Yes, more milk please!”", "Sing action songs (like Wheels on the Bus) and let them fill in the last word.", "Offer simple choices — “banana or apple?” — and wait for a word, a point or a gesture."],
    ["Look at picture books together and ask “What's that?” and “What's happening?”", "Model short phrases: “Big truck.” “Daddy go work.”", "Play “where's your nose?” games to build the words they understand."],
    ["Chat at mealtimes: ask about their day and give them time to answer.", "Retell a favourite story together and let them say what happens next.", "Try rhymes and word games, and stretch their sentences: “The dog is… big? brown?”"],
  ],
  Cognitive: [
    ["Slowly move a bright toy from side to side and let their eyes follow it.", "Show high-contrast pictures and your face up close — they love faces.", "Place a baby-safe mirror or soft toys within sight during tummy time."],
    ["Hide a toy under a cloth and cheer when they find it.", "Offer safe objects with different textures to touch, shake and bang.", "Play in-and-out games: drop toys in a basket and take them out together."],
    ["Try stacking cups or simple cause-and-effect toys (press a button, something pops).", "Let them explore safely — different sounds, textures and lids to open and close.", "Offer two favourite toys and notice which one they choose."],
    ["Try simple pretend play: “feed” a teddy or talk on a toy phone — copy them, then add a step.", "Look in a mirror together and name their face and body parts.", "Let them copy your everyday actions: stirring, sweeping, clapping."],
    ["Try chunky puzzles with two to four pieces and cheer each fit.", "Set up a pretend kitchen, shop or doctor's corner with everyday props.", "Hide a toy somewhere new and play “where did it go?”"],
    ["Sort by colour or shape: red blocks here, blue there — or sort the laundry together.", "Play a memory game: hide three toys, take one away and ask “what's missing?”", "Offer short puzzles and building challenges, and let them figure it out first."],
  ],
  Movement: [
    ["A few short, supervised bouts of tummy time each day, with a toy just out of reach.", "Lay a rattle or soft toy within reach so they can swipe and grasp it.", "Gently bring their hands together in the middle and let them grab your finger."],
    ["Place favourite toys just beyond reach on the floor to encourage rolling and crawling.", "Practise supported sitting with cushions around, and add toys at the sides to reach for.", "Offer small, safe finger foods to practise picking up with finger and thumb."],
    ["Let them cruise along a sturdy sofa, then hold both hands and take steps together.", "A push-along toy (with you close by) helps steady first walking.", "Offer a spoon and soft finger foods and let them try feeding themselves — mess is learning."],
    ["Play kick and roll with a soft ball; show them how to throw underhand.", "Give chunky crayons and big paper for first scribbles.", "Practise stairs with you holding on, and run safely on soft grass."],
    ["Make a safe obstacle path with cushions to climb over and a tunnel to crawl through.", "Practise jumping from a low step with your hands to help, and dance to music.", "Offer a child-size spoon and fork at meals, and thick crayons for drawing."],
    ["Practise two-foot jumps: “jump like a frog!” over a rolled-up towel.", "Build towers with blocks, boxes or stacking cups, then knock them down together.", "Let them turn knobs and twist lids on safe containers, and play with playdough."],
  ],
};

export function activitiesFor(area: Area, band: number): string[] {
  if (area === "Other") return [];
  return ACTIVITIES[area][Math.min(ACTIVITIES[area].length - 1, Math.max(0, band))];
}
/** Practise the earlier skill first: use the band of the oldest milestone they haven't reached yet. */
export const reinforceBand = (r: AreaReport, months: number) => Math.min(bandIndex(months), ...r.notYet.map(bandOfDef).filter((b) => b >= 0));

export const STATUS_COPY: Record<Status, { title: string; sub: string }> = {
  outstanding: { title: "Outstanding", sub: "Doing wonderfully — ahead of the usual timing" },
  ontrack: { title: "On track", sub: "They're right where they should be" },
  reinforce: { title: "Reinforce", sub: "A little extra practice could be fun" },
  unanswered: { title: "To explore", sub: "Tick a few milestones and we'll tell you more" },
};
