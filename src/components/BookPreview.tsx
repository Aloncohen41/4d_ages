import React, { useMemo, useRef, useState } from "react";
import { dialogName } from "./ui";
import { ActivityIndicator, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { WebFrame as WebView, WebFrameMessage as WebViewMessageEvent } from "./WebFrame";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookPlan, BookSize, bookMetrics } from "../lib/bookPages";
import { BookHtmlInput, buildBookHtml } from "../lib/bookHtml";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
/*
 * The book's pages on the phone, drawn from the very same HTML the PDF is printed from (bookHtml.ts), so every page — the layout, the drawings,
 * each picture's crop — looks exactly as it will in the book. Pictures are read straight from the phone (not copied in), and only as you reach them.
 */

/** What both views need: everything the book is drawn from, except where pictures come from and how the pages are laid out on screen. */
export type BookViewInput = Omit<BookHtmlInput, "image" | "mode" | "start" | "overview">;

const fileAccess = {
  originWhitelist: ["*"] as string[],
  allowFileAccess: true,
  allowFileAccessFromFileURLs: true,
  allowUniversalAccessFromFileURLs: true,
  javaScriptEnabled: true,
  setSupportMultipleWindows: false,
};
const fromPhone = (uri: string) => uri || null;

/** The cover, large, and the next few pages as thumbnails. Tapping one opens the preview there. */
export function BookOverview({ input, count, width, onOpen }: { input: BookViewInput; count: number; width: number; onOpen: (index: number) => void }) {
  const M = bookMetrics(input.size);
  const ratio = M.h / M.w;
  const coverW = ratio > 1.2 ? width * 0.78 : width;
  const thumbW = Math.floor((width - 20) / 3);
  const shown = Math.min(count, 7);
  const rows = Math.ceil((shown - 1) / 3);
  const height = Math.ceil(coverW * ratio + 16 + rows * (thumbW * ratio + 30));
  const html = useMemo(
    () => buildBookHtml({ ...input, image: fromPhone, mode: "overview", overview: Array.from({ length: shown }, (_, i) => ({ index: i, width: i === 0 ? coverW : thumbW })) }),
    [input, shown, coverW, thumbW],
  );
  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (typeof m.open === "number") onOpen(m.open);
    } catch { /* not ours */ }
  };
  return (
    <View style={{ width, height }}>
      <WebView accessibilityLabel={tr("The book's pages")} {...fileAccess} source={{ html, baseUrl: "file:///" }} onMessage={onMessage} scrollEnabled={false} style={{ backgroundColor: "transparent" }} containerStyle={{ backgroundColor: "transparent" }} />
    </View>
  );
}

/** Every page of the book, one at a time, before exporting: swipe or use the arrows. */
export function BookPreviewModal({ input, pages, start = 0, onClose }: { input: BookViewInput & { plan: BookPlan; size: BookSize }; pages: number; start?: number; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const [loading, setLoading] = useState(true);
  const web = useRef<WebView>(null);
  // built once per opening: swiping is handled inside the page, so the document never reloads while you browse
  const html = useMemo(() => buildBookHtml({ ...input, image: fromPhone, mode: "pager", start }), [input, start]);
  const go = (i: number) => {
    const n = Math.max(0, Math.min(pages - 1, i));
    web.current?.injectJavaScript(`window.go&&window.go(${n});true;`);
    setIndex(n);
  };
  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (typeof m.page === "number") setIndex(m.page);
    } catch { /* not ours */ }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent {...dialogName("The book, page by page")}>
      <View style={{ flex: 1, backgroundColor: t.bg3, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 }}>
          <Pressable onPress={onClose} accessibilityLabel={tr("Close preview")} hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={24} color={t.ink2} /></Pressable>
          <Text style={[TYPE.titleMedium, { color: t.ink, flex: 1, textAlign: "center" }]}>{tr("Page {0} of {1}", [index + 1, pages])}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, minHeight: height * 0.4 }}>
          <WebView accessibilityLabel={tr("The book's pages")} ref={web} {...fileAccess} source={{ html, baseUrl: "file:///" }} onMessage={onMessage} onLoadEnd={() => setLoading(false)} style={{ backgroundColor: "transparent" }} containerStyle={{ backgroundColor: "transparent" }} />
          {loading ? <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.accent} /></View> : null}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 28, paddingVertical: 14 }}>
          <Pressable onPress={() => go(index - 1)} disabled={index === 0} accessibilityLabel={tr("Previous page")} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.card, alignItems: "center", justifyContent: "center", opacity: index === 0 ? 0.4 : 1 }}><Icon name="chevron-left" size={28} color={t.ink} /></Pressable>
          <Pressable onPress={() => go(index + 1)} disabled={index === pages - 1} accessibilityLabel={tr("Next page")} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.card, alignItems: "center", justifyContent: "center", opacity: index === pages - 1 ? 0.4 : 1 }}><Icon name="chevron-right" size={28} color={t.ink} /></Pressable>
        </View>
      </View>
    </Modal>
  );
}
