/*
 * How a made video looks and sounds: its template (drawn on the phone, see SlideshowEncoder.kt) and its music. Every track is in the public
 * domain (CC0), from the FreePD.com collection (kept at archive.org/details/freepd since the site closed), so it can be shared anywhere:
 * WhatsApp, Instagram, YouTube. See assets/music/CREDITS.txt.
 */

export type VideoTemplate = "classic" | "story" | "snapshots" | "journal";
export type MusicId = "none" | "ukulele" | "stars" | "garden" | "celebrate";

export interface TemplateInfo { id: VideoTemplate; label: string; desc: string; music: MusicId; emoji: string }

export const VIDEO_TEMPLATES: TemplateInfo[] = [
  { id: "classic", label: "Classic", desc: "The whole photo over a soft blur, their age large", music: "stars", emoji: "🎞️" },
  { id: "story", label: "Story", desc: "Full-screen photos that slowly drift, the words large, like a short film", music: "stars", emoji: "🎬" },
  { id: "snapshots", label: "Snapshots", desc: "Instant photos landing on a pile, with the words written on them", music: "ukulele", emoji: "📸" },
  { id: "journal", label: "Journal", desc: "Each photo on paper, with its words underneath", music: "garden", emoji: "📔" },
];
export const templateInfo = (id?: string) => VIDEO_TEMPLATES.find((x) => x.id === id) ?? VIDEO_TEMPLATES[0];

export interface MusicInfo { id: MusicId; label: string; mood: string; title?: string }

/** The tracks, each for a feeling. `title` is the piece's own name (for the credits). */
export const MUSIC: MusicInfo[] = [
  { id: "stars", label: "Shining stars", mood: "Warm and hopeful", title: "Shining Stars" },
  { id: "ukulele", label: "Ukulele", mood: "Happy and playful", title: "Ukulele Song" },
  { id: "garden", label: "Magic garden", mood: "Light and dreamy, for the little ones", title: "Magic in the Garden" },
  { id: "celebrate", label: "Celebration", mood: "Birthdays and parties", title: "Celebration" },
  { id: "none", label: "No music", mood: "Only the videos' own sound" },
];
export const musicInfo = (id?: string) => MUSIC.find((x) => x.id === id) ?? MUSIC[0];

/** The music that suits an event: a party for a birthday, something happy for a day out or a trip, the template's own otherwise. */
export function musicFor(template: VideoTemplate, eventKind?: string, pet = false): MusicId {
  if (eventKind === "birthday") return "celebrate";
  if (eventKind === "trip" || eventKind === "day") return "ukulele";
  if (pet && template === "classic") return "ukulele";
  return templateInfo(template).music;
}

/** A track inside the app (for playing it, or copying it out). Loaded here, not at the top, so this file can be tested without the phone. */
export function musicModule(id: Exclude<MusicId, "none">): number {
  /* eslint-disable @typescript-eslint/no-require-imports */
  switch (id) {
    case "stars": return require("../../assets/music/stars.m4a");
    case "ukulele": return require("../../assets/music/ukulele.m4a");
    case "garden": return require("../../assets/music/garden.m4a");
    default: return require("../../assets/music/celebrate.m4a");
  }
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/** The music file, ready to be read by the encoder (copied out of the app the first time). Null for "No music". */
export async function musicFile(id: MusicId): Promise<string | null> {
  if (id === "none") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Asset } = require("expo-asset") as typeof import("expo-asset");
  const a = Asset.fromModule(musicModule(id));
  await a.downloadAsync();
  return a.localUri ?? a.uri;
}
