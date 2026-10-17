import React, { useEffect, useState } from "react";
import { Linking, Pressable, Switch, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "../lib/useTheme";
import { CookieChoice, closeCookieSettings, saveCookieChoice, useCookieChoice } from "../lib/cookieConsent";
import { COOKIES_URL } from "../brand";
import { TYPE } from "../theme";
import { Btn } from "./ui";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
/*
 * The cookie choices, on the first visit and whenever they're opened again (Settings, or "Cookies" at the bottom of the page): a card at
 * the bottom of the page that doesn't block it. "Accept all" and "Necessary only" are side by side and look alike, so saying no is as
 * easy as saying yes; "Choose" shows each group with its own switch. What's needed to work is always on and says so.
 */
const GROUPS: { id: keyof CookieChoice | "needed"; title: string; text: string }[] = [
  { id: "needed", get title() { return tr("Needed to work"); }, get text() { return tr("Keeps you signed in, a copy of your books, your photos and videos in this browser, and these choices. Always on."); } },
  { id: "preferences", get title() { return tr("Preferences"); }, get text() { return tr("Remembers the page you were on, so 4D Ages opens there next time."); } },
  { id: "google", get title() { return tr("Google services"); }, get text() { return tr("Lets you back up to Google Drive. Google's own code runs on the page and sets Google's cookies."); } },
];

export function CookieBanner() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { choice, open } = useCookieChoice();
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState<CookieChoice>(choice ?? { preferences: false, google: false });
  useEffect(() => {
    if (open) { setDraft(choice ?? { preferences: false, google: false }); setChoosing(!!choice); }
  }, [open, choice]);
  if (!open) return null;
  const wide = width >= 640;
  return (
    <View role="dialog" aria-label={tr("Cookie choices")} style={{ position: "absolute", left: wide ? 24 : 12, right: wide ? undefined : 12, bottom: wide ? 24 : 12, width: wide ? 440 : undefined, zIndex: 400, borderRadius: 24, padding: 20, backgroundColor: t.surfaceHigh, borderWidth: 1, borderColor: t.line, boxShadow: "0 16px 48px rgba(0,0,0,.22)" } as object}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="lock" size={22} color={t.accentDeep} />
        <Text role="heading" aria-level={2} style={[TYPE.titleLarge, { color: t.ink, flex: 1 }]}>{tr("Cookies and storage")}</Text>
        {choice ? (
          <Pressable onPress={closeCookieSettings} accessibilityRole="button" accessibilityLabel={tr("Close")} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: t.bg2 }}><Icon name="x" size={18} color={t.ink2} /></Pressable>
        ) : null}
      </View>
      <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 10 }]}>
        {tr("4D Ages keeps only what it needs in your browser. No advertising, no analytics, no tracking.")}{" "}
        <Text accessibilityRole="link" onPress={() => Linking.openURL(COOKIES_URL)} style={{ color: t.accentDeep, textDecorationLine: "underline" }}>{tr("Cookie policy")}</Text>
      </Text>

      {choosing ? (
        <View style={{ marginTop: 14, gap: 12 }}>
          {GROUPS.map((g) => {
            const on = g.id === "needed" ? true : draft[g.id];
            return (
              <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.titleSmall, { color: t.ink }]}>{g.title}</Text>
                  <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{g.text}</Text>
                </View>
                <Switch
                  value={on}
                  disabled={g.id === "needed"}
                  onValueChange={(v) => { if (g.id !== "needed") setDraft((d) => ({ ...d, [g.id]: v })); }}
                  accessibilityLabel={g.id === "needed" ? tr("{0}, always on", [g.title]) : g.title}
                  trackColor={{ true: t.accent, false: t.outline }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
          <Btn label={tr("Save my choices")} onPress={() => saveCookieChoice(draft)} style={{ marginTop: 4 }} />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Btn label={tr("Accept all")} kind="soft" onPress={() => saveCookieChoice({ preferences: true, google: true })} style={{ flex: 1 }} />
        <Btn label={tr("Necessary only")} kind="soft" onPress={() => saveCookieChoice({ preferences: false, google: false })} style={{ flex: 1 }} />
      </View>
      {!choosing ? (
        <Pressable onPress={() => setChoosing(true)} accessibilityRole="button" style={{ alignSelf: "center", marginTop: 10, paddingVertical: 4 }}>
          <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tr("Choose")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
