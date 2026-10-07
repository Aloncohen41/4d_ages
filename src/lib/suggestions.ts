/** Quick ideas for the "First" and "Last" entry types. */
export interface Idea {
  title: string;
  emoji: string;
}

export const FIRST_IDEAS: Idea[] = [
  { title: "First smile", emoji: "😊" },
  { title: "First laugh", emoji: "😄" },
  { title: "First word", emoji: "🗣️" },
  { title: "First steps", emoji: "👣" },
  { title: "First tooth", emoji: "🦷" },
  { title: "First solid food", emoji: "🥑" },
  { title: "First bath", emoji: "🛁" },
  { title: "First haircut", emoji: "✂️" },
  { title: "First swim", emoji: "🏊" },
  { title: "First flight", emoji: "✈️" },
  { title: "First day at nursery", emoji: "🏫" },
  { title: "First holiday", emoji: "🏖️" },
  { title: "First snow", emoji: "❄️" },
  { title: "First birthday", emoji: "🎂" },
];

export const LAST_IDEAS: Idea[] = [
  { title: "Last bottle", emoji: "🍼" },
  { title: "Last diaper", emoji: "🧷" },
  { title: "Last time sleeping in the cot", emoji: "🛏️" },
  { title: "Last day at nursery", emoji: "🏫" },
  { title: "Last time using a dummy", emoji: "🧸" },
  { title: "Last breastfeed", emoji: "🤱" },
  { title: "Last baby bath", emoji: "🛁" },
  { title: "Last night waking for a feed", emoji: "🌙" },
  { title: "Last time in the stroller", emoji: "🚼" },
  { title: "Last time being carried to bed", emoji: "💤" },
];

/** Ideas the child hasn't used yet (compared by title, ignoring case). */
export function openIdeas(ideas: Idea[], usedTitles: (string | undefined)[]): Idea[] {
  const used = new Set(usedTitles.filter(Boolean).map((t) => (t as string).trim().toLowerCase()));
  return ideas.filter((i) => !used.has(i.title.toLowerCase()));
}
