import { Memory } from "./types";

export interface PendingThumb {
  memoryId: string;
  mediaId: string;
  uri: string;
}

/**
 * Videos that have no thumbnail yet — ones added before thumbnails existed, or before the app was rebuilt with the
 * frame reader, or downloaded from a shared copy. `skip` holds "memoryId:mediaId" already tried this session.
 */
export function videosNeedingThumbs(memories: Memory[], skip: Set<string> = new Set()): PendingThumb[] {
  const out: PendingThumb[] = [];
  for (const m of memories) {
    for (const x of m.media) {
      if (x.kind === "video" && x.uri && !x.thumb && !skip.has(`${m.id}:${x.id}`)) out.push({ memoryId: m.id, mediaId: x.id, uri: x.uri });
    }
  }
  return out;
}
