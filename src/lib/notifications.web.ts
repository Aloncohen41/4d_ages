/*
 * The website's reminders. A browser can't schedule notifications for when the site is closed the way the phone can (that needs a push
 * service), so on the web the reminders live in the app: these do nothing, and Settings says reminders come on the phone app.
 */
import type { NotifPrefs } from "./types";
import type { HealthReminder } from "./reminders";
import { THEMES } from "../theme";

export const BRAND = THEMES.pink.accent;
export function configureNotifications() {}
export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}
export async function scheduleNotifications(
  _kids: { id: string; name: string; birth: string; theme?: string; emoji?: string; expecting?: boolean; role?: string; kind?: string; gotchaDay?: string; reminders?: HealthReminder[] }[],
  _prefs: NotifPrefs,
  _reached: Record<string, Set<string>>,
): Promise<number> {
  return 0;
}
export async function sendTestNotification(_name: string, _kind: "birthday" | "cheer" | "ask" = "birthday") {}
