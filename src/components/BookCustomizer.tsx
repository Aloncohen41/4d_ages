import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { WebFrame as WebView, WebFrameHandle, WebFrameMessage as WebViewMessageEvent } from "./WebFrame";
import { useWide } from "../lib/useWide";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOOK_STYLES, BookColour, BookPlan, BookSize, BookStyle, STYLE_LOOK } from "../lib/bookPages";
import { buildBookHtml } from "../lib/bookHtml";
import { BookDestination } from "../lib/pdf";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Icon } from "./Icon";
import { BookViewInput } from "./BookPreview";
import { BookExportSheet, ColourChoice, THEME_ICONS, themeOrder } from "./BookExportSheet";
import { Btn, Seg, dialogName } from "./ui";

import { tr } from "../lib/i18n";
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
 * change to it. The colour is one tab over. Once it looks right, the download button at the top right exports it.
 * On a computer: the pages large, with the pages before and after showing either side (arrows and the arrow keys turn them), and the
 * themes and colours in a panel beside them.
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
  const wide = useWide();
  const frame = useRef<WebFrameHandle>(null);
  const turn = (to: number) => frame.current?.injectJavaScript(`go(${Math.max(0, Math.min(pages - 1, to))})`);
  // the arrow keys turn the pages on a computer
  useEffect(() => {
    if (!wide || typeof document === "undefined") return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,[role=radiogroup]")) return;
      if (e.key === "ArrowRight") turn(page.current + 1);
      if (e.key === "ArrowLeft") turn(page.current - 1);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide, pages]);

  // the pages, drawn in the theme chosen; a new theme opens on the page you were looking at
  const html = useMemo(
    () => buildBookHtml({ ...input, image: fromPhone, mode: "pager", peek: wide ? 0.5 : true, start: page.current }),
    [input, wide],
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
  const exportSheet = exporting ? (
    <BookExportSheet themeLabel={BOOK_STYLES.find((s) => s.id === input.style)?.label ?? ""} size={input.size} pages={pages} onExport={onExport} busy={busy} progress={progress} message={message} onClose={() => setExporting(false)} />
  ) : null;

  if (wide) {
    const arrow = (dir: -1 | 1) => {
      const off = dir < 0 ? index <= 0 : index >= pages - 1;
      return (
        <Pressable onPress={() => turn(index + dir)} disabled={off} accessibilityRole="button" accessibilityLabel={dir < 0 ? tr("Previous page") : tr("Next page")}
          style={{ position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: 16, marginTop: -26, width: 52, height: 52, borderRadius: 26, backgroundColor: t.surfaceHigh, alignItems: "center", justifyContent: "center", opacity: off ? 0.35 : 1, boxShadow: "0 4px 16px rgba(0,0,0,.18)" } as object}>
          <Icon name={dir < 0 ? "chevron-left" : "chevron-right"} size={28} color={t.ink} />
        </Pressable>
      );
    };
    return (
      <Modal visible animationType="fade" onRequestClose={onClose} {...dialogName("Customize the book")}>
        <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.bg3 }}>
          <View style={{ flex: 1 }}>
            <WebView ref={frame as never} accessibilityLabel={tr("The book's pages")} {...fileAccess} source={{ html, baseUrl: "file:///" }} onMessage={onMessage} onLoadEnd={() => setLoading(false)} style={{ backgroundColor: "transparent" }} containerStyle={{ backgroundColor: "transparent" }} />
            {loading ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.accent} /></View> : null}
            {arrow(-1)}
            {arrow(1)}
          </View>
          <View style={{ width: 380, backgroundColor: t.bg, borderLeftWidth: 1, borderLeftColor: t.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text role="heading" aria-level={1} style={[TYPE.headlineSmall, { color: t.ink }]}>{tr("Customize")}</Text>
                <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Page {0} of {1} · the arrow keys turn the pages", [index + 1, pages])}</Text>
              </View>
              <Pressable onPress={onClose} accessibilityLabel={tr("Close")} accessibilityRole="button" style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: t.bg2 }}><Icon name="x" size={22} color={t.ink2} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <Seg options={[{ id: "theme" as const, label: tr("Theme") }, { id: "colour" as const, label: tr("Colour") }]} value={part} onChange={setPart} />
              {part === "theme" ? (
                <>
                  <View accessibilityRole="radiogroup" accessibilityLabel={tr("Theme")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                    {order.map((id) => {
                      const look = STYLE_LOOK[id];
                      const [a, b] = THEME_ICONS[id];
                      const on = id === input.style;
                      return (
                        <Pressable key={id} onPress={() => onStyle(id)} accessibilityRole="radio" aria-checked={on} accessibilityLabel={BOOK_STYLES.find((s) => s.id === id)?.label} style={{ width: 104, alignItems: "center" }}>
                          <View style={{ width: 96, height: 120, borderRadius: 12, backgroundColor: look.paper, borderWidth: on ? 3 : 1, borderColor: on ? t.accent : t.line, alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <Icon name={a} size={26} color={look.accent} />
                            {id !== "modern" ? <Icon name={b} size={18} color={look.sub} /> : <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: look.sub }} />}
                          </View>
                          <Text style={[TYPE.labelSmall, { color: on ? t.ink : t.ink3, marginTop: 6, fontWeight: on ? "700" : "500" }]} numberOfLines={1}>{BOOK_STYLES.find((s) => s.id === id)?.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 12 }]}>{(BOOK_STYLES.find((s) => s.id === input.style) ?? BOOK_STYLES[0]).desc}</Text>
                </>
              ) : (
                <View style={{ marginTop: 16 }}><ColourChoice value={input.colour ?? "age"} onChange={onColour} /></View>
              )}
            </ScrollView>
            <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: t.line }}>
              <Btn label={tr("Download the book")} icon="download" onPress={() => setExporting(true)} />
            </View>
          </View>
        </View>
        {exportSheet}
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent {...dialogName("Customize the book")}>
      <View style={{ flex: 1, backgroundColor: t.bg3, paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 }}>
          <Pressable onPress={onClose} accessibilityLabel={tr("Close")} hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={24} color={t.ink2} /></Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("Customize")}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Page {0} of {1}", [index + 1, pages])}</Text>
          </View>
          <Pressable onPress={() => setExporting(true)} accessibilityRole="button" accessibilityLabel={tr("Export the book")} hitSlop={6}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Icon name="download" size={22} color={t.onAccent} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <WebView accessibilityLabel={tr("The book's pages")} {...fileAccess} source={{ html, baseUrl: "file:///" }} onMessage={onMessage} onLoadEnd={() => setLoading(false)} style={{ backgroundColor: "transparent" }} containerStyle={{ backgroundColor: "transparent" }} />
          {loading ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.accent} /></View> : null}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Seg options={[{ id: "theme" as const, label: tr("Theme") }, { id: "colour" as const, label: tr("Colour") }]} value={part} onChange={setPart} />
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
                  <Pressable key={id} onPress={() => pick(i)} accessibilityRole="radio" aria-checked={id === input.style} accessibilityLabel={BOOK_STYLES.find((s) => s.id === id)?.label} style={{ width: ITEM, alignItems: "center" }}>
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
      {exportSheet}
    </Modal>
  );
}
