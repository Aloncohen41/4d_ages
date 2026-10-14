import { useEffect } from "react";
import { useStore } from "../lib/store";
import { celebrationsToday } from "../lib/confetti";
import { todayISO } from "../lib/date";

/** On a child's or a pet's birthday (their real one) or a pet's gotcha day: confetti once, the first time the app opens that day. */
export function BirthdayConfetti() {
  const hydrated = useStore((s) => s.hydrated);
  const activeId = useStore((s) => s.activeId);
  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    const done = new Set(s.celebrated ?? []);
    // the profile on screen first, then the others
    const due = celebrationsToday(s.kids, todayISO()).filter((c) => !done.has(c.id)).sort((a, b) => (a.childId === activeId ? -1 : b.childId === activeId ? 1 : 0));
    if (!due.length) return;
    const timer = setTimeout(() => {
      s.markCelebrated(due[0].id);
      s.celebrate(`🎉 ${due[0].text}`);
    }, 900);
    return () => clearTimeout(timer);
  }, [hydrated, activeId]);
  return null;
}
