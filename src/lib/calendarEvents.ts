import * as Calendar from "expo-calendar";
import { HealthReminder, calendarRule } from "./reminders";

import { tr } from "./i18n";
/*
 * Putting a pet's reminder in the phone's own calendar (Google Calendar or whichever the phone uses), with a reminder an hour before and the
 * repeat (every month, every year…). Asks for calendar access the first time.
 */

async function writableCalendar(): Promise<string> {
  const { granted } = await Calendar.requestCalendarPermissionsAsync();
  if (!granted) throw new Error(tr("4D Ages needs access to your calendar to add this. You can allow it in the phone's settings."));
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const own = cals.filter((c) => c.allowsModifications && c.accessLevel === Calendar.CalendarAccessLevel.OWNER);
  const best = own.find((c) => c.isPrimary) ?? own.find((c) => /@/.test(c.source?.name ?? "")) ?? own[0] ?? cals.find((c) => c.allowsModifications);
  if (!best) throw new Error(tr("There's no calendar on this phone that can be added to."));
  return best.id;
}

/** Adds the reminder to the phone's calendar. Returns the event's id (to update or remove it later). */
export async function addToCalendar(r: HealthReminder, petName: string): Promise<string> {
  const calendarId = await writableCalendar();
  const [h, m] = r.time.split(":").map(Number);
  const start = new Date(`${r.date}T00:00:00`);
  start.setHours(h || 9, m || 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const rule = calendarRule(r);
  return Calendar.createEventAsync(calendarId, {
    title: `${petName}: ${r.title}`,
    startDate: start,
    endDate: end,
    get notes() { return tr("Added by 4D Ages."); },
    alarms: [{ relativeOffset: -60 }],
    ...(rule ? { recurrenceRule: { frequency: rule.frequency === "monthly" ? Calendar.Frequency.MONTHLY : Calendar.Frequency.YEARLY, interval: rule.interval } } : {}),
  });
}

/** Takes the reminder out of the calendar again (if it's still there). */
export async function removeFromCalendar(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    /* already gone, or made on another phone */
  }
}
