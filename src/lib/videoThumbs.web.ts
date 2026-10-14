/*
 * The website's video thumbnails: frames are taken in the browser (a hidden video, drawn onto a canvas at moments through it) and kept like
 * any other file. The same choice as on the phone: the frame with the most detail, never a blank one.
 */
import { looksBlank, pickThumb } from "./thumbChoice";
import { keepFile, removeFile, fileSize } from "./localFiles";

export { pickThumb };

export const isVideoFramesAvailable = () => typeof document !== "undefined";

function frameAt(video: HTMLVideoElement, time: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return resolve(null);
      const k = Math.min(1, 960 / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.round(w * k);
      c.height = Math.round(h * k);
      c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

/** Evenly spaced frames of a video (3 → 25%, 50%, 75% through it), kept as pictures. Empty if the video can't be read. */
export async function videoFrames(uri: string, count = 3): Promise<string[]> {
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = uri;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("unreadable"));
    });
    const out: string[] = [];
    const n = Math.max(1, Math.min(9, count));
    for (let i = 0; i < n; i++) {
      const blob = await frameAt(video, (video.duration || 1) * ((i + 1) / (n + 1)));
      if (blob) out.push(await keepFile(URL.createObjectURL(blob), "jpg"));
    }
    video.removeAttribute("src");
    video.load();
    return out;
  } catch {
    return [];
  }
}

export async function defaultThumb(uri: string): Promise<string | undefined> {
  for (const count of [5, 9]) {
    const frames = await videoFrames(uri, count);
    if (!frames.length) return undefined;
    const sizes = frames.map(fileSize);
    const keep = pickThumb(frames, sizes);
    const blank = looksBlank(sizes[frames.indexOf(keep)]);
    frames.filter((f) => f !== keep || blank).forEach(removeFile);
    if (!blank) return keep;
  }
  return undefined;
}

export const deleteThumb = removeFile;
