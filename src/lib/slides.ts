import { Memory, MemoryType } from "./types";
import { blurb, byMoment, coverOf } from "./display";

/** One picture on screen in "Watch them grow" or in a made video. */
export interface Slide {
  id: string;
  memoryId: string;
  uri: string | null; // the picture file (a photo, or a video's thumbnail); null = illustrated (no picture)
  video: boolean; // a still frame standing in for a video clip
  clip?: string; // that video clip's file: it plays in a made video
  emoji: string;
  palette: string;
  date: string;
  time?: string;
  caption: string;
  type: MemoryType;
}

/**
 * Turn memories into slides, oldest first. The same picture file never appears twice.
 *  - default: one slide per memory (its main picture; illustrated memories keep their emoji art)
 *  - perMedia: one slide for every photo / video thumbnail inside the memories (for picking items one by one)
 */
export function slidesOf(memories: Memory[], opts: { perMedia?: boolean } = {}): Slide[] {
  const seen = new Set<string>();
  const out: Slide[] = [];
  const push = (s: Slide) => {
    if (s.uri) {
      if (seen.has(s.uri)) return;
      seen.add(s.uri);
    }
    out.push(s);
  };
  for (const m of [...memories].sort(byMoment)) {
    const base = { memoryId: m.id, emoji: m.emoji, palette: m.palette, date: m.date, time: m.time, caption: blurb(m), type: m.type };
    if (opts.perMedia) {
      for (const x of m.media) {
        const shown = x.kind === "photo" ? x.uri : x.thumb;
        if (shown) push({ ...base, id: `${m.id}:${x.id}`, uri: shown, video: x.kind === "video", ...(x.kind === "video" && x.uri ? { clip: x.uri } : {}) });
      }
      continue;
    }
    const c = coverOf(m.media);
    // the video behind the cover picture (the first photo or video), so it can play in a made video
    const first = m.media.find((x) => (x.kind === "photo" && x.uri) || (x.kind === "video" && x.thumb));
    const clip = first?.kind === "video" && first.uri ? { clip: first.uri } : {};
    if (c && c.kind === "photo") push({ ...base, id: m.id, uri: c.uri, video: !!c.video, ...clip });
    else if (!c && m.type !== "measure") push({ ...base, id: m.id, uri: null, video: false });
  }
  return out;
}

/** What PhotoView needs to draw a slide. */
export const slideView = (s: Slide) => ({ uri: s.uri ?? undefined, kind: "photo" as const, emoji: s.emoji, palette: s.palette });
