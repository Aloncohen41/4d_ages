import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Child, Memory, MilestoneDef, Relative, Tag } from "./types";
import { albumFileName } from "./fileNames";
import { saveToFolder, withFriendlyName } from "./exportFiles";
import { fileExport } from "./fileExport";
import { shrunkBase64 } from "./resize";
import { BookColour, BookStyle, BookSizeId, bookMetrics, planBook, sizeById } from "./bookPages";
import { buildBookHtml, printSizes } from "./bookHtml";
import { HeightUnit, WeightUnit } from "./growth";
import type { ClassicEntry } from "./classics";
import { onWeb } from "./onWeb";
import { mediaLink } from "./sync";

import { tr } from "./i18n";
export { BOOK_SIZES, BOOK_STYLES } from "./bookPages";
export { memoryHeading } from "./bookHtml";
export type { BookStyle, BookSizeId as BookSize } from "./bookPages";

/** The quality pictures are saved at for print: no visible difference on paper, about half the size of a camera JPEG. */
const PRINT_QUALITY = 0.75;

export interface BookInput {
  child: Child;
  defs: MilestoneDef[]; // the milestone catalogue (for names)
  memories: Memory[]; // the child's memories, every type
  style: BookStyle;
  colour?: BookColour;
  size: BookSizeId;
  relatives?: Relative[]; // so person tags print as names
  family?: Relative[]; // the child's family, in the parent's order (the family pages)
  classics?: ClassicEntry[]; // the child's filled-in Classics (the birth page and keepsake pages)
  siblings?: Child[]; // a book of brothers and sisters: the other children in it
  tags?: Tag[]; // the central tag list
  title?: string;
  subtitle?: string;
  intro?: boolean; // the cover, birth and family pages (default on)
  weightUnit?: WeightUnit;
  heightUnit?: HeightUnit;
  /** a pet's places, the world map picture, and the "In loving memory" page (see PlanOptions) */
  places?: import("./places").Place[];
  mapUri?: string;
  memorial?: { words: string; dates: string };
  together?: import("./bookPages").Together[];
}

/** "save": Android's save dialog (Downloads, Google Drive, any folder) and the PDF is saved there. "share": the share menu (WhatsApp, email, Drive…). */
export type BookDestination = "save" | "share";

/** Prints the book to a PDF at exactly the chosen page size, with its proper name. Returns the file's uri. */
async function printBook(i: BookInput, onProgress?: (text: string) => void): Promise<{ uri: string; fileName: string }> {
  const size = sizeById(i.size);
  const plan = planBook(i.child, i.memories, size, { family: i.family, intro: i.intro, classics: i.classics, siblings: i.siblings, places: i.places, mapUri: i.mapUri, memorial: i.memorial, together: i.together });
  // every picture made just large enough for where it's printed, within a total the phone can print in one go (see printSizes);
  // one at a time, so memory stays low. A picture that can't be read leaves its frame empty rather than stopping the book.
  const sizes = printSizes(plan, size);
  const loaded = new Map<string, string | null>();
  let done = 0;
  for (const [u, px] of sizes) {
    onProgress?.(tr("Preparing pictures: {0} of {1}", [++done, sizes.size]));
    loaded.set(u, await shrunkBase64(u, px, PRINT_QUALITY).catch(() => null));
  }
  onProgress?.(tr("Making the PDF…"));
  let html: string | null = buildBookHtml({ ...i, plan, size, image: (u) => loaded.get(u) ?? null, mode: "print" });
  loaded.clear();
  const M = bookMetrics(size);
  // the page size, in PDF points: exactly the chosen print size (to the nearest point, 0.35 mm)
  let uri: string;
  try {
    uri = (await Print.printToFileAsync({ html, width: M.w, height: M.h })).uri;
  } catch (e) {
    throw new Error(tr("The phone couldn't make the PDF ({0}). Try a smaller page size, or fewer posts (Choose posts).", [e instanceof Error ? e.message : String(e)]));
  } finally {
    html = null;
  }
  const fileName = bookFileName(i); // e.g. "Maya Classic Album By 4D-Ages.pdf" instead of a random temporary name
  return { uri: await withFriendlyName(uri, fileName), fileName };
}

const bookFileName = (i: BookInput) => albumFileName([i.child, ...(i.siblings ?? [])].map((k) => k.name).join(" & "), i.style);

/**
 * Exports the book. Saving asks for the folder first (so nothing is built if you change your mind), then writes the PDF there.
 * Returns where it went: "saved", "shared", or "cancelled" when no folder was picked.
 */
export async function exportBook(i: BookInput, to: BookDestination = "share", onProgress?: (text: string) => void): Promise<"saved" | "shared" | "cancelled"> {
  if (onWeb) return printOnWeb(i, onProgress);
  const fx = fileExport();
  if (fx && to === "save") {
    // the save dialog first (so nothing is built if you change your mind), then the PDF is copied into the file you chose
    const dest = await fx.createDocument(bookFileName(i), "application/pdf");
    if (!dest) return "cancelled";
    try {
      const { uri } = await printBook(i, onProgress);
      onProgress?.("Saving…");
      await fx.copyInto(uri, dest);
    } catch (e) {
      await fx.deleteDocument(dest).catch(() => false); // no empty file left behind
      throw e;
    }
    return "saved";
  }
  if (fx) {
    const { uri, fileName } = await printBook(i, onProgress);
    fx.share(uri, "application/pdf", fileName.replace(/\.pdf$/, ""));
    return "shared";
  }
  // a build without the file-export module: the folder picker and expo-sharing, as before
  if (to === "save") {
    const save = await saveToFolder("application/pdf");
    if (!save) return "cancelled";
    const { uri, fileName } = await printBook(i, onProgress);
    onProgress?.("Saving…");
    save(uri, fileName);
    return "saved";
  }
  const { uri, fileName } = await printBook(i, onProgress);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: fileName.replace(/\.pdf$/, ""), UTI: "com.adobe.pdf" });
  }
  return "shared";
}

/**
 * The website: the book opens in the browser's print window at its exact page size, where "Save as PDF" saves it (the file is named after the
 * book). Pictures are read straight from where they are (this browser, or the account), at full quality.
 */
async function printOnWeb(i: BookInput, onProgress?: (text: string) => void): Promise<"saved"> {
  const size = sizeById(i.size);
  const plan = planBook(i.child, i.memories, size, { family: i.family, intro: i.intro, classics: i.classics, siblings: i.siblings, places: i.places, mapUri: i.mapUri, memorial: i.memorial, together: i.together });
  // Every picture is read here, by the page itself, and handed to the print window ready to draw: the website keeps its pictures in the
  // browser's own storage, which the print window couldn't always read, so the book printed with empty frames. A picture that isn't in
  // this browser yet (added on the phone, not downloaded here) is read straight from the account instead.
  const pictures = await webPictures(i, [...printSizes(plan, size).keys()], onProgress);
  onProgress?.(tr("Opening the print window…"));
  const title = bookFileName(i).replace(/\.pdf$/, "");
  const html = buildBookHtml({ ...i, plan, size, image: (u) => (u ? (pictures.get(u) ?? null) : null), mode: "print" }).replace("<head>", `<head><title>${title.replace(/</g, "")}</title>`);
  const frame = document.createElement("iframe");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  // every picture loaded first, so none prints as an empty frame
  await Promise.all([...doc.images].map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(undefined); }))));
  const before = document.title;
  document.title = title; // the browser names the PDF after the page
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  document.title = before;
  setTimeout(() => { frame.remove(); pictures.forEach((u) => { if (u?.startsWith("blob:")) URL.revokeObjectURL(u); }); }, 60_000);
  return "saved";
}

/** The book's pictures, each as an address the print window can always draw (a picture held in the page), or null if it can't be read. */
async function webPictures(i: BookInput, wanted: string[], onProgress?: (text: string) => void): Promise<Map<string, string | null>> {
  const inAccount = new Map<string, string>(); // a picture's address here → where it's kept in the account
  for (const m of i.memories) for (const x of m.media) if (x.path && x.uri) inAccount.set(x.uri, x.path);
  for (const e of i.classics ?? []) for (const list of Object.values(e.photos)) for (const x of list) if (x.path && x.uri) inAccount.set(x.uri, x.path);
  const read = async (url: string): Promise<Blob | null> => {
    try {
      const r = await fetch(url);
      // (an address the website doesn't have comes back as the website's own page, not a picture)
      return r.ok && !/text\/html/.test(r.headers.get("content-type") || "") ? await r.blob() : null;
    } catch {
      return null;
    }
  };
  const out = new Map<string, string | null>();
  let n = 0;
  for (const u of wanted) {
    onProgress?.(tr("Preparing pictures: {0} of {1}", [++n, wanted.length]));
    if (u.startsWith("data:")) { out.set(u, u); continue; }
    let blob = await read(u);
    const path = inAccount.get(u);
    if (!blob && path) blob = await mediaLink(path).then(read).catch(() => null);
    out.set(u, blob ? URL.createObjectURL(blob) : null);
  }
  return out;
}
