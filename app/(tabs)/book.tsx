import React, { useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Btn, Heading, Seg } from "../../src/components/ui";
import { BookPageView, BookPreviewModal } from "../../src/components/BookPreview";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { TYPE } from "../../src/theme";
import { MILESTONE_DEFS } from "../../src/lib/types";
import { BOOK_PHOTO_LIMIT, BOOK_SIZES, BOOK_STYLES, BookSizeId, BookStyle, DEFAULT_BOOK_SIZE, planBook, sizeById } from "../../src/lib/bookPages";
import { exportBook } from "../../src/lib/pdf";

export default function BookTab() {
  return (
    <Screen>
      <Book />
    </Screen>
  );
}

/**
 * The keepsake book, ready made: the birth date, then every memory in the order it happened. Choose a print size and a style, see every page,
 * and export the PDF at exactly that size.
 */
function Book() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const custom = useStore((s) => s.customDefs);
  const relatives = useStore((s) => s.relatives);
  const tagList = useStore((s) => s.tags);
  const [style, setStyle] = useState<BookStyle>("classic");
  const [sizeId, setSizeId] = useState<BookSizeId>(DEFAULT_BOOK_SIZE);
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const size = sizeById(sizeId);
  const defs = useMemo(() => [...MILESTONE_DEFS, ...(child ? custom[child.id] || [] : [])], [custom, child]);
  // the page count follows the size and the content
  const plan = useMemo(() => (child ? planBook(child, memories, size) : null), [child, memories, size]);
  if (!child || !plan) return null;

  const doExport = async () => {
    setBusy(true);
    setMsg("");
    try {
      await exportBook({ child, defs, memories: memories.filter((m) => m.childId === child.id), style, size: sizeId, relatives, tags: tagList });
      setMsg("Your book is ready. Pick where to save or send it.");
    } catch {
      setMsg("Couldn't build the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const pageProps = { child, memories, defs, size, style };
  const thumbW = (width - 32 - 2 * 10) / 3;
  const first = plan.pages.slice(0, 6);

  return (
    <View>
      <Heading title="Keepsake book" desc="Ready made from their photos and milestones, in date order from the day they were born." />

      {/* the cover, as it will be printed */}
      <Pressable onPress={() => setPreviewAt(0)} accessibilityRole="button" accessibilityLabel="Preview the book" style={{ alignSelf: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
        <BookPageView page={plan.pages[0]} width={Math.min(width - 32, size.wCm >= size.hCm ? width - 32 : (width - 32) * 0.78)} {...pageProps} />
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 16 }}>
        <Text style={[TYPE.titleMedium, { color: t.ink }]}>{plan.pages.length} pages</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>{plan.pictures} photo{plan.pictures === 1 ? "" : "s"}</Text>
      </View>
      {plan.available > plan.pictures ? (
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 2 }]}>Up to {BOOK_PHOTO_LIMIT} photos fit in one book, chosen evenly across the years. The rest of those memories are in it as words.</Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        {first.map((p, i) => (
          <Pressable key={p.key} onPress={() => setPreviewAt(i)} accessibilityLabel={`Page ${i + 1}`} style={{ alignItems: "center" }}>
            <View style={{ width: thumbW, height: thumbW, alignItems: "center", justifyContent: "center", backgroundColor: t.bg2, borderRadius: 8 }}>
              <BookPageView page={p} width={size.wCm >= size.hCm ? thumbW - 8 : (thumbW - 8) * (size.wCm / size.hCm)} {...pageProps} />
            </View>
            <Text style={[TYPE.labelSmall, { color: t.ink3, marginTop: 3 }]}>Page {i + 1}</Text>
          </Pressable>
        ))}
      </View>
      <Btn label={`Preview all ${plan.pages.length} pages`} icon="nav-book" kind="line" onPress={() => setPreviewAt(0)} style={{ marginTop: 12 }} />

      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 22, marginBottom: 8 }]}>Page size</Text>
      <View style={{ gap: 6 }}>
        {BOOK_SIZES.map((s) => {
          const on = s.id === sizeId;
          return (
            <Pressable key={s.id} onPress={() => setSizeId(s.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: t.card }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? t.accent : t.outline, alignItems: "center", justifyContent: "center" }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} /> : null}
              </View>
              <Text style={[TYPE.bodyMedium, { color: t.ink, flex: 1 }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 18, marginBottom: 6 }]}>Style</Text>
      <Seg options={BOOK_STYLES.map((s) => ({ id: s.id, label: s.label }))} value={style} onChange={setStyle} />
      <Text style={{ color: t.ink3, fontSize: 12, marginTop: 6 }}>{BOOK_STYLES.find((s) => s.id === style)?.desc}</Text>

      <Btn label={busy ? "Building your PDF…" : "Export as PDF"} icon="pdf" onPress={doExport} disabled={busy} style={{ marginTop: 18 }} />
      <Text style={{ color: t.ink4, fontSize: 12, textAlign: "center", marginTop: 8 }}>{size.label} · {plan.pages.length} pages</Text>
      {msg ? <Text style={{ color: t.accentDeep, fontWeight: "700", textAlign: "center", marginTop: 8 }}>{msg}</Text> : null}

      {previewAt !== null ? <BookPreviewModal pages={plan.pages} start={previewAt} onClose={() => setPreviewAt(null)} {...pageProps} /> : null}
    </View>
  );
}
