import React, { useEffect, useMemo, useState } from "react";
import { readReminders } from "../src/lib/reminders";
import { REMINDERS_ID } from "../src/lib/classics";
import { Appearance, Platform } from "react-native";
import { Stack, router } from "expo-router";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Fraunces_600SemiBold_Italic } from "@expo-google-fonts/fraunces";
import { useStore } from "../src/lib/store";
import { SyncManager } from "../src/components/SyncManager";
import { ShareIntakeListener } from "../src/components/ShareIntakeListener";
import { ImportSheet } from "../src/components/ImportSheet";
import { ShareSheet } from "../src/components/ShareSheet";
import { UpdatePrompt } from "../src/components/UpdatePrompt";
import { FamilyPhotoSync } from "../src/components/FamilyPhotoSync";
import { DriveAutoBackup } from "../src/components/DriveAutoBackup";
import { Toast } from "../src/components/Toast";
import { Confetti } from "../src/components/Confetti";
import { WebToast } from "../src/components/WebToast";
import { WebAlert } from "../src/components/WebAlert";
import { CookieBanner } from "../src/components/CookieBanner";
import { AppColumn } from "../src/components/AppColumn";
import { AgreementGate } from "../src/components/AgreementGate";
import { BirthdayConfetti } from "../src/components/BirthdayConfetti";
import { BirthStoryHost } from "../src/components/BirthStory";
import { NewPasswordAfterReset } from "../src/components/AccountSheets";
import { AppLock } from "../src/components/AppLock";
import { EntrySheet } from "../src/components/EntrySheet";
import { EditPhotoSheet } from "../src/components/EditPhotoSheet";
import { TagBrowserSheet } from "../src/components/TagBrowser";
import { ThumbBackfill } from "../src/components/ThumbBackfill";
import { BrandScreen } from "../src/components/BrandScreen";
import { ICON_FONT } from "../src/components/Icon";
import { configureNotifications, scheduleNotifications } from "../src/lib/notifications";
import { clearNotificationTap, useNotificationTap } from "../src/lib/notificationTap";
import { MILESTONE_CATALOG } from "../src/lib/types";
import { milestonesLogged } from "../src/lib/selectors";
import { reachedDefIds } from "../src/lib/development";
import { pickChild, shouldHandleNotification } from "../src/lib/resume";
import { resume } from "../src/lib/resumeStorage";
import { completeAuthLink, isConfigured, useAuthReady, useSession } from "../src/lib/supabase";
import { parseAuthCallback } from "../src/lib/authLink";
import { setAuthLinkError } from "../src/lib/authLinkState";

configureNotifications();

/** The verification email's button opens the app with the sign-in in its link: finish signing in (whenever the app is opened by one). */
function useAuthLinks() {
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!parseAuthCallback(url)) return;
      completeAuthLink(url as string).then(() => setAuthLinkError("")).catch((e: unknown) => setAuthLinkError(e instanceof Error ? e.message : String(e)));
    };
    Linking.getInitialURL().then(handle).catch(() => undefined);
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ ...ICON_FONT, Fraunces_600SemiBold_Italic });
  const hydrated = useStore((s) => s.hydrated);
  const appearance = useStore((s) => s.appearance);
  // the phone's own parts (date and time pickers, the status bar) follow the choice in Settings too
  useEffect(() => {
    if (Platform.OS !== "web") Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance); // a browser follows the page's own colours
  }, [appearance]);
  const kids = useStore((s) => s.kids);
  const notif = useStore((s) => s.notif);
  const memories = useStore((s) => s.memories);
  const preview = useStore((s) => s.preview);
  const authReady = useAuthReady();
  const session = useSession();
  useAuthLinks();

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
  const ready = (fontsLoaded || !!fontError) && hydrated && resumed && authReady;

  // Who may see what. Signed out: only the login page exists (no + button, no navigation, nothing reachable by going back or by a link).
  // Signed in without a child yet: the welcome page, where a child is added or a partner's book joined. Then the app itself.
  // A build without sign-in set up (no Supabase in .env) keeps working on this phone only; the sample family can be explored signed out.
  const signedIn = !isConfigured || !!session || preview;
  const hasKids = kids.length > 0;

  // Keep the scheduled notifications (birthdays, monthly cheers, "is this happening?") in line with the children, settings and ticked milestones
  const kidsKey = useMemo(() => kids.map((k) => `${k.id}|${k.name}|${k.birth}|${k.expecting ? 1 : 0}|${k.role ?? ""}|${k.kind ?? ""}|${k.gotchaDay ?? ""}`).join(";"), [kids]);
  // a pet's health reminders: the notifications follow them
  const classics = useStore((s) => s.classics);
  const remindersKey = useMemo(() => classics.filter((c) => c.id === REMINDERS_ID).map((c) => `${c.childId}:${c.values.list ?? ""}`).join(";"), [classics]);
  const reachedKey = useMemo(() => kids.map((k) => `${k.id}:${memories.filter((m) => m.childId === k.id && m.type === "milestone").map((m) => m.milestoneId).sort().join(",")}`).join(";"), [kids, memories]);
  useEffect(() => {
    if (!hydrated) return;
    const reached: Record<string, Set<string>> = {};
    for (const k of kids) reached[k.id] = reachedDefIds(MILESTONE_CATALOG, milestonesLogged(memories, k.id));
    scheduleNotifications(kids.map((k) => ({ id: k.id, name: k.name, birth: k.birth, expecting: k.expecting, role: k.role, kind: k.kind, gotchaDay: k.gotchaDay,
      reminders: k.kind === "pet" ? readReminders(classics.find((c) => c.childId === k.id && c.id === REMINDERS_ID)?.values) : undefined })), notif, reached).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, kidsKey, notif, reachedKey, remindersKey]);

  // Tapping a birthday reminder opens that child's year in review; a milestone cheer or question opens their milestones.
  // Each tap is acted on ONCE: Android can hand the same tap back later (restoring the app from recents), and without this it would
  // pull you back to that notification's child every time you reopened the app.
  const response = useNotificationTap();
  useEffect(() => {
    const d = response?.notification.request.content.data as { kind?: string; childId?: string; turning?: number } | undefined;
    const nid = response?.notification.request.identifier;
    if (!ready || !signedIn || !d || !d.childId || !shouldHandleNotification(nid, resume.get().handledNotification)) return;
    const st = useStore.getState();
    if (!st.kids.some((k) => k.id === d.childId)) return;
    resume.save({ handledNotification: nid });
    clearNotificationTap();
    if (d.kind === "birthday") {
      st.setActive(d.childId);
      st.setPendingRecap({ childId: d.childId, year: d.turning ?? 1 });
      router.navigate("/");
    } else if (d.kind === "milestone-age" || d.kind === "milestone-ask") {
      st.setActive(d.childId);
      router.navigate("/milestones");
    } else if (d.kind === "gotcha") {
      st.setActive(d.childId);
      router.navigate("/");
    } else if (d.kind === "health-reminder") {
      st.setActive(d.childId);
      router.navigate("/growth"); // a pet's Health
    } else if (d.kind === "bump-photo") {
      st.setActive(d.childId);
      router.navigate("/growth");
    } else if (d.kind === "monthly-photo") {
      st.setActive(d.childId);
      router.navigate({ pathname: "/classic/[id]", params: { id: "grid" } });
    }
  }, [response, ready, signedIn]);

  if (!ready) return <BrandScreen />;
  return (
    <SafeAreaProvider>
      <SyncManager />
      <ShareIntakeListener />
      <ThumbBackfill />
      <UpdatePrompt />
      {signedIn && hasKids ? <FamilyPhotoSync /> : null}
      {signedIn && hasKids ? <DriveAutoBackup /> : null}
      <AppColumn>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn && hasKids}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="family" />
          <Stack.Screen name="tree" />
          <Stack.Screen name="my-family" />
          <Stack.Screen name="foods" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="classics" />
          <Stack.Screen name="classic/[id]" />
          <Stack.Screen name="health" />
          <Stack.Screen name="pregnancy" />
          <Stack.Screen name="access" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !hasKids}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="share" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="join" />
      </Stack>
      </AppColumn>
      {signedIn ? <ImportSheet /> : null}
      {signedIn ? <ShareSheet /> : null}
      <NewPasswordAfterReset />
      {/* the terms, the privacy policy and consent to keeping health information, before anything else */}
      <AgreementGate />
      <AppLock />
      {/* the forms that edit memories: shared by the tabs and the pages opened from the menu */}
      {signedIn && hasKids ? <EntrySheet /> : null}
      {signedIn && hasKids ? <EditPhotoSheet /> : null}
      {signedIn && hasKids ? <TagBrowserSheet /> : null}
      {/* last, so it shows above every screen */}
      {signedIn && hasKids ? <BirthStoryHost /> : null}
      <Toast />
      <Confetti />
      <WebToast />
      <WebAlert />
      <CookieBanner />
      {signedIn && hasKids ? <BirthdayConfetti /> : null}
    </SafeAreaProvider>
  );
}
