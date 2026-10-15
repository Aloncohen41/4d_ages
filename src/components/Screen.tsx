import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useActiveChild, useChildSwitching, useShownChild, useStore, uid } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { WORDMARKS } from "../lib/wordmark";
import { THEMES, THEME_ORDER, TYPE } from "../theme";
import { withAlpha } from "../lib/m3";
import { AvatarCrop, Child, Gender, KidTheme, isPet } from "../lib/types";
import { addMonths, ageLong, ageTotals, formatDate, pregnancy, smartAge, todayISO } from "../lib/date";
import { weekLabel } from "../lib/pregnancy";

import { PREGNANCY_NAME } from "../lib/pregnancy";
export { PREGNANCY_NAME };
import { pickMedia, toMemories } from "../lib/media";
import { coverOf } from "../lib/display";
import { Avatar, Btn, DateField, Input, Label, PhotoView, Seg, Sheet, ThemePicker, dialogName } from "./ui";
import { EmojiPicker } from "./EmojiPicker";
import { AvatarCropper } from "./AvatarCropper";
import { HScroll } from "./HScroll";
import { APP_NAME, WORDMARK_ASPECT } from "../brand";
import { Icon, IconName } from "./Icon";
import { CollectionSheet, CollectionKind } from "./CollectionSheet";
import { ArrivalSheet } from "./Pregnancy";
import { AddPetForm } from "./PetForm";
import { DogSize, petAge, speciesInfo } from "../lib/pets";
import { deleteChild, deleteChildPlan } from "../lib/sync";
import { friendlyShareError } from "../lib/shareFlow";

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
  const [menu, setMenu] = useState(false);
  return (
    <View style={{ backgroundColor: t.bg, paddingTop: insets.top + 8, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 }}>
        <Pressable onPress={() => setMenu(true)} accessibilityLabel="Menu" accessibilityRole="button" hitSlop={4} android_ripple={{ color: withAlpha(t.ink, 0.12), borderless: true, radius: 22 }} style={st.menuBtn}>
          <Icon name="menu" size={26} color={t.ink2} />
        </Pressable>
        <Image source={WORDMARKS[t.key]} accessibilityLabel={APP_NAME} style={{ height: 42, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" contentPosition="left" />
      </View>
      <HScroll contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingTop: 10 }}>
        {kids.map((k) => {
          const on = k.id === active?.id;
          const a = smartAge(k.birth);
          return (
            // Material 3 filter chips: the selected child is a tonal container, the others are outlined
            <Pressable key={k.id} onPress={() => setActive(k.id)} accessibilityRole="button" aria-pressed={on} android_ripple={{ color: withAlpha(t.ink, 0.1) }} style={[st.chip, on ? { backgroundColor: t.chipOn, borderColor: t.chipOn } : { backgroundColor: "transparent", borderColor: t.outline }]}>
              <Avatar child={k} size={32} />
              <View>
                <Text style={[TYPE.labelLarge, { color: on ? t.onChipOn : t.ink }]}>{k.name}</Text>
                <Text style={[TYPE.labelSmall, { color: on ? t.onChipOn : t.ink3 }]}>{k.expecting ? weekLabel(k.birth, todayISO()) : `${a.value} ${a.unit}`}</Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setAdding(true)} accessibilityLabel="Add a child" android_ripple={{ color: withAlpha(t.onAccentSoft, 0.14) }} style={[st.plus, { backgroundColor: t.accentSoft }]}>
          <Icon name="plus" size={22} color={t.onAccentSoft} />
        </Pressable>
      </HScroll>
      <AddChildSheet visible={adding} onClose={() => setAdding(false)} />
      <AppMenu visible={menu} onClose={() => setMenu(false)} />
    </View>
  );
}

/** The menu behind the top-left button: the pages that aren't tabs. */
function AppMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  type MenuPath = "/family" | "/classics" | "/health" | "/settings";
  const go = (path: MenuPath) => { onClose(); router.push(path); };
  const item = (icon: IconName, label: string, path: MenuPath) => (
    <Pressable key={path} onPress={() => go(path)} accessibilityRole="menuitem" android_ripple={{ color: withAlpha(t.ink, 0.1) }} style={st.menuItem}>
      <Icon name={icon} size={22} color={t.ink2} />
      <Text style={[TYPE.labelLarge, { color: t.ink, fontSize: 15 }]}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent {...dialogName("Menu")}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
      <View style={[st.menuCard, { top: insets.top + 54, backgroundColor: t.surfaceHigh, shadowColor: "#000" }]}>
        {item("family", "Family", "/family")}
        {item("classics", "Classics", "/classics")}
        {item("health", "Health", "/health")}
        {item("settings", "Settings", "/settings")}
      </View>
    </Modal>
  );
}

/**
 * The page inside each tab: its content, in a scrolling page. The child's profile card (name, age, picture, counts) is shown only
 * on Home (`hero`); the other tabs have their own titles, because the selected child is already shown in the top bar.
 */
export function Screen({ children, hero = false }: { children: React.ReactNode; hero?: boolean }) {
  const t = useTheme();
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
        ) : null}
      </ScrollView>
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
  const [arrival, setArrival] = useState(false);

  const stats = useMemo(() => {
    if (!child) return { ph: 0, ms: 0, st: 0 };
    const mine = memories.filter((m) => m.childId === child.id);
    return {
      ph: mine.filter((m) => m.type === "photo").reduce((n, m) => n + Math.max(1, m.media.length), 0), // pictures & videos (stories aren't counted)
      ms: isPet(child) ? mine.filter((m) => m.type === "first").length : mine.filter((m) => m.type === "milestone").length, // a pet: tricks and firsts
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
          {isPet(child) ? (
            <PetAgeLine child={child} />
          ) : child.expecting ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}><Icon name="birthday" size={15} color={t.accentDeep} /><Text style={[TYPE.labelLarge, { color: t.accentDeep, flexShrink: 1 }]}>{weekLabel(child.birth, todayISO())} · {pregnancy(child.birth).weeksToGo} week{pregnancy(child.birth).weeksToGo === 1 ? "" : "s"} to go</Text></View>
          ) : (
            <Pressable onPress={() => setAgeOpen(true)} hitSlop={6}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}><Icon name="birthday" size={15} color={t.accentDeep} /><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{ageLong(child.birth, todayISO())} old</Text></View>
            </Pressable>
          )}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Pressable style={box} onPress={() => setCollection("photos")}><Text style={statNum(t.ink)}>{stats.ph}</Text><Text style={statLbl(t.ink3)}>photos</Text></Pressable>
        <Pressable style={box} onPress={() => setCollection("milestones")}><Text style={statNum(t.ink)}>{stats.ms}</Text><Text style={statLbl(t.ink3)}>{isPet(child) ? "tricks & firsts" : "milestones"}</Text></Pressable>
        <Pressable style={box} onPress={() => setCollection("stories")}><Text style={statNum(t.ink)}>{stats.st}</Text><Text style={statLbl(t.ink3)}>stories</Text></Pressable>
      </View>
      <AgeSheet visible={ageOpen} onClose={() => setAgeOpen(false)} />
      <ProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} onArrived={() => { setEditOpen(false); setTimeout(() => setArrival(true), 300); }} />
      {arrival ? <ArrivalSheet child={child} onClose={() => setArrival(false)} /> : null}
      <CollectionSheet kind={collection} onClose={() => setCollection(null)} />
    </View>
  );
}

/** "2 years, 3 months" and a little box: "about 24 in dog years" (or their stage of life, for pets without a conversion). */
function PetAgeLine({ child }: { child: Child }) {
  const t = useTheme();
  const a = petAge(child, todayISO());
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
      <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{speciesInfo(child.species).emoji} {a.human}</Text>
      <View style={{ backgroundColor: t.card, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
        <Text style={[TYPE.labelMedium, { color: t.ink2 }]}>{a.own ?? a.stage}</Text>
      </View>
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
      <Text style={{ color: t.ink3, marginBottom: 14 }}>Born {formatDate(child.birth)}, {ageLong(child.birth, todayISO())} ago.</Text>
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

function ProfileSheet({ visible, onClose, onArrived }: { visible: boolean; onClose: () => void; onArrived: () => void }) {
  const t = useTheme();
  const child = useActiveChild();
  const memories = useStore((s) => s.memories);
  const updateChild = useStore((s) => s.updateChild);
  const addMemories = useStore((s) => s.addMemories);
  const [deleting, setDeleting] = useState(false);
  const [petPatch, setPetPatch] = useState<Partial<Pick<Child, "breed" | "dogSize" | "birthApprox" | "gotchaDay">>>({});
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(todayISO());
  const [theme, setTheme] = useState<KidTheme>("pink");
  const [avatarId, setAvatarId] = useState<string | undefined>();
  const [crop, setCrop] = useState<AvatarCrop | undefined>();
  const [emoji, setEmoji] = useState("🌸");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [showEmoji, setShowEmoji] = useState(false);
  const [err, setErr] = useState("");

  React.useEffect(() => {
    if (visible && child) {
      setName(child.name); setBirth(child.birth); setTheme(child.theme); setAvatarId(child.avatarPhotoId); setCrop(child.avatarCrop); setEmoji(child.emoji); setGender(child.gender ?? "unspecified"); setShowEmoji(false); setErr(""); setPetPatch({});
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

  const askDelete = async () => {
    const name = child.name;
    setDeleting(true);
    let plan: Awaited<ReturnType<typeof deleteChildPlan>>;
    try {
      plan = await deleteChildPlan(child.id);
    } catch (e) {
      setDeleting(false);
      return Alert.alert("Couldn't check who shares this book", friendlyShareError(e));
    }
    setDeleting(false);
    const run = async () => {
      setDeleting(true);
      try {
        await deleteChild(child.id);
        onClose();
      } catch (e) {
        Alert.alert(`Couldn't delete ${name}'s profile`, friendlyShareError(e));
      } finally {
        setDeleting(false);
      }
    };
    if (plan.outcome === "deleted") {
      Alert.alert(`Delete ${name}'s profile?`, `This deletes ${name}'s book and everything in it (photos, milestones and stories) from this phone and your account. Anyone you invited loses access. This can't be undone.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => Alert.alert(`Delete ${name} for good?`, "There's no way to bring it back.", [{ text: "Keep it", style: "cancel" }, { text: "Delete for good", style: "destructive", onPress: run }]) },
      ]);
    } else {
      const keeper = plan.other ?? "the family who shared it with you";
      Alert.alert(`Remove ${name}'s profile?`, plan.outcome === "handed"
        ? `${name}'s book stays with ${keeper}, who becomes its owner. It's taken off this phone and your account, and they can invite you back.`
        : `${name}'s book stays with ${keeper}. It's taken off this phone and your account, and they can invite you back.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: run },
      ]);
    }
  };

  // a date still to come is a due date; "The baby is here!" (or the "Welcome to the world" milestone) sets the real birth date
  const expecting = birth > todayISO() || (!!child.expecting && birth >= todayISO());
  const save = () => {
    if (!name.trim()) return setErr("Please keep a name — even a nickname works.");
    if (!expecting && birth > todayISO()) return setErr("Birth date can't be in the future.");
    if (expecting && birth > addMonths(todayISO(), 10)) return setErr("That due date is too far away.");
    updateChild(child.id, { name: name.trim(), birth, theme, avatarPhotoId: avatarId, avatarCrop: avatarId ? crop : undefined, emoji, gender, expecting: expecting && !isPet(child) ? true : undefined,
      ...(isPet(child) ? { ...petPatch, ...(petPatch.breed !== undefined ? { breed: petPatch.breed.trim() || undefined } : {}), ...(petPatch.birthApprox === false ? { birthApprox: undefined } : {}) } : {}) });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Edit ${child.name}'s profile`}>
      {child.expecting && child.role !== "viewer" ? (
        <View style={{ backgroundColor: t.accentSoft, borderRadius: 16, padding: 14, marginBottom: 6 }}>
          <Text style={[TYPE.titleSmall, { color: t.onAccentSoft }]}>Has {child.name === PREGNANCY_NAME ? "the baby" : child.name} arrived?</Text>
          <Text style={[TYPE.bodySmall, { color: t.onAccentSoft, marginTop: 2 }]}>Set the birth date and the name, and this becomes their own profile. The pregnancy posts stay, before the birth.</Text>
          <Btn label="The baby is here!" icon="birthday" onPress={onArrived} style={{ marginTop: 10 }} />
        </View>
      ) : null}
      {child.role !== "viewer" ? (
        // the share screen opens once this sheet has closed, so it is never left behind it
        <Pressable onPress={() => { onClose(); setTimeout(() => router.push({ pathname: "/share", params: { child: child.id } }), 300); }} accessibilityRole="button"
          android_ripple={{ color: withAlpha(t.ink, 0.08) }}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: t.accentSoft, marginBottom: 6, overflow: "hidden" }}>
          <Icon name="user-plus" size={22} color={t.onAccentSoft} />
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.titleSmall, { color: t.onAccentSoft }]}>Share {child.name}'s book</Text>
            <Text style={[TYPE.bodySmall, { color: t.onAccentSoft }]}>Invite the other parent or family, and see who has access</Text>
          </View>
          <Icon name="chevron-right" size={22} color={t.onAccentSoft} />
        </Pressable>
      ) : null}
      {!child.expecting && !isPet(child) && child.role !== "viewer" ? (
        // telling the story afterwards: the pregnancy (looking back) and the birth
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6, marginBottom: 2 }}>
          <Pressable onPress={() => { onClose(); setTimeout(() => router.push({ pathname: "/pregnancy", params: { child: child.id } }), 300); }} accessibilityRole="button"
            style={{ flex: 1, backgroundColor: t.bg2, borderRadius: 16, padding: 12, gap: 4 }}>
            <Text style={{ fontSize: 22 }}>🤰</Text>
            <Text style={[TYPE.titleSmall, { color: t.ink }]}>Tell us how your pregnancy was</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Scans, the bump, cravings and firsts</Text>
          </Pressable>
          <Pressable onPress={() => { onClose(); setTimeout(() => useStore.getState().setBirthStoryFor(child.id), 300); }} accessibilityRole="button"
            style={{ flex: 1, backgroundColor: t.bg2, borderRadius: 16, padding: 12, gap: 4 }}>
            <Text style={{ fontSize: 22 }}>📖</Text>
            <Text style={[TYPE.titleSmall, { color: t.ink }]}>Tell us the birth story</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>The day {child.name} arrived</Text>
          </Pressable>
        </View>
      ) : null}
      <Label>Name</Label>
      <Input value={name} onChangeText={setName} placeholder={expecting ? "You can change it any time" : undefined} />
      {isPet(child) ? (
        <>
          <Label>Birthday</Label>
          <DateField value={birth} onChange={setBirth} max={todayISO()} />
          <Pressable onPress={() => setPetPatch((p) => ({ ...p, birthApprox: !(p.birthApprox ?? child.birthApprox) }))} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <Icon name={(petPatch.birthApprox ?? child.birthApprox) ? "check-square" : "square"} size={22} color={t.accent} />
            <Text style={[TYPE.bodyMedium, { color: t.ink2, flex: 1 }]}>We're not sure of the exact day</Text>
          </Pressable>
          <Label>The day they came home</Label>
          <DateField value={petPatch.gotchaDay ?? child.gotchaDay ?? birth} onChange={(d) => setPetPatch((p) => ({ ...p, gotchaDay: d }))} min={birth} max={todayISO()} />
          <Label>Breed</Label>
          <Input value={petPatch.breed ?? child.breed ?? ""} onChangeText={(v) => setPetPatch((p) => ({ ...p, breed: v }))} placeholder="Optional" />
          {child.species === "dog" ? (
            <>
              <Label>Size (for the age in dog years)</Label>
              <Seg options={[{ id: "small" as DogSize, label: "Small" }, { id: "medium" as DogSize, label: "Medium" }, { id: "large" as DogSize, label: "Large" }]} value={petPatch.dogSize ?? child.dogSize ?? "medium"} onChange={(v) => setPetPatch((p) => ({ ...p, dogSize: v }))} />
            </>
          ) : null}
          <Label>Boy or girl</Label>
          <Seg options={[{ id: "boy" as Gender, label: "Boy" }, { id: "girl" as Gender, label: "Girl" }, { id: "unspecified" as Gender, label: "Not sure" }]} value={gender} onChange={setGender} />
        </>
      ) : (
        <>
          <Label>{expecting ? "Due date" : "Birth date"}</Label>
          <DateField value={birth} onChange={setBirth} max={addMonths(todayISO(), 10)} />
          <Label>Gender</Label>
          <GenderPicker value={gender} onChange={setGender} expecting={expecting} />
        </>
      )}
      <Label>Color mode</Label>
      <ThemePicker value={theme} onChange={setTheme} order={THEME_ORDER} themes={THEMES} />
      <Label>Profile picture — choose one of their photos</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: t.bg2, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: t.line }}>
        <Pressable onPress={upload} style={[st.tile, { borderStyle: "dashed", borderColor: t.line, backgroundColor: t.card, borderWidth: 2, alignItems: "center", justifyContent: "center" }]}>
          <Icon name="image" size={20} color={t.ink3} /><Text style={{ color: t.ink3, fontSize: 10, fontWeight: "700" }}>Upload</Text>
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
        <Pressable onPress={() => pickAvatar(undefined)}><Text style={{ color: t.ink3, fontWeight: "700", marginTop: 10, textDecorationLine: "underline" }}>Remove photo</Text></Pressable>
      )}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 12 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        <Btn label="Cancel" kind="soft" onPress={onClose} style={{ flex: 1 }} />
        <Btn label="Save profile" onPress={save} style={{ flex: 1 }} />
      </View>
      <Pressable onPress={askDelete} disabled={deleting} accessibilityRole="button" hitSlop={6}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 22, paddingVertical: 10 }}>
        {deleting ? <ActivityIndicator size="small" color={t.danger} /> : <Icon name="trash-2" size={18} color={t.danger} />}
        <Text style={{ color: t.danger, fontWeight: "700" }}>{child.role === "viewer" ? `Remove ${child.name}'s book` : `Delete ${child.name}'s profile`}</Text>
      </Pressable>
    </Sheet>
  );
}

/** Girl, Boy or Prefer not to say (before the birth: Not known yet): sets the growth comparison's default. */
export function GenderPicker({ value, onChange, expecting = false }: { value: Gender; onChange: (g: Gender) => void; expecting?: boolean }) {
  return <Seg options={[{ id: "girl" as Gender, label: "Girl" }, { id: "boy" as Gender, label: "Boy" }, { id: "unspecified" as Gender, label: expecting ? "Not known yet" : "Prefer not to say" }]} value={value} onChange={onChange} />;
}

export function AddChildSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const addChild = useStore((s) => s.addChild);
  const updateChild = useStore((s) => s.updateChild);
  const addMemories = useStore((s) => s.addMemories);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState(todayISO());
  const [theme, setTheme] = useState<KidTheme>("green");
  const [emoji, setEmoji] = useState("🐣");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [showEmoji, setShowEmoji] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [crop, setCrop] = useState<AvatarCrop | undefined>();
  const [err, setErr] = useState("");
  // first: who's being added (my kid, my bump, my pet)
  const [what, setWhat] = useState<"kid" | "bump" | "pet" | null>(null);
  // a date still to come is a due date: the profile is a pregnancy (the name can wait)
  const expecting = birth > todayISO();

  const reset = () => { setWhat(null); setName(""); setBirth(todayISO()); setTheme("green"); setEmoji("🐣"); setGender("unspecified"); setShowEmoji(false); setPhotoUri(null); setCrop(undefined); setErr(""); };
  const close = () => { reset(); onClose(); };
  const pick = (w: "kid" | "bump" | "pet") => { setWhat(w); setBirth(w === "bump" ? addMonths(todayISO(), 6) : todayISO()); };

  const choose = async () => {
    const picked = await pickMedia({ videos: false, multiple: false });
    if (picked.length) {
      setPhotoUri(picked[0].uri);
      setCrop(undefined);
    }
  };

  const create = () => {
    if (!name.trim() && !expecting) return setErr("Please add a name — even a nickname works.");
    if (birth > addMonths(todayISO(), 10)) return setErr("That date is too far away. A due date can be up to ten months from now.");
    // a pregnancy's gender is set at the gender reveal (a milestone), so it starts as not known
    const child = { id: uid("kid"), name: name.trim() || PREGNANCY_NAME, birth, theme, emoji: expecting ? "🤰" : emoji, gender: expecting ? ("unspecified" as Gender) : gender, ...(expecting ? { expecting: true } : {}) };
    addChild(child);
    if (photoUri) {
      const [p] = toMemories(child, [{ uri: photoUri, kind: "photo", date: birth }], "Profile");
      addMemories([p]);
      updateChild(child.id, { avatarPhotoId: p.id, avatarCrop: crop });
    }
    close();
  };

  return (
    <Sheet visible={visible} onClose={close} title={what === "pet" ? "My pet" : what === "bump" ? "My bump" : what === "kid" ? "My kid" : "Add to the family"}>
      {!what ? (
        <View style={{ gap: 10 }}>
          {([
            { id: "bump" as const, emoji: "🤰", title: "My bump", desc: "A baby on the way, with the due date" },
            { id: "kid" as const, emoji: "👶", title: "My kid", desc: "A baby or a child, already here" },
            { id: "pet" as const, emoji: "🐾", title: "My pet", desc: "A dog, cat, bird, hamster, snake or horse" },
          ]).map((o) => (
            <Pressable key={o.id} onPress={() => pick(o.id)} accessibilityRole="button" android_ripple={{ color: withAlpha(t.ink, 0.08) }}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, overflow: "hidden" }}>
              <Text style={{ fontSize: 34 }}>{o.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.titleMedium, { color: t.ink }]}>{o.title}</Text>
                <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{o.desc}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={t.ink2} />
            </Pressable>
          ))}
        </View>
      ) : what === "pet" ? (
        <AddPetForm onDone={close} />
      ) : (<>
      <Label>{what === "bump" ? "Due date" : "Birth date"}</Label>
      <DateField value={birth} onChange={setBirth} min={what === "bump" ? todayISO() : undefined} max={what === "bump" ? addMonths(todayISO(), 10) : todayISO()} />
      {expecting ? (
        <View style={{ backgroundColor: t.accentSoft, borderRadius: 14, padding: 12, marginTop: 8 }}>
          <Text style={[TYPE.titleSmall, { color: t.onAccentSoft }]}>A pregnancy profile: due {formatDate(birth)}, week {pregnancy(birth).week}</Text>
          <Text style={[TYPE.bodySmall, { color: t.onAccentSoft, marginTop: 2 }]}>Keep the scans, a weekly bump photo, the first kick and the cravings. Growth shows the baby's size each week. Girl or boy is set at the gender reveal (in Milestones), and “Welcome to the world” starts their own profile when they arrive.</Text>
        </View>
      ) : null}
      <Label>{expecting ? "Name (optional)" : "Name"}</Label>
      <Input value={name} onChangeText={setName} placeholder={expecting ? `Not decided yet? It will say “${PREGNANCY_NAME}” until you choose` : "Their name or nickname"} />
      {!expecting ? (
        <>
          <Label>Gender</Label>
          <GenderPicker value={gender} onChange={setGender} />
        </>
      ) : null}
      <Label>Color mode for their pages</Label>
      <ThemePicker value={theme} onChange={setTheme} order={THEME_ORDER} themes={THEMES} />
      <Label>Profile photo (optional)</Label>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {photoUri ? <Btn label="Remove" kind="soft" onPress={() => { setPhotoUri(null); setCrop(undefined); }} style={{ flex: 0.6 }} /> : null}
        <Btn label={photoUri ? "Change photo" : "Choose a photo"} icon="image" kind="line" onPress={choose} style={{ flex: 1 }} />
      </View>
      {photoUri ? <View style={{ marginTop: 14 }}><AvatarCropper uri={photoUri} value={crop} onChange={setCrop} /></View> : null}
      {!photoUri ? (
        <>
          <Pressable onPress={() => setShowEmoji((v) => !v)}><Text style={{ color: t.ink3, fontWeight: "700", marginTop: 10, textDecorationLine: "underline" }}>{showEmoji ? "Hide emojis" : `Or pick an emoji (${emoji})`}</Text></Pressable>
          {showEmoji ? <View style={{ marginTop: 8 }}><EmojiPicker value={emoji} onChange={setEmoji} /></View> : null}
        </>
      ) : null}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 12 }}>{err}</Text> : null}
      <Btn label={`Start ${name.trim() ? name.trim() + "'s" : "their"} chapter`} onPress={create} style={{ marginTop: 20 }} />
      </>)}
    </Sheet>
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
  menuBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  menuCard: { position: "absolute", left: 12, minWidth: 200, borderRadius: 16, paddingVertical: 8, elevation: 8, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
});
