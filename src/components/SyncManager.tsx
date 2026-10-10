import { useEffect } from "react";
import { Alert, AppState } from "react-native";
import { useStore } from "../lib/store";
import { signOut, useSession } from "../lib/supabase";
import { attachAndRestore, everythingSynced, isApplying, syncAll } from "../lib/sync";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Keeps every child in the signed-in account, without the parent doing anything.
 *  - On signing in: the sample family (if it was being explored) is taken out, every child on this phone is saved to the account, and the
 *    account's books from other phones are brought down.
 *  - Then: on open, when returning to the app, every 2 minutes, and a few seconds after any change.
 * A phone holds one account's books: if someone else signs in while the last account still has changes that never reached the cloud, they are
 * signed out again (so nothing is lost); otherwise the old account's copy is cleared from the phone (it stays in that account).
 */
export function SyncManager() {
  const session = useSession();
  const hydrated = useStore((s) => s.hydrated);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !hydrated) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { syncAll(); }, 4000);
    };

    (async () => {
      const st = useStore.getState();
      if (st.preview) st.clearSample();
      const previous = useStore.getState().accountUserId;
      if (previous && previous !== userId) {
        if (!everythingSynced()) {
          await signOut();
          Alert.alert("Another account's book is on this phone", "Some of its changes haven't reached that account yet. Sign in with that account first so nothing is lost, then sign out.");
          return;
        }
        useStore.getState().resetAll(); // it is all in that account; this phone now holds yours
      }
      useStore.getState().setAccountUserId(userId);
      useStore.getState().setSync({ busy: true, error: undefined, progress: "Looking for books already in your account…" });
      try {
        await attachAndRestore();
        useStore.getState().setSync({ busy: false, progress: undefined });
      } catch (e) {
        useStore.getState().setSync({ busy: false, error: msg(e), progress: undefined });
      }
      if (alive) syncAll();
    })();

    const every = setInterval(() => { syncAll(); }, 120000);
    const appSub = AppState.addEventListener("change", (state) => { if (state === "active") syncAll(); });
    const unsub = useStore.subscribe((s, prev) => {
      if (isApplying()) return;
      if (s.memories !== prev.memories || s.customDefs !== prev.customDefs || s.relatives !== prev.relatives || s.kids !== prev.kids || s.tombstones !== prev.tombstones) later();
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(every);
      appSub.remove();
      unsub();
    };
  }, [userId, hydrated]);

  return null;
}
