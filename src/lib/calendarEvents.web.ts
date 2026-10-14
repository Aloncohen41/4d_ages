/*
 * The website's "Add to calendar": a calendar file (.ics) is downloaded, which Google Calendar, Outlook and Apple Calendar all open, with the
 * reminder an hour before and the repeat (every month, every year…). There's nothing to take back out afterwards from here.
 */
import { HealthReminder, calendarRule } from "./reminders";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\${c}`).replace(/\n/g, "\n");

/** The reminder as a calendar file (pure, for tests). */
export function icsFor(r: HealthReminder, petName: string, now = new Date()): string {
  const [h, m] = r.time.split(":").map(Number);
  const start = new Date(`${r.date}T00:00:00`);
  start.setHours(h || 9, m || 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const rule = calendarRule(r);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//4D Ages//Reminders//EN", "BEGIN:VEVENT",
    `UID:${r.id}-${start.getTime()}@4dages`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${petName}: ${r.title}`)}`, "DESCRIPTION:Added by 4D Ages.",
    ...(rule ? [`RRULE:FREQ=${rule.frequency === "monthly" ? "MONTHLY" : "YEARLY"};INTERVAL=${rule.interval}`] : []),
    "BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", `DESCRIPTION:${esc(r.title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export async function addToCalendar(r: HealthReminder, petName: string): Promise<string> {
  const blob = new Blob([icsFor(r, petName)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${petName} - ${r.title}.ics`.replace(/[\/:*?"<>|]/g, "");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return `ics-${r.id}`;
}

export async function removeFromCalendar(_eventId: string): Promise<void> {}
