/*
 * The website's Save and Share for a made file (a video): Save downloads it under its proper name; Share opens the device's share menu
 * where the browser can share files (phones, mostly), and otherwise downloads it too.
 */
export function downloadFile(uri: string, fileName: string) {
  const a = document.createElement("a");
  a.href = uri;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function shareFile(uri: string, fileName: string, mime: string): Promise<"shared" | "downloaded"> {
  try {
    const blob = await (await fetch(uri)).blob();
    const file = new File([blob], fileName, { type: mime || blob.type });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: fileName.replace(/\.\w+$/, "") });
      return "shared";
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "shared"; // closed the share menu
  }
  downloadFile(uri, fileName);
  return "downloaded";
}
