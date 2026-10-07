import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Avatar, Btn, Heading, PhotoView, Seg } from "../../src/components/ui";
import { useShownChild, useStore } from "../../src/lib/store";
import { heightSeries } from "../../src/lib/selectors";
import { byMoment, coverOf } from "../../src/lib/display";
import { APP_NAME } from "../../src/brand";
import { useTheme } from "../../src/lib/useTheme";
import { TYPE } from "../../src/theme";
import { MILESTONE_DEFS } from "../../src/lib/types";
import { ageShort, formatDate, smartAge } from "../../src/lib/date";
import { BOOK_SIZES, BOOK_STYLES, BookSize, BookStyle, exportBook } from "../../src/lib/pdf";

export default function BookTab() {
  return (
    <Screen>
      <Book />
    </Screen>
  );
}

function Book() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const custom = useStore((s) => s.customDefs);
  const unit = useStore((s) => s.heightUnit);
  const relatives = useStore((s) => s.relatives);
  const tagList = useStore((s) => s.tags);
  const [style, setStyle] = useState<BookStyle>("classic");
  const [size, setSize] = useState<BookSize>("square");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const defs = useMemo(() => [...MILESTONE_DEFS, ...(child ? custom[child.id] || [] : [])], [custom, child]);
  const mine = useMemo(() => (child ? memories.filter((p) => p.childId === child.id).sort(byMoment) : []), [memories, child]);
  const heights = useMemo(() => (child ? heightSeries(memories, child.id) : []), [memories, child]);

  if (!child) return null;
  const milestones = mine.filter((p) => p.type === "milestone");
  const firsts = mine.filter((p) => p.type === "first");
  const lasts = mine.filter((p) => p.type === "last");
  const between = mine.filter((p) => p.type !== "milestone" && p.type !== "first" && p.type !== "last");
  const sm = smartAge(child.birth);
  const realCount = mine.filter((p) => coverOf(p.media)?.kind === "photo").length;
  const heightCount = heights.length;
  const nameOf = (m: { milestoneId?: string; title?: string }) => defs.find((d) => d.id === m.milestoneId)?.label ?? m.title ?? "Milestone";

  const doExport = async () => {
    setBusy(true);
    setMsg("");
    try {
      await exportBook({ child, defs, memories: mine, style, size, heights, unit, relatives, tags: tagList });
      setMsg("✓ Your book is ready — pick where to save or send it.");
    } catch {
      setMsg("Couldn't build the PDF. Try again with fewer photos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Heading title="Keepsake book" desc="A preview of the keepsake. Export it as a PDF to save, share or print later." />

      <View style={{ backgroundColor: t.card, borderRadius: 24, borderWidth: 1, borderColor: t.line, overflow: "hidden" }}>
        <View style={{ backgroundColor: t.bg2, alignItems: "center", padding: 28 }}>
          <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 11 }}>{APP_NAME} presents</Text>
          <Text style={[TYPE.headlineMedium, { color: t.ink, marginTop: 6, textAlign: "center" }]}>{child.name}'s First Years</Text>
          <Text style={{ color: t.ink3, marginTop: 2 }}>born {formatDate(child.birth)}</Text>
          <View style={{ marginTop: 16 }}><Avatar child={child} size={96} ring /></View>
        </View>

        {[
          { title: "Milestones", rows: milestones.map((p) => ({ key: p.id, emoji: p.emoji, title: nameOf(p), date: p.date, note: p.description, cover: coverOf(p.media) })) },
          { title: "Firsts", rows: firsts.map((p) => ({ key: p.id, emoji: p.emoji, title: p.title || "A first", date: p.date, note: p.description, cover: coverOf(p.media) })) },
          { title: "Lasts", rows: lasts.map((p) => ({ key: p.id, emoji: p.emoji, title: p.title || "A last", date: p.date, note: p.description, cover: coverOf(p.media) })) },
        ]
          .filter((sec) => sec.rows.length)
          .map((sec) => (
            <View key={sec.title} style={{ padding: 18, borderTopWidth: 1, borderTopColor: t.line }}>
              <Text style={[TYPE.titleLarge, { color: t.ink, textAlign: "center", marginBottom: 6 }]}>{sec.title}</Text>
              {sec.rows.map((r) => (
                <View key={r.key} style={{ flexDirection: "row", gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.line, alignItems: "center" }}>
                  {r.cover ? (
                    <PhotoView photo={{ uri: r.cover.uri, kind: r.cover.kind, emoji: r.emoji, palette: "peach" }} style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden" }} emojiSize={22} />
                  ) : (
                    <Text style={{ fontSize: 26, width: 52, textAlign: "center" }}>{r.emoji}</Text>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.ink, fontWeight: "700" }}>{r.title}</Text>
                    <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 11 }}>{formatDate(r.date)}</Text>
                    {r.note ? <Text style={{ color: t.ink3, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{r.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        {!milestones.length && !firsts.length && !lasts.length ? <Text style={{ color: t.ink3, textAlign: "center", padding: 18, borderTopWidth: 1, borderTopColor: t.line }}>No milestones, firsts or lasts yet — add some with the + button.</Text> : null}

        <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: t.line }}>
          <Text style={[TYPE.titleLarge, { color: t.ink, textAlign: "center", marginBottom: 10 }]}>Moments in between</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {between.slice(-6).map((p) => (
              <View key={p.id} style={{ width: "31.5%" }}>
                <PhotoView photo={p} style={{ aspectRatio: 1, borderRadius: 10, overflow: "hidden" }} emojiSize={28} />
                <Text style={{ color: t.ink3, fontSize: 10, textAlign: "center", marginTop: 3 }}>{ageShort(child.birth, p.date)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ padding: 18, backgroundColor: t.bg2, alignItems: "center" }}>
          <Text style={[TYPE.headlineMedium, { color: t.ink }]}>{sm.value}</Text>
          <Text style={{ color: t.ink3, fontWeight: "700" }}>{sm.unit} today</Text>
        </View>
      </View>

      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 20, marginBottom: 6 }}>Style</Text>
      <Seg options={BOOK_STYLES.map((s) => ({ id: s.id, label: s.label }))} value={style} onChange={setStyle} />
      <Text style={{ color: t.ink3, fontSize: 12, marginTop: 6 }}>{BOOK_STYLES.find((s) => s.id === style)?.desc}</Text>
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 14, marginBottom: 6 }}>Page size</Text>
      <Seg options={BOOK_SIZES.map((s) => ({ id: s.id, label: s.label }))} value={size} onChange={setSize} />

      {heightCount > 0 ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5, marginTop: 12 }}>📏 Your {heightCount} height measurement{heightCount === 1 ? "" : "s"} will appear as a little ruler on the side of the pages.</Text> : null}
      <Btn label={busy ? "Building your PDF…" : "📄 Export as PDF"} onPress={doExport} disabled={busy} style={{ marginTop: 18 }} />
      <Text style={{ color: t.ink4, fontSize: 12, textAlign: "center", marginTop: 8 }}>
        Includes up to 24 of your photos ({realCount} available) — milestones, firsts and lasts first — plus every note.
      </Text>
      {msg ? <Text style={{ color: t.accentDeep, fontWeight: "700", textAlign: "center", marginTop: 8 }}>{msg}</Text> : null}
    </View>
  );
}
