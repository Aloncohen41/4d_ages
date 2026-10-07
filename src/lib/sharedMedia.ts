import { SharedItem } from "./types";
import { dateFromFileName, exifToISO, toHHMM, toISO, todayISO } from "./date";

/** What the Android side hands over for each shared file. */
export interface RawShared {
  uri: string;
  mime: string;
  name: string;
  size: number;
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
export function normalizeShared(raw: RawShared): SharedItem {
  const kind = raw.mime.startsWith("video/") ? "video" : "photo";
  let date: string | undefined;
  let time: string | undefined;

  const fromExif = exifToISO(raw.exif);
  if (kind === "photo" && plausible(fromExif)) {
    date = fromExif;
    const t = raw.exif?.match(/\s(\d{2}):(\d{2})/);
    if (t && !(t[1] === "00" && t[2] === "00" && raw.exif?.endsWith("00:00:00"))) time = `${t[1]}:${t[2]}`;
  } else if (kind === "video") {
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

/** "3 photos · 1 video · taken Jun 3 – Jun 5, 2026" */
export function summarize(items: SharedItem[], fmt: (iso: string) => string): string {
  const photos = items.filter((i) => i.kind === "photo").length;
  const videos = items.length - photos;
  const parts = [photos ? `${photos} photo${photos === 1 ? "" : "s"}` : "", videos ? `${videos} video${videos === 1 ? "" : "s"}` : ""].filter(Boolean);
  const dates = items.map((i) => i.date).filter(Boolean).sort() as string[];
  if (dates.length) parts.push(dates[0] === dates[dates.length - 1] ? `taken ${fmt(dates[0])}` : `taken ${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`);
  return parts.join(" · ");
}
