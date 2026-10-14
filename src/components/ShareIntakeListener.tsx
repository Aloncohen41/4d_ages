import { useEffect } from "react";
import { toast } from "../lib/toast";
import {  } from "react-native";
import { useStore } from "../lib/store";
import { ShareResult, hasInitialShare, isShareIntakeAvailable, listenForShares, readInitialShare } from "../lib/shareIntake";
import { skippedMessage } from "../lib/sharedMedia";

/**
 * Picks up photos, videos and sound recordings shared to the app (cold start or while it's open) and hands them to the import screen. Files
 * that can't come in (a PDF, a document) are left out, and the person is told which.
 */
export function ShareIntakeListener() {
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated || !isShareIntakeAvailable()) return;
    let alive = true;
    const st = useStore.getState;
    const arrived = (r: ShareResult) => {
      const cur = st().incoming;
      const all = [...(cur?.items ?? []), ...r.items];
      if (r.skipped.length) toast(skippedMessage(r.skipped), true);
      const text = cur?.text ?? r.text;
      st().setIncoming(all.length ? { items: all, ...(text ? { text } : {}) } : null);
    };

    if (hasInitialShare()) st().setIncoming({ items: st().incoming?.items ?? [], busy: 1 });
    readInitialShare()
      .then((r) => { if (alive) arrived(r); })
      .catch(() => {
        const cur = st().incoming;
        if (cur && !cur.items.length) st().setIncoming(null);
      });

    const off = listenForShares((count) => st().setIncoming({ items: st().incoming?.items ?? [], busy: count || 1 }), arrived);
    return () => {
      alive = false;
      off();
    };
  }, [hydrated]);

  return null;
}
