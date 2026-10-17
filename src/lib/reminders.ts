import { tr } from "./i18n";
/*
 * A pet's health reminders: a vaccine on the date the vet gave, flea and worm treatment every month, the yearly check-up… Each can be a
 * notification from the app, an event in the phone's calendar, or both. Kept as JSON in the pet's Reminders page (REMINDERS_ID), so the other
 * owners see them too. Pure, for tests.
 */

export type Repeat = "once" | "monthly" | "quarterly" | "yearly";

export interface HealthReminder {
  id: string;
  title: string; // "Rabies booster"
  kind: string; // a pet health kind: vaccination, parasite, vet…
  date: string; // the next one (YYYY-MM-DD)
  time: string; // "09:00"
  repeat: Repeat;
  notify: boolean; // a notification from the app
  calendar?: boolean; // an event was put in this phone's calendar
  calendarEventId?: string; // that event, on the phone that made it
}

export const REPEATS: { id: Repeat; label: string; months: number }[] = [
  { id: "once", get label() { return tr("Once"); }, months: 0 },
  { id: "monthly", get label() { return tr("Every month"); }, months: 1 },
  { id: "quarterly", get label() { return tr("Every 3 months"); }, months: 3 },
  { id: "yearly", get label() { return tr("Every year"); }, months: 12 },
];

/** Ideas to start from. */
export const REMINDER_IDEAS: { title: string; kind: string; repeat: Repeat }[] = [
  { get title() { return tr("Vaccination booster"); }, kind: "vaccination", repeat: "yearly" },
  { get title() { return tr("Flea treatment"); }, kind: "parasite", repeat: "monthly" },
  { get title() { return tr("Worming"); }, kind: "parasite", repeat: "quarterly" },
  { get title() { return tr("Yearly check-up"); }, kind: "vet", repeat: "yearly" },
  { get title() { return tr("Groomer"); }, kind: "grooming", repeat: "once" },
  { get title() { return tr("Farrier"); }, kind: "grooming", repeat: "once" },
];

export function readReminders(values?: Record<string, string>): HealthReminder[] {
  try {
    const list = JSON.parse(values?.list ?? "[]") as HealthReminder[];
    return Array.isArray(list) ? list.filter((r) => r && r.id && r.title && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) : [];
  } catch {
    return [];
  }
}
export const writeReminders = (list: HealthReminder[]): Record<string, string> => ({ list: JSON.stringify(list) });

const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  const dt = new Date(y, m - 1 + n, Math.min(d, last));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** The next times a reminder is due, from today (a repeating one: the next `count`; a one-off: just its date, if still to come). */
export function nextDates(r: HealthReminder, today: string, count = 6): string[] {
  const months = REPEATS.find((x) => x.id === r.repeat)?.months ?? 0;
  if (!months) return r.date >= today ? [r.date] : [];
  const out: string[] = [];
  let d = r.date;
  for (let i = 0; out.length < count && i < 600; i++, d = addMonths(r.date, i * months)) if (d >= today) out.push(d);
  return out;
}

/** The calendar's repeat rule for a reminder (for the phone's calendar app). */
export const calendarRule = (r: HealthReminder): { frequency: "monthly" | "yearly"; interval: number } | null =>
  r.repeat === "monthly" ? { frequency: "monthly", interval: 1 } : r.repeat === "quarterly" ? { frequency: "monthly", interval: 3 } : r.repeat === "yearly" ? { frequency: "yearly", interval: 1 } : null;
