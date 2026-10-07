import { EntryKind, Memory } from "./types";
import { useStore } from "./store";

/** Open the right editor for any kind of memory (used by tag results and search). */
export function openMemory(m: Memory) {
  const st = useStore.getState();
  st.setTagSheet(null);
  if (m.type === "milestone" && m.milestoneId) st.setEntrySheet({ kind: "milestone", editId: m.milestoneId });
  else if (m.type !== "photo") st.setEntrySheet({ kind: m.type as EntryKind, editId: m.id });
  else st.setPhotoEdit(m.id);
}
