/*
 * First foods for the doctor or health visitor: one page with the allergens given (when first and last), and every reaction with what
 * happened. Made as a PDF on the phone (shared like a book) and printed to PDF on the website.
 */
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { Child, FoodTry } from "./types";
import { fileExport } from "./fileExport";
import { withFriendlyName } from "./exportFiles";
import { onWeb } from "./onWeb";
import { foodSummaryHtml, foodSummaryName } from "./foodSummaryPage";

export { foodSummaryHtml, foodSummaryName };

/** Shares the summary as a PDF (the phone), or opens the print window to save it as one (the website). */
export async function shareFoodSummary(child: Child, tries: FoodTry[], today: string): Promise<void> {
  const html = foodSummaryHtml(child, tries, today);
  const name = foodSummaryName(child);
  if (onWeb) {
    const frame = document.createElement("iframe");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(frame);
    frame.contentDocument!.open();
    frame.contentDocument!.write(html.replace(/<title>[^<]*<\/title>/, `<title>${name.replace(/\.pdf$/, "")}</title>`));
    frame.contentDocument!.close();
    const before = document.title;
    document.title = name.replace(/\.pdf$/, "");
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    document.title = before;
    setTimeout(() => frame.remove(), 60_000);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const named = await withFriendlyName(uri, name);
  const fx = fileExport();
  if (fx) return fx.share(named, "application/pdf", name.replace(/\.pdf$/, ""));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(named, { mimeType: "application/pdf", dialogTitle: name.replace(/\.pdf$/, "") });
}
