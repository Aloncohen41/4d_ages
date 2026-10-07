import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useActiveChild, useChildSwitching, useShownChild, useStore, uid } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { THEMES, THEME_ORDER, TYPE } from "../theme";
import { withAlpha } from "../lib/m3";
import { AvatarCrop, KidTheme } from "../lib/types";
import { ageLong, ageTotals, formatDate, smartAge, todayISO } from "../lib/date";
import { pickMedia, toMemories } from "../lib/media";
import { coverOf } from "../lib/display";
import { Avatar, Btn, DateField, Input, Label, PhotoView, Sheet, ThemePicker } from "./ui";
import { EmojiPicker } from "./EmojiPicker";
import { AvatarCropper } from "./AvatarCropper";
import { HScroll } from "./HScroll";
import { APP_NAME, TAGLINE, WORDMARK_ASPECT } from "../brand";
import { Icon } from "./Icon";
import { CollectionSheet, CollectionKind } from "./CollectionSheet";

interface Controls { toTop: () => void; toBottom: () => void; subscribeNearEnd: (cb: () => void) => () => void }
const ScrollControls = React.createContext<Controls>({ toTop: () => undefined, toBottom: () => undefined, subscribeNearEnd: () => () => undefined });
/** Lets a tab's content scroll its page (e.g. "jump to the beginning"). */
export const useScrollControls = () => React.useContext(ScrollControls);
/** Calls `cb` whenever the page is within about two screens of its end (and when the content is too short to scroll): used to add older posts. */
export function useNearEnd(cb: () => void) {
  const { subscribeNearEnd } = useScrollControls();
  const latest = React.useRef(cb);
  latest.current = cb;
  React.useEffect(() => subscribeNearEnd(() => latest.current()), [subscribeNearEnd]);
}

/**
 * The top bar: the app's name and the child switcher. It lives ONCE, above the tab pager (see app/(tabs)/_layout.tsx), so it stays put
 * while the pages slide underneath — who is selected doesn't change from tab to tab, so neither should this.
 */
export function TopBar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const kids = useStore((s) => s.kids);
  const setActive = useStore((s) => s.setActive);
  const active = useActiveChild();
  const [adding, setAdding] = useState(false);
  return (
    <View style={{ backgroundColor: t.bg, paddingTop: insets.top + 8, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}>
        <Image source={require("../../assets/4d-ages-wordmark.png")} accessibilityLabel={APP_NAME} style={{ height: 42, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" contentPosition="left" />
      </View>
      <HScroll contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingTop: 10 }}>
        {kids.map((k) => {
          const on = k.id === active?.id;
          const a = smartAge(k.birth);
          return (
            // Material 3 filter chips: the selected child is a tonal container, the others are outlined
            <Pressable key={k.id} onPress={() => setActive(k.id)} accessibilityRole="button" accessibilityState={{ selected: on }} android_ripple={{ color: withAlpha(t.ink, 0.1) }} style={[st.chip, on ? { backgroundColor: t.chipOn, borderColor: t.chipOn } : { backgroundColor: "transparent", borderColor: t.outline }]}>
              <Avatar child={k} size={32} />
              <View>
                <Text style={[TYPE.labelLarge, { color: on ? t.onChipOn : t.ink }]}>{k.name}{k.shared ? " 🔗" : ""}</Text>
                <Text style={[TYPE.labelSmall, { color: on ? t.onChipOn : t.ink3 }]}>{a.value} {a.unit}</Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setAdding(true)} accessibilityLabel="Add a child" android_ripple={{ color: withAlpha(t.onAccentSoft, 0.14) }} style={[st.plus, { backgroundColor: t.accentSoft }]}>
          <Icon name="plus" size={22} color={t.onAccentSoft} />
        </Pressable>
      </HScroll>
      <AddChildSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

/**
 * The page inside each tab: its content, in a scrolling page. The child's profile card (name, age, picture, counts) is shown only
 * on Home (`hero`); the other tabs have their own titles, because the selected child is already shown in the top bar.
 */
export function Screen({ children, hero = false }: { children: React.ReactNode; hero?: boolean }) {
  const t = useTheme();
  const [adding, setAdding] = useState(false); // only for the welcome screen's button, when there is no child yet
  const active = useActiveChild();
  const switching = useChildSwitching();
  const scrollRef = React.useRef<ScrollView>(null);
  const nearEnd = React.useRef(new Set<() => void>());
  const viewH = React.useRef(0);
  const fire = () => nearEnd.current.forEach((cb) => cb());
  const controls = useMemo<Controls>(() => ({
    toTop: () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
    toBottom: () => scrollRef.current?.scrollToEnd({ animated: true }),
    subscribeNearEnd: (cb) => { nearEnd.current.add(cb); return () => { nearEnd.current.delete(cb); }; },
  }), []);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={120}
        onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }}
        onScroll={(e) => { const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent; if (contentSize.height - (contentOffset.y + layoutMeasurement.height) < layoutMeasurement.height * 2) fire(); }}
        onContentSizeChange={(_w, h) => { if (viewH.current && h - viewH.current < viewH.current * 2) fire(); }}
      >
        {active ? (
          // while the newly chosen child's pages are being prepared, the old ones dim and ignore taps (so nothing can be tapped on the wrong child)
          <View style={{ opacity: switching ? 0.45 : 1 }} pointerEvents={switching ? "none" : "auto"}>
            {hero ? <Hero /> : null}
            <ScrollControls.Provider value={controls}><View style={{ padding: 16 }}>{children}</View></ScrollControls.Provider>
          </View>
        ) : (
          <Welcome onAdd={() => setAdding(true)} />
        )}
      </ScrollView>
      <AddChildSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function Hero() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const [ageOpen, setAgeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [collection, setCollection] = useState<CollectionKind | null>(null);

  const stats = useMemo(() => {
    if (!child) return { ph: 0, ms: 0, st: 0 };
    const mine = memories.filter((m) => m.childId === child.id);
    return {
      ph: mine.filter((m) => m.type === "photo").reduce((n, m) => n + Math.max(1, m.media.length), 0), // pictures & videos (stories aren't counted)
      ms: mine.filter((m) => m.type === "milestone").length,
      st: mine.filter((m) => m.type === "story").length,
    };
  }, [child, memories]);

  if (!child) return null;
  const box = [st.stat, { backgroundColor: t.card }];

  return (
    <View style={{ backgroundColor: t.accentSoft, borderRadius: 28, padding: 16, marginHorizontal: 16, marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {/* the one edit button: the pen on the picture */}
        <Pressable onPress={() => setEditOpen(true)} accessibilityLabel="Edit profile">
          <Avatar child={child} size={84} ring />
          <View style={[st.pen, { backgroundColor: t.accent }]}><Icon name="edit-2" size={13} color={t.onAccent} /></View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.headlineLarge, { color: t.onAccentSoft }]} numberOfLines={1}>{child.name}</Text>
          <Pressable onPress={() => setAgeOpen(true)} hitSlop={6}>
            <Text style={[TYPE.labelLarge, { color: t.accentDeep, marginTop: 2 }]}>🎂 {ageLong(child.birth, todayISO())} old</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Pressable style={box} onPress={() => setCollection("photos")}><Text style={statNum(t.ink)}>{stats.ph}</Text><Text style={statLbl(t.ink3)}>photos</Text></Pressable>
        <Pressable style={box} onPress={() => setCollection("milestones")}><Text style={statNum(t.ink)}>{stats.ms}</Text><Text style={statLbl(t.ink3)}>milestones</Text></Pressable>
        <Pressable style={box} onPress={() => setCollection("stories")}><Text style={statNum(t.ink)}>{stats.st}</Text><Text style={statLbl(t.ink3)}>stories</Text></Pressable>
      </View>
      <AgeSheet visible={ageOpen} onClose={() => setAgeOpen(false)} />
      <ProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} />
      <CollectionSheet kind={collection} onClose={() => setCollection(null)} />
    </View>
  );
}

/** Tap the age → totals in years, months, weeks and days */
function AgeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const child = useActiveChild();
  if (!child) return null;
  const x = ageTotals(child.birth);
  const rows: [string, string][] = [[x.years, "years"], [x.months.toLocaleString(), "months"], [x.weeks.toLocaleString(), "weeks"], [x.days.toLocaleString(), "days"]];
  return (
    <Sheet visible={visible} onClose={onClose} title={`${child.name}'s age, every way`}>
      <Text style={{ color: t.ink3, marginBottom: 14 }}>🎂 Born {formatDate(child.birth)} — {ageLong(child.birth, todayISO())} ago.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {rows.map(([v, l]) => (
          <View key={l} style={{ width: "48%", backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
            <Text style={[TYPE.headlineMedium, { color: t.ink }]}>{v}</Text>
            <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>{l} in total</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: t.ink4, textAlign: "center", marginTop: 12, fontSize: 12 }}>Each number counts all the way from birth to today.</Text>
    </Sheet>
  );
}

function ProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const child = useActiveChild();
  const memories = useStore((s) => s.memories);
  const updateChild = useStore((s) => s.updateChild);
  const addMemories = useStore((s) => s.addMemories);
  const setShareOpen = useStore((s) => s.setShareOpen);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(todayISO());
  const [theme, setTheme] = useState<KidTheme>("pink");
  const [avatarId, setAvatarId] = useState<string | undefined>();
  const [crop, setCrop] = useState<AvatarCrop | undefined>();
  const [emoji, setEmoji] = useState("🌸");
  const [showEmoji, setShowEmoji] = useState(false);
  const [err, setErr] = useState("");

  React.useEffect(() => {
    if (visible && child) {
      setName(child.name); setBirth(child.birth); setTheme(child.theme); setAvatarId(child.avatarPhotoId); setCrop(child.avatarCrop); setEmoji(child.emoji); setShowEmoji(false); setErr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // any of their memories that has a real photo can be the profile picture
  const mine = useMemo(() => memories.filter((p) => p.childId === child?.id && p.type !== "milestone" && coverOf(p.media)?.kind === "photo"), [memories, child?.id]);
  const avatarCover = coverOf(memories.find((p) => p.id === avatarId)?.media);
  if (!child) return null;
  const pickAvatar = (id?: string) => {
    setAvatarId(id);
    setCrop(id === child.avatarPhotoId ? child.avatarCrop : undefined); // a new photo starts centred
  };

  const upload = async () => {
    const picked = await pickMedia({ videos: false, multiple: false });
    if (!picked.length) return;
    const [p] = toMemories(child, picked, "Profile");
    addMemories([p]);
    pickAvatar(p.id);
  };

  const save = () => {
    if (!name.trim()) return setErr("Please keep a name — even a nickname works.");
    if (birth > todayISO()) return setErr("Birth date can't be in the future.");
    updateChild(child.id, { name: name.trim(), birth, theme, avatarPhotoId: avatarId, avatarCrop: avatarId ? crop : undefined, emoji });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Edit ${child.name}'s profile`}>
      <Label>Name</Label>
      <Input value={name} onChangeText={setName} />
      <Label>Birth date</Label>
      <DateField value={birth} onChange={setBirth} max={todayISO()} />
      <Label>Color mode</Label>
      <ThemePicker value={theme} onChange={setTheme} order={THEME_ORDER} themes={THEMES} />
      <Label>Profile picture — choose one of their photos</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: t.bg2, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: t.line }}>
        <Pressable onPress={upload} style={[st.tile, { borderStyle: "dashed", borderColor: t.line, backgroundColor: t.card, borderWidth: 2, alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 18 }}>⬆️</Text><Text style={{ color: t.ink3, fontSize: 10, fontWeight: "700" }}>Upload</Text>
        </Pressable>
        {mine.map((p) => (
          <Pressable key={p.id} onPress={() => pickAvatar(avatarId === p.id ? undefined : p.id)} style={[st.tile, { borderWidth: avatarId === p.id ? 3 : 0, borderColor: t.accent, overflow: "hidden" }]}>
            <PhotoView photo={p} style={{ width: "100%", height: "100%" }} emojiSize={26} />
          </Pressable>
        ))}
      </View>
      {avatarId && avatarCover?.kind === "photo" ? (
        <View style={{ marginTop: 16 }}>
          <Label>Position the picture</Label>
          <AvatarCropper uri={avatarCover.uri} value={crop} onChange={setCrop} />
        </View>
      ) : null}
      {!avatarId ? (
        <>
          <Pressable onPress={() => setShowEmoji((v) => !v)}><Text style={{ color: t.ink3, fontWeight: "700", marginTop: 10, textDecorationLine: "underline" }}>{showEmoji ? "Hide emojis" : `Change emoji (${emoji})`}</Text></Pressable>
          {showEmoji ? <View style={{ marginTop: 8 }}><EmojiPicker value={emoji} onChange={setEmoji} /></View> : null}
        </>
      ) : (
        <Pressable onPress={() => pickAvatar(undefined)}><Text style={{ color: t.ink3, fontWeight: "700", marginTop: 10, textDecorationLine: "underline" }}>Use an emoji instead</Text></Pressable>
      )}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 12 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        <Btn label="Cancel" kind="soft" onPress={onClose} style={{ flex: 1 }} />
        <Btn label="Save profile" onPress={save} style={{ flex: 1 }} />
      </View>
      <Btn label={child.shared ? "🔗 Sharing settings" : "👨‍👩‍👧 Share with the other parent"} kind="line" onPress={() => { onClose(); setShareOpen(true); }} style={{ marginTop: 14 }} />
    </Sheet>
  );
}

function AddChildSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const addChild = useStore((s) => s.addChild);
  const updateChild = useStore((s) => s.updateChild);
  const addMemories = useStore((s) => s.addMemories);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(todayISO());
  const [theme, setTheme] = useState<KidTheme>("green");
  const [emoji, setEmoji] = useState("🐣");
  const [showEmoji, setShowEmoji] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [crop, setCrop] = useState<AvatarCrop | undefined>();
  const [err, setErr] = useState("");

  const reset = () => { setName(""); setBirth(todayISO()); setTheme("green"); setEmoji("🐣"); setShowEmoji(false); setPhotoUri(null); setCrop(undefined); setErr(""); };

  const choose = async () => {
    const picked = await pickMedia({ videos: false, multiple: false });
    if (picked.length) {
      setPhotoUri(picked[0].uri);
      setCrop(undefined);
    }
  };

  const create = () => {
    if (!name.trim()) return setErr("Please add a name — even a nickname works.");
    if (birth > todayISO()) return setErr("Birth date can't be in the future.");
    const child = { id: uid("kid"), name: name.trim(), birth, theme, emoji };
    addChild(child);
    if (photoUri) {
      const [p] = toMemories(child, [{ uri: photoUri, kind: "photo", date: birth }], "Profile");
      addMemories([p]);
      updateChild(child.id, { avatarPhotoId: p.id, avatarCrop: crop });
    }
    reset();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add your little one">
      <Label>Name</Label>
      <Input value={name} onChangeText={setName} placeholder="e.g. Noa" />
      <Label>Birth date</Label>
      <DateField value={birth} onChange={setBirth} max={todayISO()} />
      <Label>Color mode for their pages</Label>
      <ThemePicker value={theme} onChange={setTheme} order={THEME_ORDER} themes={THEMES} />
      <Label>Profile photo (optional)</Label>
      <Btn label={photoUri ? "✓ Photo chosen — tap to change" : "⬆️ Choose a photo"} kind="line" onPress={choose} />
      {photoUri ? <View style={{ marginTop: 14 }}><AvatarCropper uri={photoUri} value={crop} onChange={setCrop} /></View> : null}
      {!photoUri ? (
        <>
          <Pressable onPress={() => setShowEmoji((v) => !v)}><Text style={{ color: t.ink3, fontWeight: "700", marginTop: 10, textDecorationLine: "underline" }}>{showEmoji ? "Hide emojis" : `Or pick an emoji (${emoji})`}</Text></Pressable>
          {showEmoji ? <View style={{ marginTop: 8 }}><EmojiPicker value={emoji} onChange={setEmoji} /></View> : null}
        </>
      ) : null}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 12 }}>{err}</Text> : null}
      <Btn label={`Start ${name.trim() ? name.trim() + "'s" : "their"} chapter`} onPress={create} style={{ marginTop: 20 }} />
    </Sheet>
  );
}

function Welcome({ onAdd }: { onAdd: () => void }) {
  const t = useTheme();
  const loadSample = useStore((s) => s.loadSample);
  const setShareOpen = useStore((s) => s.setShareOpen);
  return (
    <View style={{ padding: 28, alignItems: "center" }}>
      <Image source={require("../../assets/4d-ages-wordmark.png")} accessibilityLabel={APP_NAME} style={{ width: 300, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" />
      <Text style={[TYPE.headlineSmall, { color: t.ink, textAlign: "center", marginTop: 6 }]}>{TAGLINE}</Text>
      <Text style={{ color: t.ink3, textAlign: "center", fontSize: 15, lineHeight: 22, marginTop: 8 }}>
        Add your little one, pick the photos you love, and watch their story build itself — with milestones, family and a keepsake book you can export.
      </Text>
      <Btn label="Add your little one" onPress={onAdd} style={{ marginTop: 24, alignSelf: "stretch" }} />
      <Btn label="👨‍👩‍👧 Join my partner's baby book" kind="soft" onPress={() => setShareOpen(true)} style={{ marginTop: 10, alignSelf: "stretch" }} />
      <Btn label="Explore with a sample family" kind="line" onPress={loadSample} style={{ marginTop: 10, alignSelf: "stretch" }} />
      <Text style={{ color: t.ink4, fontSize: 12, textAlign: "center", marginTop: 16 }}>Your photos stay on this phone. You choose every one — nothing is scanned.</Text>
    </View>
  );
}

const statNum = (c: string) => ({ ...TYPE.titleLarge, color: c });
const statLbl = (c: string) => ({ fontSize: 10.5, fontWeight: "700" as const, color: c });

const st = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  plus: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pen: { position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stat: { flex: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12 },
  tile: { width: 64, height: 64, borderRadius: 14 },
});
