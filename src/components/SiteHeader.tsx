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
import { ACCESSIBILITY_URL, APP_NAME, CONTACT_EMAIL, LICENCES_URL, PRIVACY_URL, TERMS_URL, WORDMARK_ASPECT } from "../brand";
import { TYPE } from "../theme";
import { Avatar } from "./ui";
import { Icon, IconName } from "./Icon";
import { ACTIONS, Action, ICON, LABEL, PET_ACTIONS } from "./Fab";
import { VoiceRecorderSheet } from "./Voice";
import { AddChildSheet } from "./Screen";

/*
 * The website on a computer: a header across the top of every page, like any website's, in place of the phone's top bar, bottom tabs and
 * "+" button. The pages are links (the current one underlined), and the profile, "Add" and account menus drop down from their buttons.
 * Shown only on a wide window (see useWide); phones, and narrow browser windows, keep the app's own layout.
 */

/** How wide the website's content gets, in the middle of the window. */
export const SITE_MAX = 1200;

const KID_LINKS = [["/", "Home"], ["/milestones", "Milestones"], ["/growth", "Growth"], ["/book", "Book"], ["/family", "Family"]] as const;
const PET_LINKS = [["/", "Home"], ["/growth", "Health"], ["/milestones", "Stories"], ["/book", "Book"], ["/family", "Family"]] as const;

type Hover = PressableStateCallbackType & { hovered?: boolean };
/** A Pressable's style with the mouse over it (the website's library reports `hovered`). */
const hover = (base: StyleProp<ViewStyle>, over: ViewStyle) => (s: PressableStateCallbackType) => [base, (s as Hover).hovered || s.pressed ? over : null];

type MenuName = "profile" | "add" | "account";

export function SiteHeader() {
  const t = useTheme();
  const path = usePathname();
  const active = useActiveChild();
  const pet = isPet(active);
  const [open, setOpen] = useState<MenuName | null>(null);
  const toggle = (m: MenuName) => setOpen((o) => (o === m ? null : m));

  // Escape closes an open menu, as on any website
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  const links = pet ? PET_LINKS : KID_LINKS;
  const here = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <View style={{ zIndex: 20, backgroundColor: t.bg, borderBottomWidth: 1, borderBottomColor: t.line }}>
      {open ? <Pressable onPress={() => setOpen(null)} focusable={false} aria-hidden style={{ position: "fixed" as "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 24, width: "100%", maxWidth: SITE_MAX, alignSelf: "center", paddingHorizontal: 32, height: 72 }}>
        <Pressable onPress={() => router.navigate("/")} accessibilityRole="link">
          <Image source={WORDMARKS[t.key]} accessibilityLabel={`${APP_NAME}, home`} style={{ height: 40, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" contentPosition="left" />
        </Pressable>

        <View role="navigation" aria-label="Pages" style={{ flexDirection: "row", gap: 4, flex: 1 }}>
          {links.map(([href, label]) => {
            const on = here(href);
            return (
              <Pressable key={href} onPress={() => router.navigate(href)} accessibilityRole="link" aria-current={on ? "page" : undefined} style={hover({ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 }, { backgroundColor: withAlpha(t.ink, 0.06) })}>
                <Text style={[TYPE.labelLarge, { fontSize: 15, color: on ? t.ink : t.ink2, fontWeight: on ? "700" : "500" }]}>{label}</Text>
                <View style={{ position: "absolute", left: 14, right: 14, bottom: 4, height: 3, borderRadius: 2, backgroundColor: on ? t.accent : "transparent" }} />
              </Pressable>
            );
          })}
        </View>

        {active && active.role !== "viewer" ? (
          <View>
            <Pressable onPress={() => toggle("add")} accessibilityRole="button" aria-haspopup="menu" aria-expanded={open === "add"} style={hover({ flexDirection: "row", alignItems: "center", gap: 6, height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: t.accent }, { opacity: 0.9 })}>
              <Icon name="plus" size={20} color={t.onAccent} />
              <Text style={[TYPE.labelLarge, { color: t.onAccent, fontSize: 15 }]}>Add</Text>
            </Pressable>
            {open === "add" ? <AddMenu pet={pet} onClose={() => setOpen(null)} /> : null}
          </View>
        ) : null}

        <View>
          <Pressable onPress={() => toggle("profile")} accessibilityRole="button" accessibilityLabel={active ? `Profile: ${active.name}. Change profile` : "Choose a profile"} aria-haspopup="menu" aria-expanded={open === "profile"} style={hover({ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4, paddingRight: 10, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.outline }, { backgroundColor: withAlpha(t.ink, 0.05) })}>
            {active ? <Avatar child={active} size={34} /> : null}
            <Text style={[TYPE.labelLarge, { color: t.ink, maxWidth: 140 }]} numberOfLines={1}>{active?.name ?? "Profiles"}</Text>
            <Icon name="chevron-down" size={18} color={t.ink2} />
          </Pressable>
          {open === "profile" ? <ProfileMenu onClose={() => setOpen(null)} /> : null}
        </View>

        <View>
          <Pressable onPress={() => toggle("account")} accessibilityRole="button" accessibilityLabel="Account and more" aria-haspopup="menu" aria-expanded={open === "account"} style={hover({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, { backgroundColor: withAlpha(t.ink, 0.06) })}>
            <Icon name="menu" size={24} color={t.ink2} />
          </Pressable>
          {open === "account" ? <AccountMenu onClose={() => setOpen(null)} /> : null}
        </View>
      </View>
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
  const [recording, setRecording] = useState(false);
  // the same choices as the phone's "+" button, photos first
  const choose = (a: Action) => {
    if (a === "photo") { onClose(); addPhotosFlow(); }
    else if (a === "voice") setRecording(true);
    else { onClose(); setEntrySheet({ kind: a }); }
  };
  return (
    <>
      <Dropdown label="Add">
        {[...(pet ? PET_ACTIONS : ACTIONS)].reverse().map((a) => <Item key={a} icon={ICON[a]} label={LABEL(a, pet)} onPress={() => choose(a)} />)}
      </Dropdown>
      {recording ? (
        <VoiceRecorderSheet onClose={() => { setRecording(false); onClose(); }} onDone={(item) => { setRecording(false); onClose(); setTimeout(() => setEntrySheet({ kind: "story", title: "Voice note", media: [item] }), 250); }} />
      ) : null}
    </>
  );
}

function ProfileMenu({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const kids = useStore((s) => s.kids);
  const setActive = useStore((s) => s.setActive);
  const active = useActiveChild();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <Dropdown label="Profiles" width={280}>
        {kids.map((k) => {
          const a = smartAge(k.birth);
          return (
            <Item key={k.id} label={k.name} sub={k.expecting ? weekLabel(k.birth, todayISO()) : `${a.value} ${a.unit}`} onPress={() => { setActive(k.id); onClose(); }}>
              <Avatar child={k} size={32} />
              {k.id === active?.id ? <View style={{ position: "absolute", right: 16 }}><Icon name="check" size={18} color={t.accent} /></View> : null}
            </Item>
          );
        })}
        {kids.length ? <Divider /> : null}
        <Item icon="plus" label="Add a profile" onPress={() => setAdding(true)} />
      </Dropdown>
      <AddChildSheet visible={adding} onClose={() => { setAdding(false); onClose(); }} />
    </>
  );
}

function AccountMenu({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const preview = useStore((s) => s.preview);
  const clearSample = useStore((s) => s.clearSample);
  const go = (p: "/classics" | "/health" | "/settings" | "/access") => { onClose(); router.navigate(p); };
  const out = async () => {
    onClose();
    await syncAll().catch(() => undefined); // anything not yet in the account goes there first
    await signOut();
  };
  return (
    <Dropdown label="Account and more">
      <Item icon="classics" label="Classics" onPress={() => go("/classics")} />
      <Item icon="health" label="Health" onPress={() => go("/health")} />
      <Item icon="settings" label="Settings" onPress={() => go("/settings")} />
      {session || preview ? <Divider /> : null}
      {preview ? <Item icon="logout" label="Leave the sample family" onPress={() => { onClose(); clearSample(); }} /> : null}
      {session && !preview ? <Item icon="logout" label="Sign out" onPress={out} /> : null}
    </Dropdown>
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
        {link("Contact", `mailto:${CONTACT_EMAIL}`)}
      </View>
    </View>
  );
}
