import { SharedItem } from "./types";
import { dateFromFileName, exifToISO, toHHMM, toISO, todayISO } from "./date";

import { tr } from "./i18n";
/** What the Android side hands over for each shared file. */
export interface RawShared {
  uri: string;
  mime: string;
  name: string;
  size: number;
  /** A file that couldn't come in (not a photo, video or recording, or unreadable): its name, so the person can be told. */
  skipped?: string;
  /** Words shared with the files (a caption). */
  text?: string;
  exif?: string | null; // "2024:03:15 10:15:00"
  videoDate?: string | null; // "20240315T101500.000Z" (UTC)
}

const plausible = (iso?: string | null): iso is string => !!iso && iso >= "1990-01-01" && iso <= todayISO();

/** Date and time a video was recorded, converted from UTC to the phone's local time. */
export function parseVideoDate(s?: string | null): { date: string; time: string } | null {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  if (isNaN(d.getTime())) return null;
  return { date: toISO(d), time: toHHMM(d) };
}

/**
 * Keep the original date where the file has one: EXIF for photos, recording date for videos,
 * otherwise a date in the file name (IMG_20240315_…, PXL_…, WhatsApp "IMG-20240315-WA…").
 */
/** What came in from one share: the files, the ones left out, and any words shared with them. */
export function splitShared(raw: RawShared[]): { items: SharedItem[]; skipped: string[]; text?: string } {
  const items = raw.filter((r) => r.uri && !r.skipped && !r.text).map(normalizeShared);
  const skipped = raw.filter((r) => r.skipped).map((r) => r.skipped as string);
  const text = raw.find((r) => r.text)?.text;
  return { items, skipped, ...(text ? { text } : {}) };
}

/** "These couldn't be added: report.pdf. Only photos, videos and sound recordings can." */
export function skippedMessage(skipped: string[]): string {
  if (!skipped.length) return "";
  const named = skipped.filter((s) => s !== "a file");
  const what = named.length ? named.slice(0, 3).join(", ") + (skipped.length > 3 ? tr(" and {0} more", [skipped.length - 3]) : "") : skipped.length === 1 ? tr("One file") : `${skipped.length} files`;
  return tr("{0}. Only photos, videos and sound recordings can be added.", [named.length ? `Couldn't add ${what}` : `${what} couldn't be added`]);
}

export function normalizeShared(raw: RawShared): SharedItem {
  const kind = raw.mime.startsWith("video/") ? "video" : raw.mime.startsWith("audio/") || raw.mime === "application/ogg" ? "audio" : "photo";
  let date: string | undefined;
  let time: string | undefined;

  const fromExif = exifToISO(raw.exif);
  if (kind === "photo" && plausible(fromExif)) {
    date = fromExif;
    const t = raw.exif?.match(/\s(\d{2}):(\d{2})/);
    if (t && !(t[1] === "00" && t[2] === "00" && raw.exif?.endsWith("00:00:00"))) time = `${t[1]}:${t[2]}`;
  } else {
    // a video's (or a recording's) date, from the file
    const v = parseVideoDate(raw.videoDate);
    if (v && plausible(v.date)) {
      date = v.date;
      time = v.time;
    }
  }
  if (!date) {
    const fromName = dateFromFileName(raw.name);
    if (plausible(fromName)) date = fromName;
  }
  return { uri: raw.uri.startsWith("file://") ? raw.uri : `file://${raw.uri}`, kind, mime: raw.mime, name: raw.name, size: raw.size, date, time };
}

/** "3 photos · 1 video · 1 recording · taken Jun 3 – Jun 5, 2026" */
export function summarize(items: SharedItem[], fmt: (iso: string) => string): string {
  const photos = items.filter((i) => i.kind === "photo").length;
  const videos = items.filter((i) => i.kind === "video").length;
  const audio = items.filter((i) => i.kind === "audio").length;
  const parts = [photos ? `${photos} photo${photos === 1 ? "" : "s"}` : "", videos ? `${videos} video${videos === 1 ? "" : "s"}` : "", audio ? `${audio} recording${audio === 1 ? "" : "s"}` : ""].filter(Boolean);
  const dates = items.map((i) => i.date).filter(Boolean).sort() as string[];
  if (dates.length) parts.push(dates[0] === dates[dates.length - 1] ? `taken ${fmt(dates[0])}` : `taken ${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`);
  return parts.join(" · ");
}
