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

    // Opened from the share sheet: read the files. On a cold start the app's screen can still be getting ready, so an empty answer while a
    // share is waiting is tried again for a few seconds (the native side also hands it over once the screen is up).
    const opened = hasInitialShare();
    if (opened) st().setIncoming({ items: st().incoming?.items ?? [], busy: 1 });
    const tryRead = (left: number) =>
      readInitialShare()
        .then((r) => {
          if (!alive) return;
          if (!r.items.length && !r.skipped.length && left > 0 && hasInitialShare()) { setTimeout(() => tryRead(left - 1), 600); return; }
          arrived(r);
        })
        .catch(() => {
          if (left > 0 && alive) { setTimeout(() => tryRead(left - 1), 600); return; }
          const cur = st().incoming;
          if (cur && !cur.items.length) st().setIncoming(null);
        });
    tryRead(opened ? 6 : 0);

    const off = listenForShares((count) => st().setIncoming({ items: st().incoming?.items ?? [], busy: count || 1 }), arrived);
    return () => {
      alive = false;
      off();
    };
  }, [hydrated]);

  return null;
}
