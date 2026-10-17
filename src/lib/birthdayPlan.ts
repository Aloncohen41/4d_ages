import { parseISO } from "./date";
import { NotifPrefs } from "./types";

import { tr } from "./i18n";
export interface Planned {
  date: Date;
  title: string;
  body: string;
  data: { kind: "birthday"; childId: string; turning: number; phase: "before" | "day" };
}

const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

/** Which reminders should exist: for each child, the run-up to and day of each of the next few birthdays. */
export function planBirthdayNotifications(kids: { id: string; name: string; birth: string }[], prefs: NotifPrefs, now: Date, horizonYears = 3): Planned[] {
  if (!prefs.enabled) return [];
  const out: Planned[] = [];
  for (const k of kids) {
    const b = parseISO(k.birth);
    for (let y = now.getFullYear(); y <= now.getFullYear() + horizonYears; y++) {
      const turning = y - b.getFullYear();
      if (turning < 1) continue;
      const day = new Date(y, b.getMonth(), b.getDate(), prefs.hour, 0, 0);
      if (prefs.daysBefore > 0) {
        const before = new Date(day.getTime());
        before.setDate(before.getDate() - prefs.daysBefore);
        if (before > now) {
          const when = prefs.daysBefore === 1 ? "tomorrow" : tr("in {0} days", [prefs.daysBefore]);
          out.push({
            date: before,
            title: `🎈 ${k.name} turns ${turning} ${when}`,
            body: tr("{0}'s year in review is ready — tap to watch the highlights.", [k.name]),
            data: { kind: "birthday", childId: k.id, turning, phase: "before" },
          });
        }
      }
      if (day > now) {
        out.push({
          date: day,
          title: tr("🎂 Happy birthday, {0}!", [k.name]),
          body: tr("{0} of memories. Tap to relive {1}'s year.", [years(turning), k.name]),
          data: { kind: "birthday", childId: k.id, turning, phase: "day" },
        });
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 48);
}
