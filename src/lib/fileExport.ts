import { requireNativeModule } from "expo";

/**
 * Saving and sending finished files through Android itself (modules/file-export): the "Save as" dialog, which can save into Downloads or
 * Google Drive, and a share menu that doesn't wait for an answer. Null in a build made before the module existed (the older way is used then).
 */
interface NativeFileExport {
  createDocument(fileName: string, mimeType: string): Promise<string | null>;
  copyInto(source: string, destination: string): Promise<boolean>;
  deleteDocument(uri: string): Promise<boolean>;
  share(path: string, mimeType: string, title: string): void;
}

let cached: NativeFileExport | null | undefined;
export function fileExport(): NativeFileExport | null {
  if (cached === undefined) {
    try {
      cached = requireNativeModule<NativeFileExport>("FileExport");
    } catch {
      cached = null;
    }
  }
  return cached ?? null;
}
