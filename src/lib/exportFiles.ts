import { File, Paths } from "expo-file-system";

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
