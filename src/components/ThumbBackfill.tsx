import { useEffect } from "react";
import { useStore } from "../lib/store";
import { videosNeedingThumbs } from "../lib/thumbBackfill";
import { defaultThumb, deleteThumb, isVideoFramesAvailable } from "../lib/videoThumbs";

/**
 * Gives every video a thumbnail picture, quietly in the background: the ones added before thumbnails existed,
 * and any that arrived without one. New videos get theirs the moment they are added.
 */
export function ThumbBackfill() {
  const hydrated = useStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated || !isVideoFramesAvailable()) return;
    let alive = true;
    const tried = new Set<string>();
    (async () => {
      for (let n = 0; n < 60 && alive; n++) {
        const next = videosNeedingThumbs(useStore.getState().memories, tried)[0];
        if (!next) break;
        tried.add(`${next.memoryId}:${next.mediaId}`);
        const thumb = await defaultThumb(next.uri);
        if (!thumb) continue;
        if (!alive) {
          deleteThumb(thumb);
          break;
        }
        useStore.getState().setMediaThumb(next.memoryId, next.mediaId, thumb);
        await new Promise((r) => setTimeout(r, 60)); // keep the app responsive
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrated]);
  return null;
}
