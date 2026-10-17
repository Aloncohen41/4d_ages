import { useEffect } from "react";
import { supabase } from "./supabase";
import { isApplying, syncAll } from "./sync";

/** Tables whose changes are sent to the other phone at once (the database's privacy rules still decide who hears about what). */
const TABLES = ["memories", "custom_defs", "relatives", "classics", "food_tries", "reactions"] as const;

/**
 * Live updates: while the app is open, a change made on the other phone (a photo, a story, a heart…) is announced by the database, and this
 * phone syncs a moment later, so it shows up within a second or two. The regular sync (on open, on return, every 2 minutes) still runs as a
 * safety net. `kidIds` is the shared children, comma separated.
 */
export function useRealtime(userId: string | undefined, kidIds: string) {
  useEffect(() => {
    if (!supabase || !userId || !kidIds) return;
    const sb = supabase;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      if (isApplying()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { syncAll(); }, 800);
    };
    const filter = `child_id=in.(${kidIds})`;
    let channel = sb.channel(`books-${userId}`);
    for (const table of TABLES) channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, soon);
    channel = channel
      .on("postgres_changes", { event: "*", schema: "public", table: "children", filter: `id=in.(${kidIds})` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "child_members", filter }, soon);
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [userId, kidIds]);
}
