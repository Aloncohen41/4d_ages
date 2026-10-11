import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BOOK_COLOURS, BOOK_STYLES, BookColour, BookSize, BookStyle, KIDS_THEMES, STYLE_LOOK } from "../lib/bookPages";
import { BookDestination } from "../lib/pdf";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Btn, Sheet } from "./ui";
import { Icon, IconName } from "./Icon";

/** What each theme looks like, in two little pictures. */
const THEME_ICONS: Record<BookStyle, [IconName, IconName]> = {
  classic: ["t-moon", "t-balloon"], nature: ["t-leaf", "t-flower"], playful: ["t-kite", "t-teddy"], modern: ["t-font", "t-font"],
  stars: ["t-moon", "t-star"], blossom: ["t-flower", "heart"], explorer: ["t-plane", "t-cloud"], rainbow: ["t-rainbow", "t-balloon"],
};

/** The book's themes as cards: the paper colour, its pictures and its name. The kids' themes (with a page background) come first. */
export function ThemeCards({ value, onChange }: { value: BookStyle; onChange: (s: BookStyle) => void }) {
  const t = useTheme();
  const order = [...KIDS_THEMES, ...BOOK_STYLES.map((s) => s.id).filter((id) => !KIDS_THEMES.includes(id))];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {order.map((id) => {
        const s = BOOK_STYLES.find((x) => x.id === id)!;
        const look = STYLE_LOOK[id];
        const on = id === value;
        const [a, b] = THEME_ICONS[id];
        return (
          <Pressable key={id} onPress={() => onChange(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${s.label}: ${s.desc}`}
            style={{ width: "48%", borderRadius: 16, borderWidth: on ? 3 : 1, borderColor: on ? t.accent : t.line, overflow: "hidden" }}>
            <View style={{ backgroundColor: look.paper, height: 64, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 14 }}>
              <Icon name={a} size={28} color={look.accent} />
              {id !== "modern" ? <Icon name={b} size={22} color={look.sub} /> : null}
            </View>
            <View style={{ padding: 10, backgroundColor: t.card }}>
              <Text style={[TYPE.titleSmall, { color: t.ink }]}>{s.label}{KIDS_THEMES.includes(id) ? "  ·  new" : ""}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={2}>{s.desc}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The colour choices: by age, or one colour all through. */
export function ColourChoice({ value, onChange }: { value: BookColour; onChange: (c: BookColour) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {BOOK_COLOURS.map((c) => {
        const on = c.id === value;
        return (
          <Pressable key={c.id} onPress={() => onChange(c.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={c.label} style={{ alignItems: "center", width: 54 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: on ? 3 : 1, borderColor: on ? t.accent : t.line, padding: 3 }}>
              {c.id === "age" ? (
                <View style={{ flex: 1, borderRadius: 20, overflow: "hidden", flexDirection: "row" }}>
                  {BOOK_COLOURS.slice(1).map((x) => <View key={x.id} style={{ flex: 1, backgroundColor: x.swatch }} />)}
                </View>
              ) : <View style={{ flex: 1, borderRadius: 20, backgroundColor: c.swatch }} />}
            </View>
            <Text style={[TYPE.labelSmall, { color: on ? t.ink : t.ink3, marginTop: 4 }]} numberOfLines={1}>{c.id === "age" ? "Theme's own" : c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Just before the PDF is made: the theme (with its page background) and colour, a reminder of the size and page count, a look at the pages,
 * and then save it to the phone or share it. While the PDF is made, it says how far along it is.
 */
export function BookExportSheet({ style, colour, size, pages, onStyle, onColour, onPreview, onExport, busy, progress, message, onClose }: {
  style: BookStyle; colour: BookColour; size: BookSize; pages: number;
  onStyle: (s: BookStyle) => void; onColour: (c: BookColour) => void; onPreview: () => void;
  onExport: (to: BookDestination) => void; busy: BookDestination | null; progress: string; message: string; onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Sheet visible onClose={busy ? () => undefined : onClose} title="Before you export">
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 8 }]}>Theme</Text>
      <ThemeCards value={style} onChange={onStyle} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 18, marginBottom: 8 }]}>Colour</Text>
      <ColourChoice value={colour} onChange={onColour} />
      <Btn label="Look through the pages" icon="nav-book" kind="line" onPress={onPreview} disabled={!!busy} style={{ marginTop: 18 }} />
      <Text style={[TYPE.bodySmall, { color: t.ink3, textAlign: "center", marginTop: 10 }]}>{size.label} · {pages} pages</Text>
      <Btn label={busy === "save" ? "Saving your PDF…" : "Save PDF to phone"} icon="download" onPress={() => onExport("save")} disabled={!!busy} style={{ marginTop: 10 }} />
      <Btn label={busy === "share" ? "Building your PDF…" : "Share PDF"} icon="share" kind="line" onPress={() => onExport("share")} disabled={!!busy} style={{ marginTop: 10 }} />
      {busy ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <ActivityIndicator color={t.accent} />
          <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{progress || "Getting started…"}</Text>
        </View>
      ) : null}
      {message ? <Text style={{ color: t.accentDeep, fontWeight: "700", textAlign: "center", marginTop: 10 }}>{message}</Text> : null}
    </Sheet>
  );
}
