/*
 * The website's reminders: the same plan as the phone's (birthdays, the monthly cheers and milestone questions, monthly and bump photos, a
 * pet's gotcha day and health reminders), shown as the browser's notifications. A website can only show them while it's open (in a tab, or
 * installed on the home screen), so: anything due while it's open is shown on time, and on opening, today's reminders that were missed are
 * shown once. (Reminders when the site is closed need a push service; the phone app has them.)
 */
import type { NotifPrefs } from "./types";
import type { HealthReminder } from "./reminders";
import { THEMES } from "../theme";
import { planBirthdayNotifications } from "./birthdayPlan";
import { planMilestoneNotifications, sampleMilestoneNotification } from "./milestonePlan";
import { planMonthlyPhotoNotifications } from "./remember";
import { planBumpPhotoNotifications } from "./pregnancy";
import { planGotchaNotifications, planHealthReminders } from "./petPlan";

import { tr } from "./i18n";
export const BRAND = THEMES.pink.accent;
const SHOWN = "4d-reminders-shown";
const timers: ReturnType<typeof setTimeout>[] = [];

export function configureNotifications() {}

const supported = () => typeof window !== "undefined" && tr("Notification") in window;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

async function show(title: string, body: string, tag: string) {
  if (!supported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: "/icon-192.png", badge: "/icon-192.png" });
    else new Notification(title, { body, tag, icon: "/icon-192.png" });
  } catch {
    /* the browser wouldn't show it */
  }
}

const shownIds = (): string[] => { try { return JSON.parse(localStorage.getItem(SHOWN) ?? "[]"); } catch { return []; } };
const markShown = (id: string) => { try { localStorage.setItem(SHOWN, JSON.stringify([...shownIds(), id].slice(-200))); } catch { /* storage is off */ } };

export async function scheduleNotifications(
  kids: { id: string; name: string; birth: string; theme?: string; emoji?: string; expecting?: boolean; role?: string; kind?: string; gotchaDay?: string; reminders?: HealthReminder[] }[],
  prefs: NotifPrefs,
  reached: Record<string, Set<string>>,
): Promise<number> {
  timers.splice(0).forEach(clearTimeout);
  if (!supported() || Notification.permission !== "granted") return 0;
  const born = kids.filter((k) => !k.expecting);
  const children = born.filter((k) => k.kind !== "pet");
  const pets = born.filter((k) => k.kind === "pet" && k.role !== "viewer");
  const now = new Date();
  // from the start of today: today's missed reminders are shown once on opening
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plan = [...planBirthdayNotifications(born, prefs, startOfDay), ...planMilestoneNotifications(children, prefs, startOfDay, reached), ...planMonthlyPhotoNotifications(children, prefs, startOfDay),
    ...planGotchaNotifications(pets, prefs, startOfDay), ...planHealthReminders(pets.map((p) => ({ id: p.id, name: p.name, reminders: p.reminders ?? [] })), startOfDay), ...planBumpPhotoNotifications(kids, prefs, startOfDay)]
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const shown = new Set(shownIds());
  const id = (p: { title: string; date: Date }) => `${p.date.toISOString().slice(0, 16)}|${p.title}`;
  let count = 0;
  for (const p of plan) {
    const key = id(p);
    if (shown.has(key)) continue;
    const wait = p.date.getTime() - now.getTime();
    if (wait <= 0 && p.date >= startOfDay) {
      markShown(key);
      await show(p.title, p.body, key); // due earlier today: shown now
      count++;
    } else if (wait > 0 && wait < 24 * 3600 * 1000) {
      timers.push(setTimeout(() => { markShown(key); show(p.title, p.body, key); }, wait)); // due later today: shown on time, while the site is open
      count++;
    }
  }
  return count;
}

/** A notification in 5 seconds, so you can see that reminders work in this browser. */
export async function sendTestNotification(name: string, kind: "birthday" | "cheer" | "ask" = "birthday") {
  if (!(await requestNotificationPermission())) return;
  const sample = kind === "birthday" ? { title: `🎈 ${name} turns 3 in 3 days`, body: tr("This is how your birthday reminders will look.") } : sampleMilestoneNotification(name, kind);
  timers.push(setTimeout(() => show(sample.title, sample.body, `test-${Date.now()}`), 5000));
}
