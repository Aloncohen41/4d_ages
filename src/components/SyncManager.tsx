import { useEffect } from "react";
import { AppState } from "react-native";
import { useStore } from "../lib/store";
import { useSession } from "../lib/supabase";
import { isApplying, syncAll } from "../lib/sync";

/**
 * Keeps shared children up to date without the parent doing anything:
 * on open, when returning to the app, every 2 minutes, and a few seconds after any change.
 */
export function SyncManager() {
  const session = useSession();
  const hydrated = useStore((s) => s.hydrated);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !hydrated) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { syncAll(); }, 4000);
    };

    syncAll();
    const every = setInterval(() => { syncAll(); }, 120000);
    const appSub = AppState.addEventListener("change", (state) => { if (state === "active") syncAll(); });
    const unsub = useStore.subscribe((s, prev) => {
      if (isApplying()) return;
      if (s.memories !== prev.memories || s.customDefs !== prev.customDefs || s.relatives !== prev.relatives || s.kids !== prev.kids || s.tombstones !== prev.tombstones) later();
    });
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(every);
      appSub.remove();
      unsub();
    };
  }, [userId, hydrated]);

  return null;
}
