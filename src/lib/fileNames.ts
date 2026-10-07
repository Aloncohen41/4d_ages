import { APP_NAME } from "../brand";

/** "4D Ages" → "4D-Ages": how the brand reads inside a file name. */
export const FILE_BRAND = APP_NAME.replace(/\s+/g, "-");

/** Makes any text safe to use in a file name on every phone and share target: no slashes, colons, emoji or control characters. */
export function cleanPart(text: string, max = 40): string {
  return (text || "")
    .replace(/[\u2012-\u2015]/g, "-") // en / em dashes → hyphen
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, " ") // characters no file name may contain
    .replace(/[\ud800-\udfff\u200d\ufe0f]/g, "") // emoji and their joiners
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "") // no leading / trailing dots
    .slice(0, max)
    .trim();
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);

/** "Maya Classic Album By 4D-Ages.pdf" — the baby book, named by its style. */
export function albumFileName(childName: string, style: string): string {
  return `${cleanPart(childName) || "Baby"} ${cleanPart(cap(style), 20) || "Classic"} Album By ${FILE_BRAND}.pdf`;
}

/** "Maya 1-2 years Video By 4D-Ages.mp4" — a memory video, named by the stretch of life it shows. */
export function videoFileName(childName: string, label: string): string {
  return `${cleanPart(childName) || "Baby"} ${cleanPart(label, 40) || "Story"} Video By ${FILE_BRAND}.mp4`;
}
