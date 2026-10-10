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
