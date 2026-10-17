import { tr } from "./i18n";
/** Quick ideas for the "First" and "Last" entry types. */
export interface Idea {
  title: string;
  emoji: string;
}

export const FIRST_IDEAS: Idea[] = [
  { get title() { return tr("First smile"); }, emoji: "😊" },
  { get title() { return tr("First laugh"); }, emoji: "😄" },
  { get title() { return tr("First word"); }, emoji: "🗣️" },
  { get title() { return tr("First steps"); }, emoji: "👣" },
  { get title() { return tr("First tooth"); }, emoji: "🦷" },
  { get title() { return tr("First solid food"); }, emoji: "🥑" },
  { get title() { return tr("First bath"); }, emoji: "🛁" },
  { get title() { return tr("First haircut"); }, emoji: "✂️" },
  { get title() { return tr("First swim"); }, emoji: "🏊" },
  { get title() { return tr("First flight"); }, emoji: "✈️" },
  { get title() { return tr("First day at nursery"); }, emoji: "🏫" },
  { get title() { return tr("First holiday"); }, emoji: "🏖️" },
  { get title() { return tr("First snow"); }, emoji: "❄️" },
  { get title() { return tr("First birthday"); }, emoji: "🎂" },
];

export const LAST_IDEAS: Idea[] = [
  { get title() { return tr("Last bottle"); }, emoji: "🍼" },
  { get title() { return tr("Last diaper"); }, emoji: "🧷" },
  { get title() { return tr("Last time sleeping in the cot"); }, emoji: "🛏️" },
  { get title() { return tr("Last day at nursery"); }, emoji: "🏫" },
  { get title() { return tr("Last time using a dummy"); }, emoji: "🧸" },
  { get title() { return tr("Last breastfeed"); }, emoji: "🤱" },
  { get title() { return tr("Last baby bath"); }, emoji: "🛁" },
  { get title() { return tr("Last night waking for a feed"); }, emoji: "🌙" },
  { get title() { return tr("Last time in the stroller"); }, emoji: "🚼" },
  { get title() { return tr("Last time being carried to bed"); }, emoji: "💤" },
];

/** Ideas the child hasn't used yet (compared by title, ignoring case). */
export function openIdeas(ideas: Idea[], usedTitles: (string | undefined)[]): Idea[] {
  const used = new Set(usedTitles.filter(Boolean).map((t) => (t as string).trim().toLowerCase()));
  return ideas.filter((i) => !used.has(i.title.toLowerCase()));
}
