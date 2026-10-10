import { Image } from "react-native";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import { persistFile, deleteFile } from "./media";

/** Width and height of a picture on the phone (0×0 if it can't be read). */
export const sizeOf = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve) => Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve({ width: 0, height: 0 })));

/** The size a picture should be scaled to so its longest side is at most `max` (unchanged if it is already smaller). Pure, for tests. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } | null {
  if (!width || !height || Math.max(width, height) <= max) return null;
  const k = max / Math.max(width, height);
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

/**
 * A smaller JPEG copy of a picture, kept in the app's own storage, whose longest side is `max` pixels. Used for profile pictures, which are shown
 * small but were being kept (and decoded on every scroll) at full camera resolution. Returns the original if it is already small or can't be read.
 */
export async function shrinkImage(uri: string, max = 640, quality = 0.82): Promise<string> {
  try {
    const { width, height } = await sizeOf(uri);
    const target = fitWithin(width, height, max);
    if (!target) return uri;
    const out = await manipulateAsync(uri, [{ resize: target }], { compress: quality, format: SaveFormat.JPEG });
    const kept = persistFile(out.uri, "jpg");
    if (kept !== out.uri) deleteFile(out.uri);
    return kept;
  } catch {
    return uri;
  }
}

/** The same, as a base64 JPEG for embedding in a PDF (the book). Null if the picture can't be read. */
export async function shrunkBase64(uri: string, max: number, quality = 0.8): Promise<string | null> {
  try {
    const { width, height } = await sizeOf(uri);
    const target = fitWithin(width, height, max);
    const out = await manipulateAsync(uri, target ? [{ resize: target }] : [], { compress: quality, format: SaveFormat.JPEG, base64: true });
    deleteFile(out.uri);
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  } catch {
    return null;
  }
}
