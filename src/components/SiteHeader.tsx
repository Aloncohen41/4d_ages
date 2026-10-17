import React, { useEffect, useState } from "react";
import { Linking, Pressable, PressableStateCallbackType, StyleProp, Text, View, ViewStyle } from "react-native";
import { router, usePathname } from "expo-router";
import { Image } from "expo-image";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { WORDMARKS } from "../lib/wordmark";
import { withAlpha } from "../lib/m3";
import { isPet } from "../lib/types";
import { smartAge, todayISO } from "../lib/date";
import { weekLabel } from "../lib/pregnancy";
import { signOut, useSession } from "../lib/supabase";
import { syncAll } from "../lib/sync";
import { addPhotosFlow } from "../lib/addPhotos";
import { openCookieSettings } from "../lib/cookieConsent";
import { ACCESSIBILITY_URL, APP_NAME, CONTACT_EMAIL, COOKIES_URL, LICENCES_URL, PRIVACY_URL, TERMS_URL, WORDMARK_ASPECT } from "../brand";
import { TYPE } from "../theme";
import { Avatar } from "./ui";
import { Icon, IconName } from "./Icon";
import { Action, ICON, LABEL, actionsFor } from "./Fab";
import { VoiceRecorderSheet } from "./Voice";
import { AddChildSheet } from "./Screen";

import { tr } from "../lib/i18n";
/*
 * The website on a computer: a header across the top of every page, like any website's, in place of the phone's top bar, bottom tabs and
 * "+" button. The pages are links (the current one underlined), and the profile, "Add" and account menus drop down from their buttons.
 * Shown only on a wide window (see useWide); phones, and narrow browser windows, keep the app's own layout.
 */

/** How wide the website's content gets, in the middle of the window. */
export const SITE_MAX = 1200;

const KID_LINKS = [["/", "Home"], ["/milestones", "Milestones"], ["/growth", "Growth"], ["/book", "Book"]] as const;
const PET_LINKS = [["/", "Home"], ["/growth", "Health"], ["/milestones", "Stories"], ["/book", "Book"]] as const;

type Hover = PressableStateCallbackType & { hovered?: boolean };
/** A Pressable's style with the mouse over it (the website's library reports `hovered`). */
const hover = (base: StyleProp<ViewStyle>, over: ViewStyle) => (s: PressableStateCallbackType) => [base, (s as Hover).hovered || s.pressed ? over : null];


export function SiteHeader() {
  const t = useTheme();
  const path = usePathname();
  const active = useActiveChild();
  const pet = isPet(active);
  const session = useSession();
  const preview = useStore((s) => s.preview);
  const clearSample = useStore((s) => s.clearSample);
  const [adding, setAdding] = useState(false);

  // Escape closes an open menu, as on any website
  useEffect(() => {
    if (!adding || typeof document === "undefined") return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setAdding(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [adding]);

  const here = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const out = async () => {
    await syncAll().catch(() => undefined); // anything not yet in the account goes there first
    await signOut();
  };
  const link = (href: string, label: string, icon?: IconName) => {
    const on = here(href);
    return (
      <Pressable key={href} onPress={() => goTo(href)} accessibilityRole="link" aria-current={on ? "page" : undefined} style={hover({ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20 }, { backgroundColor: withAlpha(t.ink, 0.06) })}>
        {icon ? <Icon name={icon} size={18} color={on ? t.ink : t.ink2} /> : null}
        <Text style={[TYPE.labelLarge, { fontSize: 15, color: on ? t.ink : t.ink2, fontWeight: on ? "700" : "500" }]}>{label}</Text>
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 4, height: 3, borderRadius: 2, backgroundColor: on ? t.accent : "transparent" }} />
      </Pressable>
    );
  };
  const quiet = hover({ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20 }, { backgroundColor: withAlpha(t.ink, 0.06) });

  return (
    <View style={{ zIndex: 20, backgroundColor: t.bg, borderBottomWidth: 1, borderBottomColor: t.line }}>
      {adding ? <Pressable onPress={() => setAdding(false)} focusable={false} aria-hidden style={{ position: "fixed" as "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, width: "100%", maxWidth: SITE_MAX, alignSelf: "center", paddingHorizontal: 32, height: 72 }}>
        <Pressable onPress={() => goTo("/")} accessibilityRole="link">
          {/* the website always shows the original logo (a child's colours recolour it in the app) */}
          <Image source={WORDMARKS.pink} accessibilityLabel={tr("{0}, home", [APP_NAME])} style={{ height: 44, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" contentPosition="left" />
        </Pressable>
        <View role="navigation" aria-label={tr("Pages")} style={{ flexDirection: "row", alignItems: "center", gap: 2, flex: 1 }}>
          {(pet ? PET_LINKS : KID_LINKS).map(([href, label]) => link(href, tr(label)))}
          <View style={{ flex: 1 }} />
          {/* the pages that are in the phone's menu, in the same order */}
          {link("/family", tr("Family"), "family")}
          {link("/classics", tr("Classics"), "classics")}
          {pet ? null : link("/health", tr("Health"), "health")}
          {link("/settings", tr("Settings"), "settings")}
        </View>
        {preview ? (
          <Pressable onPress={clearSample} accessibilityRole="button" style={quiet}>
            <Icon name="logout" size={18} color={t.ink2} /><Text style={[TYPE.labelLarge, { fontSize: 15, color: t.ink2 }]}>{tr("Leave the sample")}</Text>
          </Pressable>
        ) : session ? (
          <Pressable onPress={out} accessibilityRole="button" style={quiet}>
            <Icon name="logout" size={18} color={t.ink2} /><Text style={[TYPE.labelLarge, { fontSize: 15, color: t.ink2 }]}>{tr("Sign out")}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* every profile side by side, as on the phone, with adding on the right */}
      <View style={{ backgroundColor: t.bg2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, width: "100%", maxWidth: SITE_MAX, alignSelf: "center", paddingHorizontal: 32, paddingVertical: 10 }}>
          <Profiles />
          {active && active.role !== "viewer" ? (
            <View>
              <Pressable onPress={() => setAdding((v) => !v)} accessibilityRole="button" aria-haspopup="menu" aria-expanded={adding} style={hover({ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: t.accent }, { opacity: 0.9 })}>
                <Icon name="plus" size={20} color={t.onAccent} />
                <Text style={[TYPE.labelLarge, { color: t.onAccent, fontSize: 15 }]}>{tr("Add")}</Text>
              </Pressable>
              {adding ? <AddMenu pet={pet} onClose={() => setAdding(false)} /> : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Going to a page from the header. The tab pages live together in one pager that remembers which of them was showing, so going to one
 * of them from another page first returns to that pager, then picks the page asked for (never the one that happened to be open before).
 */
function goTo(href: string) {
  const tab = href === "/" || /^\/(milestones|growth|book)$/.test(href);
  if (tab && router.canDismiss()) router.dismissAll();
  router.navigate(href as never);
}

/** The profiles, side by side: each with its picture, name and age; the chosen one filled in. */
function Profiles() {
  const t = useTheme();
  const path = usePathname();
  const kids = useStore((s) => s.kids);
  const setActive = useStore((s) => s.setActive);
  const active = useActiveChild();
  const [adding, setAdding] = useState(false);
  return (
    <View role="group" aria-label={tr("Profiles")} style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {kids.length > 1 ? (
        // everyone together (app/my-family.tsx)
        <Pressable onPress={() => router.navigate("/my-family")} accessibilityRole="link" aria-current={path === "/my-family" ? "page" : undefined} style={hover([{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4, paddingRight: 14, height: 44, borderRadius: 22, borderWidth: 1 }, path === "/my-family" ? { backgroundColor: t.chipOn, borderColor: t.chipOn } : { borderColor: t.outline }], { backgroundColor: withAlpha(t.ink, 0.05) })}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name="family" size={18} color={t.onAccentSoft} /></View>
          <Text style={[TYPE.labelLarge, { color: path === "/my-family" ? t.onChipOn : t.ink }]}>{tr("My family")}</Text>
        </Pressable>
      ) : null}
      {kids.map((k) => {
        const on = k.id === active?.id;
        const a = smartAge(k.birth);
        return (
          <Pressable key={k.id} onPress={() => setActive(k.id)} accessibilityRole="button" aria-pressed={on} style={hover([{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4, paddingRight: 14, height: 44, borderRadius: 22, borderWidth: 1 }, on ? { backgroundColor: t.chipOn, borderColor: t.chipOn } : { borderColor: t.outline }], on ? {} : { backgroundColor: withAlpha(t.ink, 0.05) })}>
            <Avatar child={k} size={34} />
            <View>
              <Text style={[TYPE.labelLarge, { color: on ? t.onChipOn : t.ink }]} numberOfLines={1}>{k.name}</Text>
              <Text style={[TYPE.labelSmall, { color: on ? t.onChipOn : t.ink3 }]}>{k.expecting ? weekLabel(k.birth, todayISO()) : `${a.value} ${a.unit}`}</Text>
            </View>
          </Pressable>
        );
      })}
      <Pressable onPress={() => setAdding(true)} accessibilityRole="button" style={hover({ flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.accent }, { backgroundColor: withAlpha(t.accent, 0.08) })}>
        <Icon name="plus" size={18} color={t.accentDeep} />
        <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tr("Add a profile")}</Text>
      </Pressable>
      <AddChildSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

/** A menu dropping down under its button, lined up with the button's right edge. */
function Dropdown({ label, width = 260, children }: { label: string; width?: number; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View role="menu" aria-label={label} style={{ position: "absolute", top: 52, right: 0, width, paddingVertical: 8, borderRadius: 16, backgroundColor: t.surfaceHigh, borderWidth: 1, borderColor: t.line, boxShadow: "0 12px 32px rgba(0,0,0,.18)" } as ViewStyle}>
      {children}
    </View>
  );
}

function Item({ icon, label, sub, onPress, children }: { icon?: IconName; label: string; sub?: string; onPress: () => void; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="menuitem" style={hover({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 44, paddingVertical: 6 }, { backgroundColor: withAlpha(t.ink, 0.06) })}>
      {children ?? (icon ? <Icon name={icon} size={20} color={t.ink2} /> : null)}
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.labelLarge, { color: t.ink, fontSize: 15 }]} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={[TYPE.labelSmall, { color: t.ink3 }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const Divider = () => {
  const t = useTheme();
  return <View style={{ height: 1, marginVertical: 6, backgroundColor: t.line }} />;
};

function AddMenu({ pet, onClose }: { pet: boolean; onClose: () => void }) {
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const active = useActiveChild();
  const tries = useStore((s) => s.foodTries);
  const [recording, setRecording] = useState(false);
  // the same choices as the phone's "+" button, photos first
  const choose = (a: Action) => {
    if (a === "food") { onClose(); router.navigate({ pathname: "/foods", params: { meal: "1" } }); }
    else if (a === "photo") { onClose(); addPhotosFlow(); }
    else if (a === "voice") setRecording(true);
    else { onClose(); setEntrySheet({ kind: a }); }
  };
  return (
    <>
      <Dropdown label={tr("Add")}>
        {[...actionsFor(active, tries)].reverse().map((a) => <Item key={a} icon={ICON[a]} label={LABEL(a, pet)} onPress={() => choose(a)} />)}
      </Dropdown>
      {recording ? (
        <VoiceRecorderSheet onClose={() => { setRecording(false); onClose(); }} onDone={(item) => { setRecording(false); onClose(); setTimeout(() => setEntrySheet({ kind: "story", title: tr("Voice note"), media: [item] }), 250); }} />
      ) : null}
    </>
  );
}

/** The bottom of every page on a computer: the legal pages and how to reach us. */
export function SiteFooter() {
  const t = useTheme();
  const link = (label: string, url: string) => (
    <Text key={label} accessibilityRole="link" onPress={() => Linking.openURL(url)} style={[TYPE.bodyMedium, { color: t.ink2, textDecorationLine: "underline" }]}>{label}</Text>
  );
  return (
    <View style={{ marginTop: 48, borderTopWidth: 1, borderTopColor: t.line }}>
      <View style={{ width: "100%", maxWidth: SITE_MAX, alignSelf: "center", paddingHorizontal: 32, paddingVertical: 28, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 24 }}>
        <Text style={[TYPE.bodyMedium, { color: t.ink3, flex: 1, minWidth: 200 }]}>© {new Date().getFullYear()} {APP_NAME}</Text>
        {link("Privacy policy", PRIVACY_URL)}
        {link("Terms", TERMS_URL)}
        {link("Accessibility", ACCESSIBILITY_URL)}
        {link("Licences", LICENCES_URL)}
        {link("Cookie policy", COOKIES_URL)}
        <Text accessibilityRole="button" onPress={openCookieSettings} style={[TYPE.bodyMedium, { color: t.ink2, textDecorationLine: "underline" }]}>{tr("Cookie settings")}</Text>
        {link("Contact", `mailto:${CONTACT_EMAIL}`)}
      </View>
    </View>
  );
}
