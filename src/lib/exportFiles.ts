import { Directory, File, Paths } from "expo-file-system";

import { tr } from "./i18n";
/** The folder picked last time, so the folder picker opens there next time. */
let lastFolder: string | undefined;

/**
 * Lets you pick a folder on the phone (Downloads, Documents, a memory card…) and returns a function that copies a finished file into it, under
 * its proper name. Returns null if you close the picker without choosing. A file of the same name already there is kept: the phone numbers
 * the new one ("… (1).pdf").
 */
export async function saveToFolder(mimeType: string): Promise<((uri: string, fileName: string) => void) | null> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync(lastFolder);
  } catch {
    return null; // closed without choosing
  }
  if (!folder) return null;
  lastFolder = folder.uri;
  return (uri, fileName) => {
    try {
      const out = folder.createFile(fileName, mimeType);
      out.write(new File(uri).bytesSync());
    } catch (e) {
      throw new Error(tr("Couldn't save to that folder ({0}). Try Downloads, or use Share PDF.", [e instanceof Error ? e.message : String(e)]));
    }
  };
}

/**
 * Gives an exported file its proper name before it is shared. Without this the recipient sees the random temporary name the phone made
 * ("a3f9-77c1.pdf"). Returns the new file's uri; if anything goes wrong it quietly falls back to the original file, so exporting never fails over a name.
 */
export async function withFriendlyName(uri: string, fileName: string): Promise<string> {
  try {
    const source = new File(uri);
    const dest = new File(Paths.cache, fileName);
    if (dest.exists) dest.delete();
    // the copy runs in the background: it must finish before the original is removed, or the named file is missing or cut short
    await source.copy(dest);
    if (!dest.exists || (source.size ?? 0) !== (dest.size ?? -1)) return uri; // didn't copy whole: keep the original name rather than a broken file
    try { source.delete(); } catch { /* the temporary original is cleaned up by the phone anyway */ }
    return dest.uri;
  } catch {
    return uri;
  }
}
