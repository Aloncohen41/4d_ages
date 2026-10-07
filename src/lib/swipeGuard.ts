import { useSyncExternalStore } from "react";

/**
 * Something that is dragged sideways on purpose (the player's position slider) asks the tab pager
 * to stand down while a finger is on it, so it never swipes you to another tab by accident.
 */
let held = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  if (held === v) return;
  held = v;
  listeners.forEach((l) => l());
};

export const holdSwipe = () => {
  set(true);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => set(false), 8000); // safety net if the "finger lifted" event is ever missed
};
export const releaseSwipe = () => {
  if (timer) clearTimeout(timer);
  set(false);
};
export const isSwipeHeld = () => held;
export const subscribeSwipe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useSwipeHeld = () => useSyncExternalStore(subscribeSwipe, isSwipeHeld, isSwipeHeld);
