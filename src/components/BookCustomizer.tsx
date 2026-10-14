import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { WebFrame as WebView, WebFrameMessage as WebViewMessageEvent } from "./WebFrame";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOOK_STYLES, BookColour, BookPlan, BookSize, BookStyle, STYLE_LOOK } from "../lib/bookPages";
import { buildBookHtml } from "../lib/bookHtml";
import { BookDestination } from "../lib/pdf";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Icon } from "./Icon";
import { BookViewInput } from "./BookPreview";
import { BookExportSheet, ColourChoice, THEME_ICONS, themeOrder } from "./BookExportSheet";
import { Seg } from "./ui";

const fileAccess = {
  originWhitelist: ["*"] as string[],
  allowFileAccess: true,
  allowFileAccessFromFileURLs: true,
  allowUniversalAccessFromFileURLs: true,
  javaScriptEnabled: true,
  setSupportMultipleWindows: false,
};
const fromPhone = (uri: string) => uri || null;

/**
 * Customize the book, like choosing a filter: the book's pages in front of you (a little of the page before and after showing at the sides,
 * swipe between them), and the themes along the bottom: slide them left and right, the one in the middle is the book's theme and the pages
 * change to it. The colour is one tab over. Once it looks right, the share button at the top right exports it.
 */
export function BookCustomizer({ input, pages, pet, onStyle, onColour, onClose, onExport, busy, progress, message }: {
  input: BookViewInput & { plan: BookPlan; size: BookSize; style: BookStyle; colour?: BookColour };
  pages: number;
  pet: boolean;
  onStyle: (s: BookStyle) => void;
  onColour: (c: BookColour) => void;
  onClose: () => void;
  onExport: (to: BookDestination) => void;
  busy: BookDestination | null;
  progress: string;
  message: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [part, setPart] = useState<"theme" | "colour">("theme");
  const [exporting, setExporting] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const page = useRef(0);

  // the pages, drawn in the theme chosen; a new theme opens on the page you were looking at
  const html = useMemo(
    () => buildBookHtml({ ...input, image: fromPhone, mode: "pager", peek: true, start: page.current }),
    [input],
  );
  useEffect(() => setLoading(true), [html]);
  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (typeof m.page === "number") { page.current = m.page; setIndex(m.page); }
    } catch { /* not ours */ }
  };

  // the theme strip: five across, the middle one chosen; each grows as it reaches the middle
  const order = themeOrder(pet);
  const ITEM = Math.floor(width / 5);
  const at = Math.max(0, order.indexOf(input.style));
  const x = useRef(new Animated.Value(at * ITEM)).current;
  const strip = useRef<ScrollView>(null);
  const [centred, setCentred] = useState(at);
  const settle = (offset: number) => {
    const i = Math.max(0, Math.min(order.length - 1, Math.round(offset / ITEM)));
    setCentred(i);
    if (order[i] !== input.style) onStyle(order[i]);
  };
  const pick = (i: number) => {
    strip.current?.scrollTo({ x: i * ITEM, animated: true });
    setCentred(i);
    if (order[i] !== input.style) onStyle(order[i]);
  };
  const shown = BOOK_STYLES.find((s) => s.id === order[centred]) ?? BOOK_STYLES[0];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.bg3, paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 }}>
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={24} color={t.ink2} /></Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[TYPE.titleMedium, { color: t.ink }]}>Customize</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Page {index + 1} of {pages}</Text>
          </View>
          <Pressable onPress={() => setExporting(true)} accessibilityRole="button" accessibilityLabel="Export the book" hitSlop={6}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Icon name="share" size={22} color={t.onAccent} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <WebView {...fileAccess} source={{ html, baseUrl: "file:///" }} onMessage={onMessage} onLoadEnd={() => setLoading(false)} style={{ backgroundColor: "transparent" }} containerStyle={{ backgroundColor: "transparent" }} />
          {loading ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.accent} /></View> : null}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Seg options={[{ id: "theme" as const, label: "Theme" }, { id: "colour" as const, label: "Colour" }]} value={part} onChange={setPart} />
        </View>
        {part === "theme" ? (
          <View style={{ paddingTop: 10 }}>
            <Text style={[TYPE.titleSmall, { color: t.ink, textAlign: "center" }]}>{shown.label}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3, textAlign: "center", paddingHorizontal: 24, minHeight: 34 }]} numberOfLines={2}>{shown.desc}</Text>
            <Animated.ScrollView
              ref={strip as never}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM}
              decelerationRate="fast"
              contentOffset={{ x: at * ITEM, y: 0 }}
              onLayout={() => strip.current?.scrollTo({ x: at * ITEM, animated: false })} // (the website doesn't take a starting offset)
              contentContainerStyle={{ paddingHorizontal: (width - ITEM) / 2, paddingVertical: 8 }}
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
                useNativeDriver: true,
                listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
                  const i = Math.max(0, Math.min(order.length - 1, Math.round(e.nativeEvent.contentOffset.x / ITEM)));
                  if (i !== centred) setCentred(i);
                },
              })}
              onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
              onScrollEndDrag={(e) => { if (!e.nativeEvent.velocity?.x) settle(e.nativeEvent.contentOffset.x); }}
            >
              {order.map((id, i) => {
                const look = STYLE_LOOK[id];
                const [a, b] = THEME_ICONS[id];
                const scale = x.interpolate({ inputRange: [(i - 1) * ITEM, i * ITEM, (i + 1) * ITEM], outputRange: [0.8, 1, 0.8], extrapolate: "clamp" });
                const on = i === centred;
                return (
                  <Pressable key={id} onPress={() => pick(i)} accessibilityRole="radio" accessibilityState={{ selected: id === input.style }} accessibilityLabel={BOOK_STYLES.find((s) => s.id === id)?.label} style={{ width: ITEM, alignItems: "center" }}>
                    <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
                      <View style={{ width: ITEM - 12, height: (ITEM - 12) * 1.25, borderRadius: 12, backgroundColor: look.paper, borderWidth: on ? 3 : 1, borderColor: on ? t.accent : t.line, alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Icon name={a} size={26} color={look.accent} />
                        {id !== "modern" ? <Icon name={b} size={18} color={look.sub} /> : <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: look.sub }} />}
                      </View>
                      <Text style={[TYPE.labelSmall, { color: on ? t.ink : t.ink3, marginTop: 6 }]} numberOfLines={1}>{BOOK_STYLES.find((s) => s.id === id)?.label}</Text>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </Animated.ScrollView>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <ColourChoice value={input.colour ?? "age"} onChange={onColour} />
          </ScrollView>
        )}
      </View>
      {exporting ? (
        <BookExportSheet themeLabel={BOOK_STYLES.find((s) => s.id === input.style)?.label ?? ""} size={input.size} pages={pages} onExport={onExport} busy={busy} progress={progress} message={message} onClose={() => setExporting(false)} />
      ) : null}
    </Modal>
  );
}
