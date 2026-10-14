import * as Notifications from "expo-notifications";

/** The last notification tapped (the phone only; see notificationTap.web.ts). */
export const useNotificationTap = () => Notifications.useLastNotificationResponse();
export const clearNotificationTap = () =>
  (Notifications as unknown as { clearLastNotificationResponseAsync?: () => Promise<void> }).clearLastNotificationResponseAsync?.()?.catch(() => undefined);
