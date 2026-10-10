import React, { useRef, useState } from "react";
import { FlatList, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Child, Memory, MilestoneDef } from "../lib/types";
import { BookPage, BookSize, BookStyle, STYLE_LOOK, bookMetrics } from "../lib/bookPages";
import { coverOf } from "../lib/display";
import { ageLong, ageShort, formatDate, formatTime, smartAge, todayISO } from "../lib/date";
import { memoryHeading } from "../lib/pdf";
import { APP_NAME } from "../brand";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Icon } from "./Icon";

/**
 * One page of the book, drawn the way the PDF draws it (same layout, same measurements), scaled to `width`. So the preview shows each picture
 * exactly as it will appear on the page.
 */
export function BookPageView({ page, child, memories, defs, size, style, width }: {
  page: BookPage; child: Child; memories: Memory[]; defs: MilestoneDef[]; size: BookSize; style: BookStyle; width: number;
}) {
  const M = bookMetrics(size);
  const k = width / M.w; // points → screen
  const look = STYLE_LOOK[style];
  const height = width * (M.h / M.w);
  const f = (pt: number) => pt * k;
  const text = { fontFamily: look.fontApp, color: look.ink };
  const pic = (m?: Memory) => {
    const c = m ? coverOf(m.media) : null;
    return c && c.kind === "photo" ? c.uri : undefined;
  };
  const picture = (uri?: string) => (
    <View style={{ flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", marginBottom: f(2.4 * M.u) }}>
      {uri ? <Image source={{ uri }} contentFit="contain" style={{ width: "100%", height: "100%", borderRadius: f(look.radius * M.u) }} /> : null}
    </View>
  );
  const entry = (m: Memory, lines: number) => {
    const head = memoryHeading(m, defs);
    return (
      <View key={m.id}>
        {head ? <Text style={[text, { fontSize: f(M.label), fontWeight: "700" }]} numberOfLines={2}>{head}</Text> : null}
        <Text style={[text, { fontSize: f(M.meta), color: look.sub, marginTop: f(0.6 * M.u) }]} numberOfLines={1}>
          {formatDate(m.date)}{m.time ? ` · ${formatTime(m.time)}` : ""} · {ageShort(child.birth, m.date)}{m.location ? ` · ${m.location}` : ""}
        </Text>
        {m.description ? <Text style={[text, { fontSize: f(M.body), lineHeight: f(M.body * 1.35), marginTop: f(1.2 * M.u) }]} numberOfLines={lines}>{m.description}</Text> : null}
      </View>
    );
  };

  let body: React.ReactNode = null;
  if (page.kind === "cover") {
    const avatar = pic(memories.find((m) => m.id === child.avatarPhotoId));
    body = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={[text, { fontSize: f(M.meta), color: look.sub }]}>{APP_NAME}</Text>
        <Text style={[text, { fontSize: f(M.title), color: look.accent, fontWeight: "600", textAlign: "center", marginVertical: f(2 * M.u) }]}>{child.name}'s First Years</Text>
        <Text style={[text, { fontSize: f(M.meta), color: look.sub }]}>Born {formatDate(child.birth)}</Text>
        {avatar ? (
          <Image source={{ uri: avatar }} contentFit="cover" style={{ width: f(34 * M.u), height: f(34 * M.u), borderRadius: f(17 * M.u), marginTop: f(4 * M.u) }} />
        ) : (
          <Text style={{ fontSize: f(18 * M.u), marginTop: f(4 * M.u) }}>{child.emoji}</Text>
        )}
      </View>
    );
  } else if (page.kind === "birth") {
    const img = pic(page.photo) ?? pic(page.story);
    body = (
      <View style={{ flex: 1, justifyContent: img ? "flex-start" : "center", alignItems: img ? "stretch" : "center" }}>
        {img ? picture(img) : null}
        <Text style={[text, { fontSize: f(M.meta), color: look.sub, textAlign: img ? "left" : "center" }]}>The day {child.name} was born</Text>
        <Text style={[text, { fontSize: f(M.label * 1.6), fontWeight: "700", marginVertical: f(M.u), textAlign: img ? "left" : "center" }]}>{formatDate(page.date)}</Text>
        {page.story?.title ? <Text style={[text, { fontSize: f(M.label), fontWeight: "700" }]}>{page.story.title}</Text> : null}
        {page.story?.description ? <Text style={[text, { fontSize: f(M.body), lineHeight: f(M.body * 1.35), marginTop: f(1.2 * M.u) }]} numberOfLines={img ? 4 : 14}>{page.story.description}</Text> : null}
      </View>
    );
  } else if (page.kind === "picture") {
    body = (
      <View style={{ flex: 1 }}>
        {picture(pic(page.memory))}
        {entry(page.memory, 3)}
      </View>
    );
  } else if (page.kind === "notes") {
    body = <View style={{ flex: 1, gap: f(3 * M.u) }}>{page.memories.map((m) => entry(m, 5))}</View>;
  } else {
    const sm = smartAge(child.birth);
    body = (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={[text, { fontSize: f(M.title * 0.8), color: look.accent, fontWeight: "600" }]}>{child.name} today</Text>
        <Text style={[text, { fontSize: f(M.label * 1.6), fontWeight: "700", marginVertical: f(M.u) }]}>{sm.value}</Text>
        <Text style={[text, { fontSize: f(M.meta), color: look.sub }]}>{sm.unit} · {ageLong(child.birth, todayISO())}</Text>
      </View>
    );
  }
  return (
    <View style={{ width, height, backgroundColor: look.paper, padding: f(M.margin), overflow: "hidden" }}>
      {body}
    </View>
  );
}

/** Every page of the book, one at a time, before exporting: swipe or use the arrows. */
export function BookPreviewModal({ pages, start = 0, onClose, ...rest }: {
  pages: BookPage[]; start?: number; onClose: () => void; child: Child; memories: Memory[]; defs: MilestoneDef[]; size: BookSize; style: BookStyle;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const list = useRef<FlatList<BookPage>>(null);
  const M = bookMetrics(rest.size);
  // the page as large as fits, leaving room for the bar and the controls
  const pageW = Math.min(width - 32, (height - insets.top - insets.bottom - 170) * (M.w / M.h));
  const go = (i: number) => {
    const n = Math.max(0, Math.min(pages.length - 1, i));
    list.current?.scrollToIndex({ index: n, animated: true });
    setIndex(n);
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.bg3, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 }}>
          <Pressable onPress={onClose} accessibilityLabel="Close preview" hitSlop={6} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={24} color={t.ink2} /></Pressable>
          <Text style={[TYPE.titleMedium, { color: t.ink, flex: 1, textAlign: "center" }]}>Page {index + 1} of {pages.length}</Text>
          <View style={{ width: 44 }} />
        </View>
        <FlatList
          ref={list}
          data={pages}
          keyExtractor={(p) => p.key}
          horizontal
          pagingEnabled
          initialScrollIndex={start}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          windowSize={3}
          initialNumToRender={2}
          renderItem={({ item }) => (
            <View style={{ width, alignItems: "center", justifyContent: "center" }}>
              <View style={{ elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
                <BookPageView page={item} width={pageW} {...rest} />
              </View>
            </View>
          )}
        />
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 28, paddingVertical: 14 }}>
          <Pressable onPress={() => go(index - 1)} disabled={index === 0} accessibilityLabel="Previous page" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.card, alignItems: "center", justifyContent: "center", opacity: index === 0 ? 0.4 : 1 }}><Icon name="chevron-left" size={28} color={t.ink} /></Pressable>
          <Pressable onPress={() => go(index + 1)} disabled={index === pages.length - 1} accessibilityLabel="Next page" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.card, alignItems: "center", justifyContent: "center", opacity: index === pages.length - 1 ? 0.4 : 1 }}><Icon name="chevron-right" size={28} color={t.ink} /></Pressable>
        </View>
      </View>
    </Modal>
  );
}
