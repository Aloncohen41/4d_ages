import { useEffect } from "react";
import { useStore } from "../lib/store";
import { backupNow } from "../lib/driveBackup";

/** After this long without another change, the books are backed up (a burst of edits makes one backup, not many). */
const QUIET_MS = 60 * 1000;

/** With "Back up to Google Drive" on, backs up a minute after anything in the books changes. Never asks anything: see backupNow. */
export function DriveAutoBackup() {
  const enabled = useStore((s) => s.driveBackup.enabled);
  const hydrated = useStore((s) => s.hydrated);
  useEffect(() => {
    if (!enabled || !hydrated) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { backupNow(false).catch(() => undefined); }, QUIET_MS);
    };
    const unsub = useStore.subscribe((s, prev) => {
      if (s.memories !== prev.memories || s.kids !== prev.kids || s.relatives !== prev.relatives || s.classics !== prev.classics || s.customDefs !== prev.customDefs || s.tags !== prev.tags) later();
    });
    // a backup that never finished (or is older than a day) is made now
    const last = useStore.getState().driveBackup.lastAt ?? 0;
    if (Date.now() - last > 24 * 60 * 60 * 1000) later();
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [enabled, hydrated]);
  return null;
}
