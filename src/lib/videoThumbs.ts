import { requireNativeModule } from "expo";
import { File } from "expo-file-system";
import { looksBlank, pickThumb } from "./thumbChoice";

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
 * middle. If all five are blank, nine more are read at other moments; if every one is blank, there is no thumbnail and the post shows its
 * soft colour with a play button instead (never a black frame), until you choose a frame. The spare frames are deleted.
 */
export async function defaultThumb(uri: string): Promise<string | undefined> {
  for (const count of [5, 9]) {
    const frames = await videoFrames(uri, count);
    if (!frames.length) return undefined;
    const sizes = frames.map(sizeOf);
    const keep = pickThumb(frames, sizes);
    const blank = looksBlank(sizes[frames.indexOf(keep)]);
    frames.filter((f) => f !== keep || blank).forEach(remove);
    if (!blank) return keep;
  }
  return undefined;
}

export const deleteThumb = remove;
