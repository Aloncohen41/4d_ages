import { requireNativeModule } from "expo";
import { File } from "expo-file-system";

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

/** The frame from the middle of a video: a sensible thumbnail until you pick another. The spare frames are deleted. */
export async function defaultThumb(uri: string): Promise<string | undefined> {
  const frames = await videoFrames(uri, 3);
  if (!frames.length) return undefined;
  const keep = frames[Math.floor(frames.length / 2)];
  frames.filter((f) => f !== keep).forEach(remove);
  return keep;
}

export const deleteThumb = remove;
