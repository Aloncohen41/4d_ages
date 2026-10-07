import { useEffect } from "react";
import { useStore } from "../lib/store";
import { hasInitialShare, isShareIntakeAvailable, listenForShares, readInitialShare } from "../lib/shareIntake";

/** Picks up photos and videos shared to the app (cold start or while it's open) and hands them to the import screen. */
export function ShareIntakeListener() {
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated || !isShareIntakeAvailable()) return;
    let alive = true;
    const st = useStore.getState;

    if (hasInitialShare()) st().setIncoming({ items: st().incoming?.items ?? [], busy: 1 });
    readInitialShare()
      .then((items) => {
        if (!alive) return;
        const cur = st().incoming;
        if (items.length) st().setIncoming({ items: [...(cur?.items ?? []), ...items] });
        else if (cur && !cur.items.length) st().setIncoming(null);
      })
      .catch(() => {
        const cur = st().incoming;
        if (cur && !cur.items.length) st().setIncoming(null);
      });

    const off = listenForShares(
      (count) => st().setIncoming({ items: st().incoming?.items ?? [], busy: count || 1 }),
      (items) => {
        const cur = st().incoming;
        const all = [...(cur?.items ?? []), ...items];
        st().setIncoming(all.length ? { items: all } : null);
      }
    );
    return () => {
      alive = false;
      off();
    };
  }, [hydrated]);

  return null;
}
