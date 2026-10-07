import { addMonths, parseISO } from "./date";
import { AREAS, BANDS, MILESTONE_CATALOG, NotifPrefs } from "./types";
import { areaOf, ageLabel, askStartMonths } from "./development";

export interface PlannedMilestone {
  date: Date;
  title: string;
  body: string;
  data: { kind: "milestone-age" | "milestone-ask"; childId: string; months: number };
}

const CHEERS = [
  "Take a peek at the milestones coming up — and tick off anything new!",
  "Another month of wonderful growing. See what they might be up to next.",
  "Every month is worth celebrating. Open Milestones for fresh ideas.",
  "Look how far they've come! Come and see what's next.",
];
const NEW_STAGE = "A new set of milestones just opened up — come and see what's next.";

const at = (birth: string, months: number, hour: number) => {
  const d = parseISO(addMonths(birth, months));
  d.setHours(hour, 0, 0, 0);
  return d;
};

/**
 * Two kinds of gentle, positive notifications:
 *  - on the day a child reaches a new month of age (1–36): "Wow — Chloe is 6 months old today!"
 *    (12 and 24 months are birthdays too, so theirs is sent a few hours after the birthday message; 36 is the end of the chart)
 *  - "Is Chloe starting any of these?" when a new age band is about to open — 1/6 of the way before it
 *    (5, 10, 15, 20 and 25 months). Milestones already ticked are left out, and nothing is sent if all are done.
 * `reached` holds, per child, the ids of milestones already ticked off.
 */
export function planMilestoneNotifications(kids: { id: string; name: string; birth: string }[], prefs: NotifPrefs, now: Date, reached: Record<string, Set<string>> = {}): PlannedMilestone[] {
  if (!prefs.enabled) return [];
  const out: PlannedMilestone[] = [];
  for (const k of kids) {
    if (prefs.milestoneAges !== false) {
      for (let m = 1; m < BANDS[BANDS.length - 1][1]; m++) {
        const birthday = m % 12 === 0;
        const date = at(k.birth, m, birthday ? Math.min(20, prefs.hour + 3) : prefs.hour);
        if (date <= now) continue;
        const newStage = BANDS.some(([lo]) => lo === m);
        out.push({
          date,
          title: `🎉 Wow — ${k.name} is ${ageLabel(m)} old today!`,
          body: newStage ? NEW_STAGE : CHEERS[m % CHEERS.length],
          data: { kind: "milestone-age", childId: k.id, months: m },
        });
      }
    }
    if (prefs.milestoneAsks !== false) {
      const done = reached[k.id] ?? new Set<string>();
      for (const [bi, [lo]] of BANDS.entries()) {
        if (lo === 0) continue;
        const askMonth = lo - lo / 6; // 1/6 before the band opens
        const date = at(k.birth, askMonth, Math.min(20, prefs.hour + 4)); // later in the day than the monthly cheer
        if (date <= now) continue;
        const open = MILESTONE_CATALOG.filter((d) => d.months?.[0] === lo && !done.has(d.id) && askStartMonths(d) === askMonth);
        if (!open.length) continue;
        const order = AREAS.map((_, i) => AREAS[(i + bi) % AREAS.length]); // a different mix of areas each time
        const names = order.map((a) => open.find((d) => areaOf(d) === a)?.label).filter((x): x is string => !!x).slice(0, 3);
        out.push({
          date,
          title: `👀 Is ${k.name} starting any of these?`,
          body: `${names.join(" · ")} — tap to tick off what's happened.`,
          data: { kind: "milestone-ask", childId: k.id, months: askMonth },
        });
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** What the two milestone notifications look like (for the "send me a preview" buttons). */
export function sampleMilestoneNotification(name: string, kind: "cheer" | "ask"): { title: string; body: string } {
  if (kind === "cheer") return { title: `🎉 Wow — ${name} is 6 months old today!`, body: NEW_STAGE };
  const open = MILESTONE_CATALOG.filter((d) => d.months?.[0] === 6);
  const names = AREAS.map((a) => open.find((d) => areaOf(d) === a)?.label).filter((x): x is string => !!x).slice(0, 3);
  return { title: `👀 Is ${name} starting any of these?`, body: `${names.join(" · ")} — tap to tick off what's happened.` };
}
