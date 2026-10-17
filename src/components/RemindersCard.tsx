import React, { useState } from "react";
import { onWeb } from "../lib/onWeb";
import { Switch, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { APP_NAME } from "../brand";
import { requestNotificationPermission, sendTestNotification } from "../lib/notifications";
import { Btn, Seg } from "./ui";

import { tr } from "../lib/i18n";
/** Notifications: birthdays, a cheer on the day they reach each new month, and a gentle "is this happening?" before a new stage. */
export function RemindersCard() {
  const t = useTheme();
  const notif = useStore((s) => s.notif);
  const setNotif = useStore((s) => s.setNotif);
  const child = useActiveChild();
  const [msg, setMsg] = useState("");

  const toggle = async (on: boolean) => {
    setMsg("");
    if (on) {
      const ok = await requestNotificationPermission();
      if (!ok) {
        setNotif({ enabled: false });
        setMsg(onWeb ? tr("Notifications are blocked for this site. Allow them in your browser (the icon beside the address), then try again.") : tr("Notifications are blocked for this app. Turn them on in your phone's Settings → Apps → {0} → Notifications.", [APP_NAME]));
        return;
      }
    }
    setNotif({ enabled: on });
  };
  const preview = (kind: "birthday" | "cheer" | "ask") => {
    if (!child) return;
    sendTestNotification(child.name, kind);
    setMsg(onWeb ? tr("Sent: it will appear in about 5 seconds. On the website, reminders show while 4D Ages is open in your browser or installed on your home screen.") : tr("Sent — it will arrive in about 5 seconds. Lock your phone or leave the app to see it."));
  };
  const row = (title: string, sub: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14 }}>{title}</Text>
        <Text style={{ color: t.ink3, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{sub}</Text>
      </View>
      <Switch accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.bg3 }} thumbColor={value ? t.onAccent : t.outline} ios_backgroundColor={t.bg3} />
    </View>
  );

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>{tr("Reminders and cheers")}</Text>
          <Text style={{ color: t.ink3, fontSize: 12.5, lineHeight: 18, marginTop: 3 }}>{tr("Birthdays, a little celebration for every new month, and a gentle nudge about milestones.")}</Text>
        </View>
        <Switch accessibilityLabel={tr("Reminders and cheers")} value={notif.enabled} onValueChange={toggle} trackColor={{ true: t.accent, false: t.bg3 }} thumbColor={notif.enabled ? t.onAccent : t.outline} ios_backgroundColor={t.bg3} />
      </View>

      {notif.enabled ? (
        <View style={{ marginTop: 6 }}>
          {row("Weekly bump photo", "In a pregnancy, a reminder each week to take the bump photo, for the video of the bump growing.", notif.bumpPhoto !== false, (v) => setNotif({ bumpPhoto: v }))}
          {row("Monthly photo", "In the first year, a reminder on each month's birthday to take the photo for the Monthly photos page.", notif.monthlyPhoto !== false, (v) => setNotif({ monthlyPhoto: v }))}
          {row("Celebrate every month", "“Wow — they're 6 months old today!” on the day, with a peek at their milestones.", notif.milestoneAges !== false, (v) => setNotif({ milestoneAges: v }))}
          {row("“Is this happening?”", "A little before each new stage begins, we ask whether they've started any of its milestones.", notif.milestoneAsks !== false, (v) => setNotif({ milestoneAsks: v }))}

          <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 18, marginBottom: 6 }}>{tr("Remind me before a birthday")}</Text>
          <Seg options={[{ id: 1, label: tr("1 day") }, { id: 3, label: tr("3 days") }, { id: 7, label: tr("1 week") }]} value={notif.daysBefore} onChange={(v) => setNotif({ daysBefore: v })} />
          <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 12, marginBottom: 6 }}>{tr("Time of day")}</Text>
          <Seg options={[{ id: 8, label: tr("8 am") }, { id: 9, label: tr("9 am") }, { id: 12, label: tr("Noon") }, { id: 18, label: tr("6 pm") }]} value={notif.hour} onChange={(v) => setNotif({ hour: v })} />

          {child ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              <Btn label={tr("Preview a cheer")} kind="soft" onPress={() => preview("cheer")} style={{ flex: 1 }} />
              <Btn label={tr("Preview a question")} kind="soft" onPress={() => preview("ask")} style={{ flex: 1 }} />
            </View>
          ) : null}
        </View>
      ) : null}
      {msg ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5, marginTop: 10, lineHeight: 18 }}>{msg}</Text> : null}
    </View>
  );
}
