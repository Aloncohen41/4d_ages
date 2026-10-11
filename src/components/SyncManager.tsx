import { useEffect } from "react";
import { Alert, AppState } from "react-native";
import { useStore } from "../lib/store";
import { useSession } from "../lib/supabase";
import { attachAndRestore, isApplying, joinWithCode, syncAll } from "../lib/sync";
import { useRealtime } from "../lib/realtime";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Keeps every child in the signed-in account, without the parent doing anything.
 *  - On signing in: the sample family (if it was being explored) is taken out, every child on this phone is saved to the account, and the
 *    account's books from other phones are brought down.
 *  - Then: a moment after any change here; within a second or two of a change on the other phone (live updates, see realtime.ts); and as a
 *    safety net on open, when returning to the app, and every 2 minutes.
 * A phone holds one account's books: if someone else signs in while the last account still has changes that never reached the cloud, they are
 * signed out again (so nothing is lost); otherwise the old account's copy is cleared from the phone (it stays in that account).
 */
/** A share link opened before (or after) signing in: add that book now. */
async function joinPending() {
  const code = useStore.getState().pendingJoin;
  if (!code) return;
  useStore.getState().setPendingJoin(undefined);
  try {
    const child = await joinWithCode(code);
    Alert.alert(`${child.name}'s book is here`, "Everything in it is on its way to this phone. From now on, anything either of you adds shows up on both phones.");
  } catch (e) {
    Alert.alert("Couldn't add the book", msg(e));
  }
}

export function SyncManager() {
  const session = useSession();
  const hydrated = useStore((s) => s.hydrated);
  const userId = session?.user.id;
  const pendingJoin = useStore((s) => s.pendingJoin);
  const kidIds = useStore((s) => s.kids.filter((k) => k.shared).map((k) => k.id).join(","));
  // a change on the other phone arrives in a second or two
  useRealtime(userId, kidIds);

  // something to tell the parent once (a book taken off this phone because it isn't shared with them any more)
  const notice = useStore((s) => s.sync.notice);
  useEffect(() => {
    if (!notice) return;
    useStore.getState().setSync({ notice: undefined });
    Alert.alert("A book was taken off this phone", notice);
  }, [notice]);

  // a link opened while already signed in
  useEffect(() => {
    if (userId && hydrated && pendingJoin && useStore.getState().accountUserId === userId) joinPending();
  }, [userId, hydrated, pendingJoin]);

  useEffect(() => {
    if (!userId || !hydrated) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { syncAll(); }, 1500); // soon after a change, so the other phone sees it quickly
    };

    (async () => {
      const st = useStore.getState();
      if (st.preview) st.clearSample();
      // a phone can be used by more than one account: the books of whoever was signed in before are set aside on the phone (nothing is lost,
      // even what hadn't been uploaded yet) and come back when they sign in again
      await useStore.getState().switchAccount(userId);
      if (!alive) return;
      useStore.getState().setSync({ busy: true, error: undefined, progress: "Looking for books already in your account…" });
      try {
        await attachAndRestore();
        useStore.getState().setSync({ busy: false, progress: undefined });
      } catch (e) {
        useStore.getState().setSync({ busy: false, error: msg(e), progress: undefined });
      }
      if (alive) await joinPending();
      if (alive) syncAll();
    })();

    const every = setInterval(() => { syncAll(); }, 120000);
    const appSub = AppState.addEventListener("change", (state) => { if (state === "active") syncAll(); });
    const unsub = useStore.subscribe((s, prev) => {
      if (isApplying()) return;
      if (s.memories !== prev.memories || s.customDefs !== prev.customDefs || s.relatives !== prev.relatives || s.kids !== prev.kids || s.tombstones !== prev.tombstones || s.classics !== prev.classics) later();
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
