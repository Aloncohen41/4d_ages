import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTheme } from "../lib/useTheme";
import { useStore } from "../lib/store";
import { TYPE } from "../theme";
import { withAlpha } from "../lib/m3";
import { Child, MediaItem, MediaKind, PALETTES, Relative } from "../lib/types";
import { coverOf } from "../lib/display";
import { Icon, IconName } from "./Icon";
import { AvatarCrop } from "../lib/types";
import { cropLayout } from "../lib/crop";
import { formatDate, formatTime, parseISO, toHHMM, toISO } from "../lib/date";

/* ---------- buttons & text ---------- */
export function Btn({ label, onPress, kind = "solid", style, disabled }: {
  label: string; onPress: () => void; kind?: "solid" | "soft" | "line" | "danger"; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const t = useTheme();
  // Material 3 buttons: solid = filled, soft = filled tonal, line = outlined, danger = tonal error
  const look = {
    solid: { bg: t.accent, fg: t.onAccent },
    soft: { bg: t.chipOn, fg: t.onChipOn },
    line: { bg: "transparent", fg: t.accent },
    danger: { bg: t.dangerSoft, fg: t.danger },
  }[kind];
  // disabled: the container at 12% and the label at 38% of the text colour, as Material specifies
  const bg = disabled ? (kind === "line" ? "transparent" : withAlpha(t.ink, 0.12)) : look.bg;
  const fg = disabled ? withAlpha(t.ink, 0.38) : look.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: withAlpha(fg, 0.14) }}
      style={[s.btn, { backgroundColor: bg, borderColor: disabled ? withAlpha(t.ink, 0.12) : t.outline, borderWidth: kind === "line" ? 1 : 0 }, style]}
    >
      <Text style={[TYPE.labelLarge, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A round icon button: tonal when active (Material 3 "filled tonal icon button"). */
export function IconButton({ name, onPress, size = 20, label, active }: { name: IconName; onPress: () => void; size?: number; label: string; active?: boolean }) {
  const t = useTheme();
  const fg = active ? t.onChipOn : t.ink2;
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} android_ripple={{ color: withAlpha(fg, 0.14) }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: active ? t.chipOn : t.bg2 }}>
      <Icon name={name} size={size} color={fg} />
    </Pressable>
  );
}

export function DeleteButton({ onPress, label = "Delete" }: { onPress: () => void; label?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} android_ripple={{ color: withAlpha(t.danger, 0.14) }} style={{ width: 52, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: t.dangerSoft }}>
      <Icon name="trash-2" size={22} color={t.danger} />
    </Pressable>
  );
}

export function Heading({ title, desc }: { title: string; desc?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[TYPE.headlineSmall, { color: t.ink }]}>{title}</Text>
      {desc ? <Text style={[TYPE.bodyMedium, { color: t.ink3, marginTop: 4 }]}>{desc}</Text> : null}
    </View>
  );
}

export function Label({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 6, marginTop: 16 }]}>{children}</Text>;
}

/** An outlined text field (Material 3): a thin outline that thickens and takes the primary colour when focused. */
export function Input(props: React.ComponentProps<typeof TextInput>) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={t.ink4}
      selectionColor={t.accent}
      cursorColor={t.accent}
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={[s.input, { backgroundColor: "transparent", borderColor: focused ? t.accent : t.outline, color: t.ink }, props.multiline && { minHeight: 96, textAlignVertical: "top" }, props.style]}
    />
  );
}

/** A segmented button (Material 3): one outlined group, the chosen segment filled with the secondary container. */
export function Seg<T extends string | number>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[s.seg, { borderColor: t.outline }]}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <Pressable
            key={String(o.id)}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            android_ripple={{ color: withAlpha(t.ink, 0.1) }}
            style={[s.segItem, i > 0 && { borderLeftWidth: 1, borderLeftColor: t.outline }, on && { backgroundColor: t.chipOn }]}
          >
            <Text numberOfLines={1} style={[TYPE.labelLarge, { fontSize: 13, color: on ? t.onChipOn : t.ink2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A modal bottom sheet (Material 3): 28 dp top corners, a drag handle, a tonal surface, and the standard 32% scrim. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.scrim, { backgroundColor: t.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior="padding" style={{ maxHeight: "92%" }}>
          <View style={[s.sheet, { backgroundColor: t.card }]}>
            <View style={{ alignSelf: "center", width: 32, height: 4, borderRadius: 2, marginTop: 12, marginBottom: 6, backgroundColor: withAlpha(t.ink2, 0.4) }} />
            <View style={s.sheetHead}>
              <Text style={[TYPE.titleLarge, { color: t.ink, flex: 1 }]} numberOfLines={1}>{title}</Text>
              <Pressable onPress={onClose} accessibilityLabel="Close" android_ripple={{ color: withAlpha(t.ink, 0.12) }} style={[s.x, { backgroundColor: t.bg2 }]} hitSlop={6}>
                <Icon name="x" size={20} color={t.ink2} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 48 }}>
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function DateField({ value, onChange, min, max }: { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const t = useTheme();
  const open = () => {
    DateTimePickerAndroid.open({
      value: parseISO(value),
      mode: "date",
      minimumDate: min ? parseISO(min) : undefined,
      maximumDate: max ? parseISO(max) : undefined,
      onChange: (e, d) => {
        if (e.type === "set" && d) onChange(toISO(d));
      },
    });
  };
  return (
    <Pressable onPress={open} style={[s.input, { backgroundColor: "transparent", borderColor: t.outline, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
      <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{formatDate(value)}</Text>
      <Icon name="calendar" size={22} color={t.ink2} />
    </Pressable>
  );
}

/**
 * Optional time of day. Nothing is shown until you ask for it: a small "Add time" button opens the time picker and,
 * once a time is chosen, the time area appears. ✕ removes the time and tucks the area away again.
 */
export function TimeField({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const t = useTheme();
  const [shown, setShown] = useState(!!value);
  React.useEffect(() => {
    if (value) setShown(true); // e.g. a time read from a shared photo
  }, [value]);

  const pick = () => {
    const base = new Date();
    if (value) {
      const [h, m] = value.split(":").map(Number);
      base.setHours(h, m, 0, 0);
    }
    DateTimePickerAndroid.open({
      value: base,
      mode: "time",
      onChange: (e, d) => {
        if (e.type === "set" && d) {
          onChange(toHHMM(d));
          setShown(true);
        } else if (!value) setShown(false); // cancelled without choosing a time: back to just the button
      },
    });
  };

  if (!shown && !value) {
    return (
      <Pressable onPress={() => { setShown(true); pick(); }} accessibilityLabel="Add a time" style={{ alignSelf: "flex-start", marginTop: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: t.accentSoft }}>
        <Icon name="clock" size={16} color={t.onAccentSoft} />
        <Text style={[TYPE.labelLarge, { color: t.onAccentSoft }]}>Add time</Text>
      </Pressable>
    );
  }
  return (
    <View>
      <Label>Time</Label>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Pressable onPress={pick} style={[s.input, { flex: 1, backgroundColor: "transparent", borderColor: t.outline, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
          <Text style={[TYPE.bodyLarge, { color: value ? t.ink : t.ink4 }]}>{value ? formatTime(value) : "Choose a time"}</Text>
          <Icon name="clock" size={22} color={t.ink2} />
        </Pressable>
        <Pressable onPress={() => { onChange(undefined); setShown(false); }} hitSlop={8} style={[s.x, { backgroundColor: t.bg2 }]} accessibilityLabel="Remove the time">
          <Icon name="x" size={20} color={t.ink2} />
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- pictures ---------- */
/** Anything drawable: a memory (its `media` is used), or a plain { uri, kind } picture. */
type PicLike = { uri?: string; kind?: MediaKind; media?: MediaItem[]; emoji: string; palette: string };

const ratioCache = new Map<string, number>(); // remembered so cards don't jump when they scroll back into view

/**
 * A photo shown whole. The frame takes the photo's own shape (within sensible limits), and anything left over is
 * letterboxed — so nothing is cropped or stretched.
 */
export function AutoImage({ uri, style, minRatio = 0.62, maxRatio = 1.8, transition = 150 }: { uri: string; style?: StyleProp<ViewStyle>; minRatio?: number; maxRatio?: number; transition?: number }) {
  const t = useTheme();
  const [ratio, setRatio] = useState<number>(ratioCache.get(uri) ?? 4 / 3);
  const clamped = Math.min(maxRatio, Math.max(minRatio, ratio));
  return (
    <Image
      source={{ uri }}
      style={[style as object, { aspectRatio: clamped, backgroundColor: t.bg3 }]}
      contentFit="contain"
      transition={transition}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width && height) {
          ratioCache.set(uri, width / height);
          setRatio(width / height);
        }
      }}
    />
  );
}

/**
 * fit="cover"   (default) fills the frame and crops — only for small thumbnails and circles
 * fit="contain" shows the whole photo inside the frame you give it
 * fit="auto"    the frame adapts to the photo's own shape, so the whole photo is visible at full width
 */
export function PhotoView({ photo, style, emojiSize = 48, fit = "cover", minRatio, maxRatio, transition = 150 }: { photo: PicLike; style?: StyleProp<ViewStyle>; emojiSize?: number; fit?: "cover" | "contain" | "auto"; minRatio?: number; maxRatio?: number; transition?: number }) {
  const t = useTheme();
  const cover = photo.uri ? { uri: photo.uri, kind: photo.kind ?? "photo" } : coverOf(photo.media);
  if (cover && cover.kind !== "video") {
    const badge = cover.video ? (
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <View style={s.playDot}><Icon name="play" size={Math.max(12, emojiSize * 0.45)} color="#fff" /></View>
      </View>
    ) : null;
    if (fit === "auto") {
      if (!badge) return <AutoImage uri={cover.uri} style={style} minRatio={minRatio} maxRatio={maxRatio} transition={transition} />;
      return (
        <View style={[style, { aspectRatio: undefined, overflow: "hidden" }]}>
          <AutoImage uri={cover.uri} style={{ width: "100%" }} minRatio={minRatio} maxRatio={maxRatio} transition={transition} />
          {badge}
        </View>
      );
    }
    const img = <Image source={{ uri: cover.uri }} style={[badge ? { width: "100%", height: "100%" } : (style as object), fit === "contain" ? { backgroundColor: t.bg3 } : null]} contentFit={fit === "contain" ? "contain" : "cover"} transition={transition} />;
    return badge ? <View style={[style, { overflow: "hidden" }]}>{img}{badge}</View> : img;
  }
  if (cover && cover.kind === "video") {
    return (
      <View style={[style, { backgroundColor: "#1d1618", alignItems: "center", justifyContent: "center" }]}>
        <View style={s.playDot}><Text style={{ fontSize: emojiSize * 0.4 }}>▶</Text></View>
      </View>
    );
  }
  const [bg, hill] = PALETTES[photo.palette] || PALETTES.peach;
  return (
    <View style={[style, { backgroundColor: bg, alignItems: "center", justifyContent: "center", overflow: "hidden" }]}>
      <View style={{ position: "absolute", bottom: -34, left: -24, width: "95%", height: 100, borderRadius: 100, backgroundColor: hill, opacity: 0.35 }} />
      <Text style={{ fontSize: emojiSize }}>{photo.emoji}</Text>
    </View>
  );
}

/**
 * A round picture showing the chosen part of a photo. Pass `crop` to use the position and zoom the user set;
 * without it the photo is simply centred. The photo is never stretched.
 */
export function CropAvatar({ uri, crop, size, emoji, ring, fallbackBg }: { uri?: string; crop?: AvatarCrop; size: number; emoji?: string; ring?: boolean; fallbackBg?: string }) {
  const t = useTheme();
  const frame = { width: size, height: size, borderRadius: size / 2, overflow: "hidden" as const, borderWidth: ring ? 2.5 : 0, borderColor: t.accent, backgroundColor: fallbackBg ?? t.accentSoft };
  if (!uri) {
    return (
      <View style={[frame, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ fontSize: size * 0.5 }}>{emoji ?? "🙂"}</Text>
      </View>
    );
  }
  if (!crop) return <Image source={{ uri }} style={frame} contentFit="cover" />;
  const inner = ring ? size - 5 : size;
  const l = cropLayout(inner, crop);
  return (
    <View style={frame}>
      <Image source={{ uri }} style={{ position: "absolute", left: l.left, top: l.top, width: l.width, height: l.height }} contentFit="fill" />
    </View>
  );
}

export function Avatar({ child, size = 40, ring }: { child: Child; size?: number; ring?: boolean }) {
  const t = useTheme();
  const photo = useStore((st) => (child.avatarPhotoId ? st.memories.find((p) => p.id === child.avatarPhotoId) : undefined));
  const cover = photo ? coverOf(photo.media) : null;
  if (cover && cover.kind === "photo") return <CropAvatar uri={cover.uri} crop={child.avatarCrop} size={size} ring={ring} emoji={child.emoji} />;
  const style = { width: size, height: size, borderRadius: size / 2, overflow: "hidden" as const, borderWidth: ring ? 2.5 : 0, borderColor: t.accent };
  if (photo) return <PhotoView photo={photo} style={style} emojiSize={size * 0.5} />;
  return (
    <View style={[style, { backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ fontSize: size * 0.5 }}>{child.emoji}</Text>
    </View>
  );
}

/** A family member's round picture (or their emoji until they have one). */
export function MemberAvatar({ member, size = 40, ring }: { member: Pick<Relative, "photoUri" | "crop" | "emoji">; size?: number; ring?: boolean }) {
  return <CropAvatar uri={member.photoUri} crop={member.crop} size={size} emoji={member.emoji} ring={ring} />;
}

function VideoBox({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={{ width: "100%", aspectRatio: 16 / 9 }} nativeControls contentFit="contain" />;
}

/** Full-screen viewer for a photo or video */
export function MediaViewer({ media, onClose }: { media: { uri: string; kind: MediaKind } | null; onClose: () => void }) {
  return (
    <Modal visible={!!media} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000d", justifyContent: "center" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {media && media.kind === "video" ? <VideoBox uri={media.uri} /> : null}
        {media && media.kind === "photo" ? <Image source={{ uri: media.uri }} style={{ width: "100%", height: "80%" }} contentFit="contain" /> : null}
        <Pressable onPress={onClose} style={s.viewerClose} hitSlop={10}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>✕</Text></Pressable>
      </View>
    </Modal>
  );
}

/** Full-screen gallery: swipe right-to-left for the next picture, in the order you set. Videos play on their page. */
export function MediaGallery({ items, index, onClose }: { items: MediaItem[] | null; index: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [cur, setCur] = useState(index);
  useEffect(() => {
    setCur(index);
    const id = setTimeout(() => ref.current?.scrollTo({ x: index * width, animated: false }), 0);
    return () => clearTimeout(id);
  }, [index, items, width]);
  return (
    <Modal visible={!!items} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {items ? (
          <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setCur(Math.round(e.nativeEvent.contentOffset.x / width))} style={{ flex: 1 }}>
            {items.map((m, i) => (
              <View key={`${m.id}-${i}`} style={{ width, height, justifyContent: "center" }}>
                {m.kind === "video" ? (
                  i === cur ? <VideoBox uri={m.uri} /> : m.thumb ? <Image source={{ uri: m.thumb }} style={{ width: "100%", height: "80%" }} contentFit="contain" /> : null
                ) : (
                  <Image source={{ uri: m.uri }} style={{ width: "100%", height: "86%" }} contentFit="contain" />
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}
        {items && items.length > 1 ? (
          <View pointerEvents="none" style={{ position: "absolute", bottom: 36, left: 0, right: 0, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", backgroundColor: "#0008", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, overflow: "hidden" }}>{cur + 1} / {items.length}</Text>
          </View>
        ) : null}
        <Pressable onPress={onClose} style={s.viewerClose} hitSlop={10} accessibilityLabel="Close"><Icon name="x" size={20} color="#fff" /></Pressable>
      </View>
    </Modal>
  );
}

export function ThemePicker({ value, onChange, order, themes }: { value: string; onChange: (k: any) => void; order: string[]; themes: Record<string, { label: string; swatch: [string, string]; accent: string }> }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {order.map((k) => {
        const th = themes[k];
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={[s.themeBox, { backgroundColor: t.card, borderColor: on ? th.accent : t.line, borderWidth: on ? 2 : 1 }]}>
            <View style={{ height: 34, borderRadius: 10, backgroundColor: th.swatch[0], overflow: "hidden", marginBottom: 6 }}>
              <View style={{ position: "absolute", right: 0, width: "50%", height: "100%", backgroundColor: th.swatch[1] }} />
            </View>
            <Text style={[TYPE.labelMedium, { color: t.ink2, textAlign: "center" }]}>{th.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { borderRadius: 22, minHeight: 44, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16 },
  seg: { flexDirection: "row", borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  segItem: { flex: 1, minHeight: 42, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  scrim: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", maxHeight: "100%" },
  sheetHead: { flexDirection: "row", alignItems: "center", paddingLeft: 24, paddingRight: 16, paddingBottom: 10, gap: 10 },
  x: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  playDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fffe", alignItems: "center", justifyContent: "center" },
  viewerClose: { position: "absolute", top: 44, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "#0008", alignItems: "center", justifyContent: "center" },
  themeBox: { flex: 1, borderRadius: 16, padding: 8 },
});
