import { MILESTONE_DEFS, MediaItem } from "./types";
import { memoryForDef } from "./development";
import { milestonesLogged } from "./selectors";
import { uid, useStore } from "./store";

export interface MilestoneInput {
  childId: string;
  defId?: string; // an existing milestone being logged or edited
  title: string;
  emoji: string;
  category?: string;
  date: string;
  time?: string;
  location?: string;
  tagIds: string[];
  note: string;
  media: MediaItem[];
}

/** Log a milestone (reusing one with the same name, or creating your own). Returns a message if it can't be saved. */
export function logMilestone(i: MilestoneInput): string | null {
  const st = useStore.getState();
  const defs = [...MILESTONE_DEFS, ...(st.customDefs[i.childId] || [])];
  const done = milestonesLogged(st.memories, i.childId);
  const logged = (d: { id: string; aliases?: string[] }) => !!memoryForDef({ ...d, label: "", emoji: "", hint: "" }, done);
  const name = i.title.trim();
  let def = i.defId ? defs.find((d) => d.id === i.defId) : undefined;
  if (!def) {
    if (!name) return "Give the milestone a name, or pick one from the list.";
    def = defs.find((d) => d.label.toLowerCase() === name.toLowerCase());
    if (def && logged(def)) return `“${def.label}” is already logged — open it from the Milestones tab to edit it.`;
  }
  if (!def) {
    def = { id: uid("custom"), label: name, emoji: i.emoji, hint: "", custom: true, category: i.category };
    st.addCustomDef(i.childId, def);
  }
  const existing = memoryForDef(def, done); // editing keeps the same memory, even if it was logged under an older id
  st.saveMemory({
    id: existing?.id,
    childId: i.childId, type: "milestone", milestoneId: def.id, title: def.label, description: i.note, date: i.date, time: i.time,
    location: i.location, media: i.media, tagIds: i.tagIds, emoji: i.emoji,
  });
  return null;
}
