import React, { useEffect, useMemo, useState } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { useStore } from "../src/lib/store";
import { SyncManager } from "../src/components/SyncManager";
import { ShareIntakeListener } from "../src/components/ShareIntakeListener";
import { ImportSheet } from "../src/components/ImportSheet";
import { ThumbBackfill } from "../src/components/ThumbBackfill";
import { BrandScreen } from "../src/components/BrandScreen";
import { ICON_FONT } from "../src/components/Icon";
import { configureNotifications, scheduleNotifications } from "../src/lib/notifications";
import { MILESTONE_CATALOG } from "../src/lib/types";
import { milestonesLogged } from "../src/lib/selectors";
import { reachedDefIds } from "../src/lib/development";
import { pickChild, shouldHandleNotification } from "../src/lib/resume";
import { resume } from "../src/lib/resumeStorage";

configureNotifications();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ ...ICON_FONT });
  const hydrated = useStore((s) => s.hydrated);
  const kids = useStore((s) => s.kids);
  const notif = useStore((s) => s.notif);
  const memories = useStore((s) => s.memories);

  // Open where you left off: once the saved data is ready, read the small "where I was" record and select that child
  // (falling back to the child the data says was selected, then the first). The app isn't shown until this is done.
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    if (!hydrated || resumed) return;
    resume.load().then((r) => {
      const st = useStore.getState();
      const id = pickChild(st.kids.map((k) => k.id), r.childId, st.activeId);
      if (id && id !== st.activeId) st.setActive(id);
      setResumed(true);
    });
  }, [hydrated, resumed]);
  // …and from then on, remember every change of child straight away
  useEffect(() => {
    if (!resumed) return;
    const st = useStore.getState();
    resume.save({ childId: st.kids.find((k) => k.id === st.activeId)?.id ?? st.kids[0]?.id });
    return useStore.subscribe((s, p) => {
      if (s.activeId !== p.activeId && s.kids.some((k) => k.id === s.activeId)) resume.save({ childId: s.activeId });
    });
  }, [resumed]);
  const ready = (fontsLoaded || !!fontError) && hydrated && resumed;

  // Keep the scheduled notifications (birthdays, monthly cheers, "is this happening?") in line with the children, settings and ticked milestones
  const kidsKey = useMemo(() => kids.map((k) => `${k.id}|${k.name}|${k.birth}`).join(";"), [kids]);
  const reachedKey = useMemo(() => kids.map((k) => `${k.id}:${memories.filter((m) => m.childId === k.id && m.type === "milestone").map((m) => m.milestoneId).sort().join(",")}`).join(";"), [kids, memories]);
  useEffect(() => {
    if (!hydrated) return;
    const reached: Record<string, Set<string>> = {};
    for (const k of kids) reached[k.id] = reachedDefIds(MILESTONE_CATALOG, milestonesLogged(memories, k.id));
    scheduleNotifications(kids.map((k) => ({ id: k.id, name: k.name, birth: k.birth })), notif, reached).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, kidsKey, notif, reachedKey]);

  // Tapping a birthday reminder opens that child's year in review; a milestone cheer or question opens their milestones.
  // Each tap is acted on ONCE: Android can hand the same tap back later (restoring the app from recents), and without this it would
  // pull you back to that notification's child every time you reopened the app.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const d = response?.notification.request.content.data as { kind?: string; childId?: string; turning?: number } | undefined;
    const nid = response?.notification.request.identifier;
    if (!ready || !d || !d.childId || !shouldHandleNotification(nid, resume.get().handledNotification)) return;
    const st = useStore.getState();
    if (!st.kids.some((k) => k.id === d.childId)) return;
    resume.save({ handledNotification: nid });
    (Notifications as unknown as { clearLastNotificationResponseAsync?: () => Promise<void> }).clearLastNotificationResponseAsync?.()?.catch(() => undefined);
    if (d.kind === "birthday") {
      st.setActive(d.childId);
      st.setPendingRecap({ childId: d.childId, year: d.turning ?? 1 });
      router.navigate("/");
    } else if (d.kind === "milestone-age" || d.kind === "milestone-ask") {
      st.setActive(d.childId);
      router.navigate("/milestones");
    }
  }, [response, ready]);

  if (!ready) return <BrandScreen />;
  return (
    <SafeAreaProvider>
      <SyncManager />
      <ShareIntakeListener />
      <ThumbBackfill />
      <Stack screenOptions={{ headerShown: false }} />
      <ImportSheet />
    </SafeAreaProvider>
  );
}
