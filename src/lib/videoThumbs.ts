import { requireNativeModule } from "expo";
import { File } from "expo-file-system";
import { pickThumb } from "./thumbChoice";

export { pickThumb };

interface NativeFrames {
  videoFrames(uri: string, count: number): Promise<string[]>;
}

let cached: NativeFrames | null | undefined;
function native(): NativeFrames | null {
  if (cached === undefined) {
    try {
      cached = requireNativeModule<NativeFrames>("VideoExport");
    } catch {
      cached = null; // the app hasn't been rebuilt with the newer native module yet
    }
  }
  return cached ?? null;
}

const remove = (uri: string) => {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* already gone */
  }
};

export const isVideoFramesAvailable = () => native() !== null;

/** Evenly spaced frames of a video (3 → 25%, 50%, 75% through it). Empty if frames can't be read. */
export async function videoFrames(uri: string, count = 3): Promise<string[]> {
  try {
    return (await native()?.videoFrames(uri, count)) ?? [];
  } catch {
    return [];
  }
}

const sizeOf = (uri: string) => {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
};

/**
 * A frame worth showing for a video, until you pick another. Five frames are read (17%…83% through it) and the one with the most detail is
 * kept: a black or blank frame (a fade, a covered lens) compresses to a tiny file, so the largest JPEG is almost never one. Ties go to the
 * middle. The spare frames are deleted.
 */
export async function defaultThumb(uri: string): Promise<string | undefined> {
  const frames = await videoFrames(uri, 5);
  if (!frames.length) return undefined;
  const keep = pickThumb(frames, frames.map(sizeOf));
  frames.filter((f) => f !== keep).forEach(remove);
  return keep;
}

export const deleteThumb = remove;
