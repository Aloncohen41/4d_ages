import { toISO } from "./date";

/*
 * The day a photo or video was taken, read from the file itself. The photo picker doesn't always pass the EXIF on (and videos have none),
 * so without this a picked file was dated today. Photos (JPEG, HEIC) keep their date as EXIF text ("2024:05:17 10:11:12"); videos (MP4, MOV)
 * keep the recording time in the movie header ("mvhd"), which can sit at the start or the end of the file.
 * The parsers are pure, for tests; readFileDate reads only the start and end of the file.
 */

const plausible = (iso: string, today: string) => iso >= "1990-01-01" && iso <= today;

/** The earliest EXIF date-time in these bytes (the moment it was taken; a later one is usually when it was edited). */
export function exifDateIn(bytes: Uint8Array, today: string): string | null {
  let best: string | null = null;
  // EXIF dates are plain ASCII: 19 characters, "YYYY:MM:DD HH:MM:SS"
  for (let i = 0; i + 19 <= bytes.length; i++) {
    if (bytes[i + 4] !== 58 || bytes[i + 7] !== 58 || bytes[i + 10] !== 32 || bytes[i + 13] !== 58 || bytes[i + 16] !== 58) continue; // ':' ':' ' ' ':' ':'
    let s = "";
    for (let k = 0; k < 19; k++) s += String.fromCharCode(bytes[i + k]);
    const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) \d{2}:\d{2}:\d{2}$/);
    if (!m) continue;
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    if (Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 31 || !plausible(iso, today)) continue;
    if (!best || iso < best) best = iso;
  }
  return best;
}

/** A video's recording date, from its movie header ("mvhd": seconds since 1 January 1904, in UTC), as a local date. */
export function videoDateIn(bytes: Uint8Array, today: string): string | null {
  for (let i = 0; i + 20 <= bytes.length; i++) {
    if (bytes[i] !== 0x6d || bytes[i + 1] !== 0x76 || bytes[i + 2] !== 0x68 || bytes[i + 3] !== 0x64) continue; // "mvhd"
    const version = bytes[i + 4];
    const at = i + 8;
    const seconds = version === 1
      ? (bytes[at] * 2 ** 56 + bytes[at + 1] * 2 ** 48 + bytes[at + 2] * 2 ** 40 + bytes[at + 3] * 2 ** 32 + ((bytes[at + 4] << 24) >>> 0) + (bytes[at + 5] << 16) + (bytes[at + 6] << 8) + bytes[at + 7])
      : ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
    if (!seconds) continue; // not set
    const iso = toISO(new Date((seconds - 2082844800) * 1000)); // 1904 → 1970
    if (plausible(iso, today)) return iso;
  }
  return null;
}

const HEAD = 256 * 1024;
const TAIL = 512 * 1024;

/** The date a picked file was taken, from inside it, or null. Never throws. */
export function readFileDate(uri: string, kind: "photo" | "video", today: string): string | null {
  try {
    // required here (not at the top) so the parsers above can be tested without the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require("expo-file-system") as typeof import("expo-file-system");
    const handle = new File(uri).open();
    try {
      const size = handle.size ?? 0;
      handle.offset = 0;
      const head = handle.readBytes(Math.min(HEAD, size || HEAD));
      if (kind === "photo") return exifDateIn(head, today);
      const fromHead = videoDateIn(head, today);
      if (fromHead || size <= HEAD) return fromHead;
      handle.offset = Math.max(0, size - TAIL); // the header is often at the end of a phone video
      return videoDateIn(handle.readBytes(Math.min(TAIL, size)), today);
    } finally {
      handle.close();
    }
  } catch {
    return null;
  }
}
