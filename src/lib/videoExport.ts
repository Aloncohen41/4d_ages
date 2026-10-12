import { requireNativeModule } from "expo";
import { Place } from "./places";
import { journeySlides } from "./journey";

import { Child, PALETTES } from "./types";
import { Slide } from "./slides";
import { Theme } from "../theme";
import { ageLong, ageShort, formatDate, todayISO } from "./date";
import { MusicId, VideoTemplate, musicFile } from "./videoStyles";
import { cardMs } from "./videoEvents";

interface NativeVideo {
  exportSlideshow(json: string): Promise<string>;
  videoDuration(uri: string): Promise<number>;
  cancel(): void;
  saveToGallery(path: string, name: string): Promise<string>;
  addListener(event: "onProgress", cb: (e: { progress: number }) => void): { remove: () => void };
}

let cached: NativeVideo | null | undefined;
function native(): NativeVideo | null {
  if (cached === undefined) {
    try {
      cached = requireNativeModule<NativeVideo>("VideoExport");
    } catch {
      cached = null; // app hasn't been rebuilt with the module yet
    }
  }
  return cached ?? null;
}

export const isVideoExportAvailable = () => native() !== null;

export type VideoFormat = "square" | "vertical";
export type VideoQuality = "720" | "1080";

export interface GrowVideoOptions {
  speed: number; // 0.5, 1, 2, 4 — same scale as the in-app player
  format: VideoFormat;
  quality: VideoQuality;
  intro: boolean;
  title: string;
  subtitle: string;
  /** A picture for the title card (the video's thumbnail). Omitted = the plain title card. */
  cover?: string;
  /** A pet's video can end with "In loving memory" and these words. */
  memorial?: string;
  /** Where each long clip starts (ms), by slide id: the 30 seconds chosen. Others start at the beginning. */
  clipStarts?: Record<string, number>;
  /** Each clip's length (ms), by slide id, when known. */
  clipLengths?: Record<string, number>;
  /** The look (see videoStyles.ts); Classic when not given. */
  template?: VideoTemplate;
  /** The music, and (filled in when the video is made) its file. */
  music?: MusicId;
  musicUri?: string;
  /** Whether the videos in it keep their own sound (the music goes quieter under it). On unless turned off. */
  clipSound?: boolean;
  /** Cards of words (from stories, or written for the video), each shown at its date among the pictures. */
  cards?: { id: string; date: string; text: string; kicker?: string }[];
}

/** The most of any one video that goes into a made video. */
export const CLIP_MAX_MS = 30_000;
/** How long a clip plays in the video: the whole of a short one, 30 seconds of a long one (from where it was chosen to start). */
export const clipPlays = (lengthMs: number | undefined, startMs = 0) => (lengthMs ? Math.max(0, Math.min(CLIP_MAX_MS, lengthMs - startMs)) : CLIP_MAX_MS);
/** Where 30 seconds of a long clip may start: never so late that there's less than 30 seconds left. */
export const clampClipStart = (startMs: number, lengthMs: number) => Math.max(0, Math.min(Math.round(startMs), Math.max(0, lengthMs - CLIP_MAX_MS)));

/** A video's length in milliseconds (0 when it can't be read, or on a phone without the module). */
export async function videoLength(uri: string): Promise<number> {
  const mod = native();
  if (!mod || !uri) return 0;
  try {
    return await mod.videoDuration(uri);
  } catch {
    return 0;
  }
}

export const BASE_MS = 2400; // time per photo at 1×, same as the in-app player
export const INTRO_MS = 2000;

export const secondsPerPhoto = (speed: number) => BASE_MS / speed / 1000;
/** The video's length: each photo at the speed chosen, each clip for as long as it plays (see clipPlays), and the title card. */
export const estimateSeconds = (photos: number, speed: number, intro: boolean, clipMs = 0) => photos * secondsPerPhoto(speed) + clipMs / 1000 + (intro ? INTRO_MS / 1000 : 0);

export function dimensions(format: VideoFormat, quality: VideoQuality): [number, number] {
  const base = quality === "1080" ? 1080 : 720;
  return format === "square" ? [base, base] : [base, Math.round((base * 16) / 9 / 2) * 2];
}

/**
 * What the native encoder is sent. The cover is left OUT when there isn't one — never `null`: Android's JSON reader turns a null into the
 * literal text "null", which would then be read as a (missing) picture.
 */
export function slideshowPayload(child: Child, usable: Slide[], theme: Theme, opts: GrowVideoOptions) {
  const [width, height] = dimensions(opts.format, opts.quality);
  const per = BASE_MS / opts.speed;
  // the pictures and the cards of words, in date order (a card after the pictures of its day)
  type Entry = { at: string; order: number; item: Record<string, unknown> };
  const pictures: Entry[] = usable.map((p, k) => {
    const [bg, hill] = PALETTES[p.palette] || PALETTES.peach;
    // a video plays (30 seconds at most, from where it was chosen to start); its picture stands in if the phone can't play it
    const start = p.clip ? clampClipStart(opts.clipStarts?.[p.id] ?? 0, opts.clipLengths?.[p.id] ?? Infinity) : 0;
    const clip = p.clip ? { clip: p.clip, clipStartMs: start, clipMs: clipPlays(opts.clipLengths?.[p.id], start) } : {};
    return { at: p.date, order: k, item: { uri: p.uri, emoji: p.emoji, bg, hill, age: ageShort(child.birth, p.date), date: formatDate(p.date), caption: p.caption, ...clip } };
  });
  const cards: Entry[] = (opts.cards ?? []).filter((c) => c.text.trim()).map((c, k) => ({
    at: c.date, order: usable.length + k, item: { card: true, text: c.text.trim(), kicker: c.kicker ?? "", ms: cardMs(c.text.trim(), per) },
  }));
  const sequence = cards.length ? [...pictures, ...cards].sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order) : pictures;
  return {
    width,
    height,
    fps: 30,
    template: opts.template ?? "classic",
    cardBg: theme.bg,
    cardInk: theme.ink,
    accent: theme.accent ?? theme.ink,
    clipSound: opts.clipSound !== false,
    ...(opts.musicUri ? { music: opts.musicUri } : {}),
    perMs: per,
    fadeMs: Math.min(1300, Math.max(250, per * 0.55)),
    driftMs: per * 1.6,
    introMs: opts.intro ? INTRO_MS : 0,
    intro: opts.intro ? { emoji: child.emoji, title: opts.title, subtitle: opts.subtitle, bg: theme.bg, ink: theme.ink, ...(opts.cover ? { cover: opts.cover } : {}) } : null,
    items: [
      ...sequence.map((e) => e.item),
      // the ending, when chosen for a pet: "In loving memory", with a rainbow and their words
      ...(opts.memorial != null ? [{ uri: null, emoji: "🌈", bg: theme.bg, hill: theme.accent, age: "In loving memory", date: "", caption: opts.memorial || "Forever in our hearts" }] : []),
    ],
  };
}

/** Renders the slideshow to an MP4 and returns its file:// URI. */
export async function createGrowVideo(
  child: Child,
  slides: Slide[],
  theme: Theme,
  opts: GrowVideoOptions,
  onProgress: (p: number) => void
): Promise<string> {
  const mod = native();
  if (!mod) throw new Error("Video export needs the app to be rebuilt once (run: npm run android).");
  const usable = slides.filter((s) => !!s.uri || !!s.clip);
  if (!usable.length) throw new Error("There are no photos to put in a video yet.");

  const musicUri = opts.music ? (await musicFile(opts.music).catch(() => null)) ?? undefined : undefined; // no music rather than no video
  const payload = slideshowPayload(child, usable, theme, { ...opts, musicUri });

  const sub = mod.addListener("onProgress", (e) => onProgress(e.progress));
  try {
    const path = await mod.exportSlideshow(JSON.stringify(payload));
    return path.startsWith("file://") ? path : `file://${path}`;
  } finally {
    sub.remove();
  }
}

/**
 * The journey, year by year, as a video: the world map, a slide a year, the places pinned as they were visited (see journey.ts). Each year
 * stays a little longer than a photo, so the pins have time to pop in.
 */
export async function createJourneyVideo(pet: Child, places: Place[], theme: Theme, format: VideoFormat, onProgress: (p: number) => void, memorial?: string): Promise<string> {
  const mod = native();
  if (!mod) throw new Error("Video export needs the app to be rebuilt once (run: npm run android).");
  const slides = journeySlides(places);
  if (slides.length < 1) throw new Error("Add a place or two first.");
  // loaded here, not at the top, so the rest of this file can be tested without the phone's libraries
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Asset } = require("expo-asset") as typeof import("expo-asset");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const map = Asset.fromModule(require("../../assets/world-map.png"));
  await map.downloadAsync();
  const mapUri = map.localUri ?? map.uri;
  const [width, height] = dimensions(format, "720");
  const per = 3600;
  const payload = {
    width, height, fps: 30, perMs: per, fadeMs: 700, driftMs: per,
    introMs: INTRO_MS,
    intro: { emoji: pet.emoji, title: `${pet.name}'s adventures`, subtitle: `${places.length} ${places.length === 1 ? "place" : "places"}, year by year`, bg: theme.bg, ink: theme.ink },
    items: [
      ...slides.map((s) => ({ uri: mapUri, emoji: "🗺️", bg: "#ECF1F3", hill: theme.accent, age: s.year, date: s.count, caption: s.names, pins: s.pins })),
      // an "In loving memory" ending, when chosen
      ...(memorial ? [{ uri: null, emoji: "🌈", bg: theme.bg, hill: theme.accentSoft, age: "In loving memory", date: "", caption: memorial }] : []),
    ],
  };
  const sub = mod.addListener("onProgress", (e) => onProgress(e.progress));
  try {
    const path = await mod.exportSlideshow(JSON.stringify(payload));
    return path.startsWith("file://") ? path : `file://${path}`;
  } finally {
    sub.remove();
  }
}

export function cancelGrowVideo() {
  native()?.cancel();
}

/** Saves the finished video to the phone's gallery under this file name (see fileNames.ts). */
export async function saveVideoToGallery(uri: string, fileName: string): Promise<string> {
  const mod = native();
  if (!mod) throw new Error("Video export isn't available yet.");
  return mod.saveToGallery(uri, fileName);
}

export const defaultTitle = (child: Child) => `${child.name}'s story`;
export const defaultSubtitle = (child: Child, count: number) => `from day one to ${ageLong(child.birth, todayISO())} · ${count} memories`;
