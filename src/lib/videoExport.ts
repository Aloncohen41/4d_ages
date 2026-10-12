import { requireNativeModule } from "expo";
import { Place } from "./places";
import { journeySlides } from "./journey";

import { Child, PALETTES } from "./types";
import { Slide } from "./slides";
import { Theme } from "../theme";
import { ageLong, ageShort, formatDate, todayISO } from "./date";

interface NativeVideo {
  exportSlideshow(json: string): Promise<string>;
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
}

export const BASE_MS = 2400; // time per photo at 1×, same as the in-app player
export const INTRO_MS = 2000;

export const secondsPerPhoto = (speed: number) => BASE_MS / speed / 1000;
export const estimateSeconds = (photos: number, speed: number, intro: boolean) => photos * secondsPerPhoto(speed) + (intro ? INTRO_MS / 1000 : 0);

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
  return {
    width,
    height,
    fps: 30,
    perMs: per,
    fadeMs: Math.min(1300, Math.max(250, per * 0.55)),
    driftMs: per * 1.6,
    introMs: opts.intro ? INTRO_MS : 0,
    intro: opts.intro ? { emoji: child.emoji, title: opts.title, subtitle: opts.subtitle, bg: theme.bg, ink: theme.ink, ...(opts.cover ? { cover: opts.cover } : {}) } : null,
    items: [
      ...usable.map((p) => {
        const [bg, hill] = PALETTES[p.palette] || PALETTES.peach;
        return { uri: p.uri, emoji: p.emoji, bg, hill, age: ageShort(child.birth, p.date), date: formatDate(p.date), caption: p.caption };
      }),
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
  const usable = slides.filter((s) => !!s.uri);
  if (!usable.length) throw new Error("There are no photos to put in a video yet.");

  const payload = slideshowPayload(child, usable, theme, opts);

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
