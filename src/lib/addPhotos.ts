import { useStore } from "./store";
import { Picked, pickMedia } from "./media";
import { SharedItem } from "./types";

/** A picked file, as the "new post" form expects it (the same form photos shared in from other apps use). */
export const pickedToItem = (p: Picked, i: number): SharedItem => ({
  uri: p.uri, kind: p.kind, mime: p.kind === "video" ? "video/*" : "image/*", name: `picked-${i}`, size: 0,
  ...(p.dated ? { date: p.date } : {}), ...(p.thumb ? { thumb: p.thumb } : {}),
});

/**
 * The "+ → Photo or video" action: pick from the gallery / Google Photos, then confirm in the new-post form — one post or separate posts
 * (when there are several), the dates from the files, and an optional description.
 */
export async function addPhotosFlow(): Promise<number> {
  const st = useStore.getState();
  const child = st.kids.find((k) => k.id === st.activeId) ?? st.kids[0];
  if (!child) return 0;
  const picked = await pickMedia({ videos: true, multiple: true });
  if (!picked.length) return 0;
  st.setIncoming({ items: picked.map(pickedToItem), source: "picker" });
  return picked.length;
}
