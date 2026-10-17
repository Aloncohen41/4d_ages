/*
 * What can be made from files shared into the app (from Google Photos, the Gallery, WhatsApp, a recorder…): whose memory it is, then what it
 * is. The choices follow the profile (a child, a bump, a pet) and the files (pictures, sound, or both). Pure, for tests.
 */
import { Child, EntryKind, SharedItem, isPet } from "./types";

import { tr } from "./i18n";
export type ShareKind = "post" | "bump" | "ultrasound" | "voice" | "story" | "first" | "last" | "milestone" | "measure" | "health";

export interface ShareOption {
  id: ShareKind;
  label: string;
  desc: string;
  emoji: string;
  /** Made in the add screen of this kind (with the files already in it); otherwise saved straight away as photo posts. */
  entry?: EntryKind;
}

/** The profiles you can add to: your own and the ones shared with you to add to (not the ones you can only look at). */
export const addableProfiles = (kids: Child[]) => kids.filter((k) => k.role !== "viewer");

/** What the files are: how many pictures (photos and videos) and how many sound recordings. */
export function contents(items: Pick<SharedItem, "kind">[]) {
  const audio = items.filter((i) => i.kind === "audio").length;
  return { pictures: items.length - audio, audio, videos: items.filter((i) => i.kind === "video").length };
}

/** The choices, in order: the plainest first. */
export function shareOptions(child: Child, items: Pick<SharedItem, "kind">[]): ShareOption[] {
  const { pictures, audio } = contents(items);
  const out: ShareOption[] = [];
  const pet = isPet(child);
  // a recording is a voice note: a story with the sound (and the pictures with it)
  if (audio) out.push({ id: "voice", get label() { return tr("Voice note"); }, desc: pictures ? tr("The recording, with the pictures") : tr("A recording to keep, with a few words if you like"), emoji: "🎙️", entry: "story" });
  if (pictures && !audio) out.push({ id: "post", label: pictures > 1 ? tr("Just the photos") : tr("Just the photo"), get desc() { return tr("A post (or a post each), with a few words if you like"); }, emoji: "📷" });
  if (child.expecting) {
    if (pictures && !audio) {
      out.push({ id: "bump", get label() { return tr("Bump photo"); }, get desc() { return tr("For the bump, week by week (and its video)"); }, emoji: "🤰" });
      out.push({ id: "ultrasound", get label() { return tr("Ultrasound picture"); }, get desc() { return tr("Kept with the scans, by week"); }, emoji: "🩻" });
    }
    out.push({ id: "milestone", get label() { return tr("Pregnancy milestone"); }, get desc() { return tr("The first kick, the gender reveal…"); }, emoji: "⭐", entry: "milestone" });
    out.push({ id: "story", get label() { return tr("Story"); }, get desc() { return tr("Something to remember, in your words"); }, emoji: "📝", entry: "story" });
    return out;
  }
  out.push({ id: "story", get label() { return tr("Story"); }, get desc() { return tr("Something that happened, in your words"); }, emoji: "📝", entry: "story" });
  if (pet) {
    out.push({ id: "first", get label() { return tr("Trick or first"); }, get desc() { return tr("A new trick, or a first time"); }, emoji: "🎓", entry: "first" });
    out.push({ id: "health", get label() { return tr("Health"); }, get desc() { return tr("A vet visit, a vaccination, a treatment"); }, emoji: "🩺", entry: "health" });
    if (!audio) out.push({ id: "measure", get label() { return tr("Weight"); }, get desc() { return tr("On the scales, with a photo"); }, emoji: "⚖️", entry: "measure" });
    return out;
  }
  out.push({ id: "first", get label() { return tr("First"); }, get desc() { return tr("The first time they…"); }, emoji: "✨", entry: "first" });
  out.push({ id: "last", get label() { return tr("Last"); }, get desc() { return tr("The last time they…"); }, emoji: "🌙", entry: "last" });
  out.push({ id: "milestone", get label() { return tr("Milestone"); }, get desc() { return tr("Walking, talking, a first tooth…"); }, emoji: "⭐", entry: "milestone" });
  if (!audio) out.push({ id: "measure", get label() { return tr("Growth"); }, get desc() { return tr("Height and weight, with a photo"); }, emoji: "📏", entry: "measure" });
  out.push({ id: "health", get label() { return tr("Health"); }, get desc() { return tr("A check-up, a vaccination, being poorly"); }, emoji: "🩺", entry: "health" });
  return out;
}

/** The date a single memory made from the files starts on: the earliest file date, never before what the profile allows, never in the future. */
export function startDate(items: Pick<SharedItem, "date">[], earliest: string, today: string): string {
  const d = items.map((i) => i.date).filter((x): x is string => !!x).sort()[0] ?? today;
  return d < earliest ? earliest : d > today ? today : d;
}

/** The kinds of file that can be shared in (anything else is left out, and the person is told why). */
export const SHAREABLE = "photos, videos and sound recordings";
