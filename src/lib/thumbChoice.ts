/* Choosing a video's thumbnail from a few frames. Pure (no phone needed), so it can be tested. */

/** The frame to keep: the most detailed (largest file); among equals, the one nearest the middle. Pure, for tests. */
export function pickThumb<T>(frames: T[], sizes: number[]): T {
  const mid = (frames.length - 1) / 2;
  let best = 0;
  for (let i = 1; i < frames.length; i++) {
    if (sizes[i] > sizes[best] || (sizes[i] === sizes[best] && Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return frames[best];
}

/**
 * A frame this small can only be (nearly) one flat colour: black from a covered lens, a fade, or the dark first frame of many phones. A real
 * picture, even a dim one, compresses to far more. Such a frame is never used as a thumbnail.
 */
export const BLANK_FRAME_BYTES = 6000;
export const looksBlank = (bytes: number) => bytes < BLANK_FRAME_BYTES;
