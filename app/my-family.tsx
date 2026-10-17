import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Page } from "../src/components/Page";
import { Avatar, Btn, Seg } from "../src/components/ui";
import { AppSlider } from "../src/components/AppSlider";
import { FAMILY_COLOURS, FamilyDoorFrame } from "../src/components/GrowthChart";
import { PostCard, PostViewer, useEditMemory } from "../src/components/PostCard";
import { MediaGallery } from "../src/components/ui";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { heightSeries } from "../src/lib/selectors";
import { visualMedia } from "../src/lib/display";
import { ageSpan, dateSpan, familyTimeline, heightAtAge, heightOnDate } from "../src/lib/familyCompare";
import { addDays, ageShort, daysBetween, formatDate } from "../src/lib/date";
import { Child, MediaItem, Memory, isPet } from "../src/lib/types";
import { TYPE } from "../src/theme";

/*
 * "My family": every profile together. The timeline is everyone's posts (children, pets, pregnancies) in date order, each marked with whose
 * it is. The door frame puts the children's heights side by side, without the everyday objects: on a date (the slider goes from the first
 * measurement to the last), or, with "Same age", at an age (how tall each of them was at 1, at 2…).
 */
const PAGE = 30;

const ageWords = (m: number) => {
  const y = Math.floor(m / 12), mo = Math.round(m % 12);
  if (y === 0) return `${mo} month${mo === 1 ? "" : "s"}`;
  return `${y} year${y === 1 ? "" : "s"}${mo ? `, ${mo} month${mo === 1 ? "" : "s"}` : ""}`;
};

export default function MyFamily() {
  const t = useTheme();
  const kids = useStore((s) => s.kids);
  const [view, setView] = useState<"timeline" | "door">("timeline");
  return (
    <Page title="My family">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {kids.map((k) => (
          <View key={k.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 10, borderRadius: 18, backgroundColor: t.bg2 }}>
            <Avatar child={k} size={28} /><Text style={[TYPE.labelLarge, { color: t.ink }]}>{k.name}</Text>
          </View>
        ))}
      </View>
      <Seg options={[{ id: "timeline" as const, label: "Timeline" }, { id: "door" as const, label: "Door frame" }]} value={view} onChange={setView} />
      <View style={{ marginTop: 16 }}>{view === "timeline" ? <Timeline kids={kids} /> : <Heights kids={kids.filter((k) => !isPet(k))} />}</View>
    </Page>
  );
}

function Timeline({ kids }: { kids: Child[] }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const setActive = useStore((s) => s.setActive);
  const edit = useEditMemory();
  const all = useMemo(() => familyTimeline(memories, kids), [memories, kids]);
  const [n, setN] = useState(PAGE);
  const [viewing, setViewing] = useState<Memory | null>(null);
  const [gallery, setGallery] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const byId = new Map(kids.map((k) => [k.id, k]));
  if (!all.length) return <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>No posts yet. Everyone's posts will show here, in date order.</Text>;
  let lastMonth = "";
  return (
    <View style={{ gap: 12 }}>
      {all.slice(0, n).map((p) => {
        const child = byId.get(p.childId)!;
        const month = p.date.slice(0, 7);
        const header = month !== lastMonth ? formatDate(`${month}-01`).replace(/^1 /, "") : null;
        lastMonth = month;
        return (
          <View key={p.id}>
            {header ? <Text role="heading" aria-level={2} style={[TYPE.titleMedium, { color: t.ink, marginTop: 8, marginBottom: 8 }]}>{header}</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Avatar child={child} size={24} />
              <Text style={[TYPE.labelLarge, { color: t.ink2 }]}>{child.name}</Text>
              <Text style={[TYPE.labelSmall, { color: t.ink3 }]}>· {child.expecting ? "expecting" : ageShort(child.birth, p.date)}</Text>
            </View>
            <PostCard p={p} child={child} onView={() => setViewing(p)} onOpenMedia={(i) => { const items = visualMedia(p.media).filter((m) => m.uri); if (items.length) setGallery({ items, index: Math.min(i, items.length - 1) }); }} onEdit={() => { setActive(child.id); edit(p); }} />
          </View>
        );
      })}
      {n < all.length ? <Btn label="Show more" kind="soft" onPress={() => setN(n + PAGE)} /> : null}
      {viewing ? <PostViewer p={viewing} child={byId.get(viewing.childId)!} onClose={() => setViewing(null)} onOpenMedia={(items, index) => setGallery({ items: items.filter((m) => m.uri), index })} onEdit={() => { setActive(viewing.childId); edit(viewing); setViewing(null); }} /> : null}
      <MediaGallery items={gallery?.items ?? null} index={gallery?.index ?? 0} onClose={() => setGallery(null)} />
    </View>
  );
}

function Heights({ kids }: { kids: Child[] }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const unit = useStore((s) => s.heightUnit);
  const series = useMemo(() => kids.map((k, i) => ({ child: k, colour: FAMILY_COLOURS[i % FAMILY_COLOURS.length], entries: heightSeries(memories, k.id) })), [kids, memories]);
  const measured = series.filter((s) => s.entries.length);
  const dates = dateSpan(measured.map((s) => s.entries));
  const ages = ageSpan(measured.map((s) => ({ birth: s.child.birth, entries: s.entries })));
  const [sameAge, setSameAge] = useState(false);
  const days = dates ? Math.max(0, daysBetween(dates.from, dates.to)) : 0;
  const [day, setDay] = useState(days); // starts at the latest
  const [age, setAge] = useState(ages ? Math.min(12, ages.to) : 0);
  if (!dates || !ages) return <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>No heights measured yet. Add a measurement for each child to see them side by side.</Text>;

  const date = addDays(dates.from, Math.min(day, days));
  const marks = measured.flatMap((s) => {
    const cm = sameAge ? heightAtAge(s.entries, s.child.birth, age) : heightOnDate(s.entries, date);
    return cm == null ? [] : [{ id: s.child.id, name: s.child.name, colour: s.colour, cm, note: sameAge ? undefined : ageShort(s.child.birth, date).replace(" old", "") }];
  });
  const missing = measured.filter((s) => !marks.some((m) => m.id === s.child.id)).map((s) => s.child.name);
  return (
    <View>
      <Pressable onPress={() => setSameAge((v) => !v)} accessibilityRole="switch" aria-checked={sameAge} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: t.bg2, marginBottom: 12 }}>
        <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: sameAge ? t.accent : t.outline }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", marginLeft: sameAge ? 18 : 0 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleSmall, { color: t.ink }]}>Same age</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{sameAge ? "How tall each of them was at the same age (worked out between measurements)." : "Turn on to compare them at the same age, instead of on the same day."}</Text>
        </View>
      </Pressable>

      <Text style={[TYPE.titleMedium, { color: t.ink, textAlign: "center" }]}>{sameAge ? `At ${ageWords(age)}` : formatDate(date)}</Text>
      {sameAge ? (
        <AppSlider label="Age" valueText={ageWords(age)} minimumValue={ages.from} maximumValue={Math.max(ages.from + 1, ages.to)} step={1} value={age} onValueChange={setAge} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.outline} thumbTintColor={t.accent} style={{ marginVertical: 8 }} />
      ) : (
        <AppSlider label="Date" valueText={formatDate(date)} minimumValue={0} maximumValue={Math.max(1, days)} step={1} value={Math.min(day, days)} onValueChange={setDay} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.outline} thumbTintColor={t.accent} style={{ marginVertical: 8 }} />
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={[TYPE.labelSmall, { color: t.ink3 }]}>{sameAge ? ageWords(ages.from) : formatDate(dates.from)}</Text>
        <Text style={[TYPE.labelSmall, { color: t.ink3 }]}>{sameAge ? ageWords(ages.to) : formatDate(dates.to)}</Text>
      </View>

      <FamilyDoorFrame marks={marks} unit={unit} />
      {missing.length ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 8 }]}>{missing.join(", ")}: {sameAge ? "not measured around this age" : "not measured yet by this date"}.</Text> : null}
      {series.length > measured.length ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 4 }]}>No heights yet for {series.filter((s) => !s.entries.length).map((s) => s.child.name).join(", ")}.</Text> : null}
    </View>
  );
}
