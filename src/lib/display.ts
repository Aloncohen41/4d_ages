import { MediaItem, MediaKind } from "./types";

/** One line of text for a card: the title and description together. */
export function blurb(p: { title?: string; description: string }): string {
  if (p.title && p.description) return `${p.title} — ${p.description}`;
  return p.title || p.description || "";
}

/** Sort key: date, then time of day when there is one. */
export const byMoment = (a: { date: string; time?: string }, b: { date: string; time?: string }) =>
  a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || "");

/** What to draw for a memory: the picture, and whether it is really a video (drawn with a play badge). */
export interface Cover {
  uri: string;
  kind: MediaKind;
  video?: boolean; // a still frame standing in for a video
}

/**
 * The picture a card should lead with. Media is in the order you set, so the first item that can be shown wins:
 * a photo, or a video's chosen thumbnail. A video with no thumbnail yet is only used if there is nothing better.
 */
export function coverOf(media?: MediaItem[]): Cover | null {
  for (const m of media || []) {
    if (m.kind === "photo" && m.uri) return { uri: m.uri, kind: "photo" };
    if (m.kind === "video" && m.thumb) return { uri: m.thumb, kind: "photo", video: true };
  }
  const v = media?.find((m) => m.kind === "video" && m.uri);
  return v ? { uri: v.uri, kind: "video" } : null;
}

/** Every file a memory's media keeps on the phone (pictures, videos and chosen video thumbnails). */
export const filesOf = (media: MediaItem[]) => media.flatMap((m) => [m.uri, m.thumb]).filter((x): x is string => !!x);
