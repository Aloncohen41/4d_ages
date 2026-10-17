import { create } from "zustand";
import { supabase } from "./supabase";

/*
 * Hearts and comments on posts. Each person (a parent, or family invited to view) leaves at most one per post: a heart, a comment, or both,
 * which they can change or take back. They're kept in the cloud only (they come with sync, and arrive live from the other phones).
 */

import { Reaction, groupReactions } from "./reactionMath";
import { tr } from "./i18n";
export type { Reaction } from "./reactionMath";
export { groupReactions, reactionCounts } from "./reactionMath";

interface ReactionState {
  byMemory: Record<string, Reaction[]>;
}
export const useReactions = create<ReactionState>(() => ({ byMemory: {} }));

interface Row { memory_id: string; user_id: string; author: string | null; heart: boolean | null; comment: string | null; updated_at: string }
const fromRow = (r: Row): Reaction => ({ memoryId: r.memory_id, userId: r.user_id, author: r.author || tr("Family"), heart: !!r.heart, comment: r.comment ?? "", at: r.updated_at });

/** Fetch every reaction on a child's posts (the ones this account can see). A database without reactions yet simply has none. */
export async function loadReactions(childId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.from("reactions").select("memory_id, user_id, author, heart, comment, updated_at").eq("child_id", childId);
  if (error) return; // not fatal: hearts and comments are extras
  const mine = groupReactions(((data ?? []) as Row[]).map(fromRow));
  useReactions.setState((s) => {
    // replace this child's posts' reactions; other children's stay
    const byMemory = { ...s.byMemory };
    for (const id of Object.keys(byMemory)) if (byMemory[id]?.length && !(id in mine) && childOf.get(id) === childId) delete byMemory[id];
    for (const [id, list] of Object.entries(mine)) { byMemory[id] = list; childOf.set(id, childId); }
    return { byMemory };
  });
}
const childOf = new Map<string, string>();

/** Leave (or change) your heart and comment on a post. Both empty takes your reaction away. */
export async function react(childId: string, memoryId: string, author: string, heart: boolean, comment: string): Promise<void> {
  if (!supabase) throw new Error(tr("Sign-in isn't set up in this build."));
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error(tr("Please sign in first."));
  const text = comment.trim().slice(0, 500);
  if (!heart && !text) {
    const { error } = await supabase.from("reactions").delete().eq("memory_id", memoryId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("reactions").upsert({ child_id: childId, memory_id: memoryId, user_id: userId, author: author.trim() || tr("Family"), heart, comment: text }, { onConflict: "memory_id,user_id" });
    if (error) throw new Error(error.message);
  }
  await loadReactions(childId);
}
