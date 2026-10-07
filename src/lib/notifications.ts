import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { NotifPrefs } from "./types";
import { THEMES } from "../theme";
import { planBirthdayNotifications } from "./birthdayPlan";
import { planMilestoneNotifications, sampleMilestoneNotification } from "./milestonePlan";

export /** The app's brand colour on notifications (the tint behind the small icon, the LED), kept in step with the theme. */
const BRAND = THEMES.pink.accent;
const CHANNEL = "birthdays";

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Birthdays & memories",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: BRAND,
  });
}

/** Asks Android for permission to show notifications (needed on Android 13+). */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/**
 * Replace everything scheduled with the current plan: birthdays, the monthly "Wow — they're 6 months old today!" cheers, and the
 * "Is this happening?" questions. `reached` lists the milestones already ticked, so we only ask about the rest.
 * Run on launch and whenever the children, settings or ticked milestones change, so the next stretch is always scheduled.
 */
export async function scheduleNotifications(kids: { id: string; name: string; birth: string }[], prefs: NotifPrefs, reached: Record<string, Set<string>>): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  const plan = [...planBirthdayNotifications(kids, prefs, now), ...planMilestoneNotifications(kids, prefs, now, reached)]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 64);
  if (!plan.length) return 0;
  await ensureChannel();
  for (const p of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: p.data, color: BRAND },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL },
    });
  }
  return plan.length;
}

/** A notification in 5 seconds, so you can see that reminders work on this phone. */
export async function sendTestNotification(name: string, kind: "birthday" | "cheer" | "ask" = "birthday") {
  await ensureChannel();
  const sample = kind === "birthday" ? { title: `🎈 ${name} turns 3 in 3 days`, body: "This is how your birthday reminders will look. Tap to open the app." } : sampleMilestoneNotification(name, kind);
  await Notifications.scheduleNotificationAsync({
    content: { title: sample.title, body: sample.body, data: { kind: "test" }, color: BRAND },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}
