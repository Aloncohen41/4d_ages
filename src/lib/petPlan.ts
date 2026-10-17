import { NotifPrefs } from "./types";
import { HealthReminder, nextDates } from "./reminders";

import { tr } from "./i18n";
/*
 * A pet's notifications: their gotcha day every year ("2 years since Rex came home!"), and their health reminders (a vaccine booster, flea
 * treatment…) at the time chosen. Their birthday is planned with the children's (birthdayPlan.ts). Pure, for tests.
 */

export interface PetPlanned { date: Date; title: string; body: string; data: { kind: "gotcha" | "health-reminder"; childId: string } }

const atHour = (iso: string, hour: number, minute = 0) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute, 0);
};

/** The gotcha day, every year, at the reminders' hour. */
export function planGotchaNotifications(pets: { id: string; name: string; gotchaDay?: string }[], prefs: NotifPrefs, now: Date, horizonYears = 3): PetPlanned[] {
  if (!prefs.enabled) return [];
  const out: PetPlanned[] = [];
  for (const p of pets) {
    if (!p.gotchaDay) continue;
    const [gy, gm, gd] = p.gotchaDay.split("-").map(Number);
    for (let y = now.getFullYear(); y <= now.getFullYear() + horizonYears; y++) {
      const years = y - gy;
      if (years < 1) continue;
      const day = new Date(y, gm - 1, gd, prefs.hour, 0, 0);
      if (day <= now) continue;
      out.push({ date: day, title: `🏡 ${years} ${years === 1 ? "year" : "years"} since ${p.name} came home!`, body: `Happy gotcha day, ${p.name}. Tap to look back at the day they came home.`, data: { kind: "gotcha", childId: p.id } });
    }
  }
  return out;
}

/** The health reminders that are notifications: the next few of each, at their time. Set by the owner, so they don't depend on the other reminders. */
export function planHealthReminders(pets: { id: string; name: string; reminders: HealthReminder[] }[], now: Date): PetPlanned[] {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const out: PetPlanned[] = [];
  for (const p of pets) for (const r of p.reminders) {
    if (!r.notify) continue;
    const [h, m] = r.time.split(":").map(Number);
    for (const d of nextDates(r, today, 3)) {
      const when = atHour(d, h || 9, m || 0);
      if (when > now) out.push({ date: when, title: `🩺 ${p.name}: ${r.title}`, get body() { return tr("Today. Tap to see their health page."); }, data: { kind: "health-reminder", childId: p.id } });
    }
  }
  return out;
}
