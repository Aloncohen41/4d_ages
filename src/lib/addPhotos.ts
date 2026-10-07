import { ToastAndroid } from "react-native";
import { useStore } from "./store";
import { pickMedia, toMemories } from "./media";

/** The "+ → Photo or video" action: pick from the gallery / Google Photos and add to the active child's story. */
export async function addPhotosFlow(): Promise<number> {
  const st = useStore.getState();
  const child = st.kids.find((k) => k.id === st.activeId) ?? st.kids[0];
  if (!child) return 0;
  const picked = await pickMedia({ videos: true, multiple: true });
  if (!picked.length) return 0;
  st.addMemories(toMemories(child, picked));
  ToastAndroid.show(`Added ${picked.length} to ${child.name}'s story`, ToastAndroid.SHORT);
  return picked.length;
}
