import { requireNativeModule } from "expo";
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
    items: usable.map((p) => {
      const [bg, hill] = PALETTES[p.palette] || PALETTES.peach;
      return { uri: p.uri, emoji: p.emoji, bg, hill, age: ageShort(child.birth, p.date), date: formatDate(p.date), caption: p.caption };
    }),
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
