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
}

/** "save": Android's save dialog (Downloads, Google Drive, any folder) and the PDF is saved there. "share": the share menu (WhatsApp, email, Drive…). */
export type BookDestination = "save" | "share";

/** Prints the book to a PDF at exactly the chosen page size, with its proper name. Returns the file's uri. */
async function printBook(i: BookInput, onProgress?: (text: string) => void): Promise<{ uri: string; fileName: string }> {
  const size = sizeById(i.size);
  const plan = planBook(i.child, i.memories, size, { family: i.family, intro: i.intro, classics: i.classics, siblings: i.siblings });
  // every picture made just large enough for where it's printed, within a total the phone can print in one go (see printSizes);
  // one at a time, so memory stays low. A picture that can't be read leaves its frame empty rather than stopping the book.
  const sizes = printSizes(plan, size);
  const loaded = new Map<string, string | null>();
  let done = 0;
  for (const [u, px] of sizes) {
    onProgress?.(`Preparing pictures: ${++done} of ${sizes.size}`);
    loaded.set(u, await shrunkBase64(u, px, PRINT_QUALITY).catch(() => null));
  }
  onProgress?.("Making the PDF…");
  let html: string | null = buildBookHtml({ ...i, plan, size, image: (u) => loaded.get(u) ?? null, mode: "print" });
  loaded.clear();
  const M = bookMetrics(size);
  // the page size, in PDF points: exactly the chosen print size (to the nearest point, 0.35 mm)
  let uri: string;
  try {
    uri = (await Print.printToFileAsync({ html, width: M.w, height: M.h })).uri;
  } catch (e) {
    throw new Error(`The phone couldn't make the PDF (${e instanceof Error ? e.message : String(e)}). Try a smaller page size, or fewer posts (Choose posts).`);
  } finally {
    html = null;
  }
  const fileName = bookFileName(i); // e.g. "Maya Classic Album By 4D-Ages.pdf" instead of a random temporary name
  return { uri: withFriendlyName(uri, fileName), fileName };
}

const bookFileName = (i: BookInput) => albumFileName([i.child, ...(i.siblings ?? [])].map((k) => k.name).join(" & "), i.style);

/**
 * Exports the book. Saving asks for the folder first (so nothing is built if you change your mind), then writes the PDF there.
 * Returns where it went: "saved", "shared", or "cancelled" when no folder was picked.
 */
export async function exportBook(i: BookInput, to: BookDestination = "share", onProgress?: (text: string) => void): Promise<"saved" | "shared" | "cancelled"> {
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
