import { Directory, File, Paths } from "expo-file-system";

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
      throw new Error(`Couldn't save to that folder (${e instanceof Error ? e.message : String(e)}). Try Downloads, or use Share PDF.`);
    }
  };
}

/**
 * Gives an exported file its proper name before it is shared. Without this the recipient sees the random temporary name the phone made
 * ("a3f9-77c1.pdf"). Returns the new file's uri; if anything goes wrong it quietly falls back to the original file, so exporting never fails over a name.
 */
export function withFriendlyName(uri: string, fileName: string): string {
  try {
    const source = new File(uri);
    const dest = new File(Paths.cache, fileName);
    if (dest.exists) dest.delete();
    source.copy(dest);
    try { source.delete(); } catch { /* the temporary original is cleaned up by the phone anyway */ }
    return dest.uri;
  } catch {
    return uri;
  }
}
