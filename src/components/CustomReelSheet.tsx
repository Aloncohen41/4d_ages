import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "../lib/useTheme";
import { Child, Memory } from "../lib/types";
import { ageShort, formatDate, todayISO } from "../lib/date";
import { Slide, slideView, slidesOf } from "../lib/slides";
import { clampRange, dayDate, dayIndex, presetRanges, rangeSpan, totalDays, videoTitles } from "../lib/rangePick";
import { Btn, Input, Label, PhotoView, Sheet } from "./ui";
import { HScroll } from "./HScroll";
import { Icon } from "./Icon";
import { GrowPlayer } from "./Grow";
import { VideoExportSheet } from "./VideoExportSheet";
import { useStore } from "../lib/store";

/** One end of the range: the date, how old the child is then, a slider, and a one-day nudge each way. */
function End({ label, child, total, committed, shown, rev, onLive, onCommit }: {
  label: string; child: Child; total: number; committed: number; shown: number; rev: number; onLive: (v: number) => void; onCommit: (v: number) => void;
}) {
  const t = useTheme();
  const date = dayDate(child.birth, shown);
  const age = ageShort(child.birth, date);
  const nudge = (d: number) => (
    <Pressable onPress={() => onCommit(committed + d)} hitSlop={8} accessibilityLabel={`${label}: ${d < 0 ? "one day earlier" : "one day later"}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}>
      <Icon name={d < 0 ? "chevron-left" : "chevron-right"} size={18} color={t.ink2} />
    </Pressable>
  );
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 11.5, letterSpacing: 0.6 }}>{label.toUpperCase()}</Text>
        <Text style={{ backgroundColor: t.accentSoft, color: t.accentDeep, fontWeight: "700", fontSize: 12, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 99, overflow: "hidden" }}>
          {age === "birth day" ? `the day ${child.name} was born` : `${child.name} is ${age}`}
        </Text>
      </View>
      <Text style={{ color: t.ink, fontWeight: "700", fontSize: 18, marginTop: 4 }}>{formatDate(date)}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
        {nudge(-1)}
        {total > 0 ? (
          <Slider
            key={`${label}-${rev}` /* remounted after each release so the thumb always shows the committed (never an out-of-order) position */}
            style={{ flex: 1, height: 42 }}
            minimumValue={0}
            maximumValue={total}
            step={1}
            value={committed}
            onValueChange={(v: number) => onLive(Math.round(v))}
            onSlidingComplete={(v: number) => onCommit(Math.round(v))}
            minimumTrackTintColor={t.accent}
            maximumTrackTintColor={t.line}
            thumbTintColor={t.accent}
            accessibilityLabel={`${label} date`}
          />
        ) : <View style={{ flex: 1 }} />}
        {nudge(1)}
      </View>
    </View>
  );
}

/** The thumbnails to tick. Memoised: the sliders move constantly while this only changes when the chosen range does. */
const Gallery = React.memo(function Gallery({ candidates, picked, onToggle }: { candidates: Slide[]; picked: Set<string>; onToggle: (id: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {candidates.map((c) => {
        const on = picked.has(c.id);
        return (
          <Pressable key={c.id} onPress={() => onToggle(c.id)} style={{ width: "32.3%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", borderWidth: 3, borderColor: on ? t.accent : "transparent", backgroundColor: t.bg3 }}>
            <View style={{ flex: 1, opacity: on ? 1 : 0.45 }}>
              <PhotoView photo={slideView(c)} fit="contain" style={{ width: "100%", height: "100%" }} emojiSize={26} />
            </View>
            <View style={{ position: "absolute", right: 5, top: 5 }}><Icon name={on ? "check-square" : "square"} size={20} color={on ? t.accent : "#fff"} /></View>
            {c.video ? <View style={{ position: "absolute", left: 5, top: 5, backgroundColor: "#000b", borderRadius: 99, padding: 4 }}><Icon name="film" size={11} color="#fff" /></View> : null}
            <Text style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", color: "#fff", backgroundColor: "#0008", fontSize: 9.5, fontWeight: "700", paddingVertical: 1 }}>{formatDate(c.date).replace(/, \d{4}$/, "")}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

/**
 * Make your own memory video. Slide the START and the END along the child's life: the date and the child's age at each end show as you drag,
 * so "here is Maya at 1–2 years old" is easy to make. Then tick the pictures you want, preview, and save it (the export sheet lets you pick
 * the cover picture). A video clip appears in the movie as its cover frame.
 */
export function CustomReelSheet({ child, memories, initial, onClose }: { child: Child; memories: Memory[]; initial?: { from: string; to: string; title?: string }; onClose: () => void }) {
  const t = useTheme();
  const speed = useStore((s) => s.growSpeed);
  const today = todayISO();
  const total = totalDays(child.birth, today);
  const startAt = initial ? { from: dayIndex(child.birth, initial.from, total), to: dayIndex(child.birth, initial.to, total) } : { from: Math.max(0, total - 30), to: total };
  const [range, setRange] = useState(() => clampRange(startAt.from, startAt.to, "from", total));
  const [live, setLive] = useState<{ from?: number; to?: number }>({});
  const [rev, setRev] = useState(0);
  const [name, setName] = useState(initial?.title ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const commit = (moved: "from" | "to", v: number) => {
    setRange((r) => clampRange(moved === "from" ? v : r.from, moved === "to" ? v : r.to, moved, total));
    setLive({});
    setRev((x) => x + 1);
  };
  const preset = (from: number, to: number) => { setRange(clampRange(from, to, "from", total)); setLive({}); setRev((x) => x + 1); };

  const fromDate = dayDate(child.birth, range.from);
  const toDate = dayDate(child.birth, range.to);
  // the age range shown WHILE sliding; the committed one names the video
  const liveSpan = rangeSpan(child.birth, live.from ?? range.from, live.to ?? range.to);
  const span = rangeSpan(child.birth, range.from, range.to);
  const titles = videoTitles(child.name, span, name);

  // every picture and video added in the range (a post with several pictures offers each of them)
  const candidates = useMemo(() => slidesOf(memories.filter((m) => m.date >= fromDate && m.date <= toDate), { perMedia: true }), [memories, fromDate, toDate]);
  const key = candidates.map((c) => c.id).join("|");
  useEffect(() => {
    setPicked(new Set(candidates.map((c) => c.id))); // start with everything ticked; untick what you don't want
    setPreviewing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const chosen: Slide[] = useMemo(() => candidates.filter((c) => picked.has(c.id)), [candidates, picked]);
  const toggle = React.useCallback((id: string) => setPicked((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const presets = useMemo(() => presetRanges(child.birth, today), [child.birth, today]);
  const chip = (on: boolean) => ({ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99, backgroundColor: on ? t.accent : t.accentSoft } as const);

  return (
    <Sheet visible onClose={onClose} title="Make your own video">
      <HScroll contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {presets.map((p) => {
          const on = p.from === range.from && p.to === range.to;
          return (
            <Pressable key={p.id} onPress={() => preset(p.from, p.to)} style={chip(on)}>
              <Text style={{ color: on ? t.onAccent : t.accentDeep, fontWeight: "700", fontSize: 12 }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </HScroll>

      {/* what the title card will say, updating as you slide */}
      <View style={{ backgroundColor: t.accentSoft, borderRadius: 18, padding: 14, marginTop: 14 }}>
        <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 11.5, letterSpacing: 0.6 }}>YOUR VIDEO</Text>
        <Text style={{ color: t.ink, fontWeight: "700", fontSize: 19, marginTop: 3 }}>Here is {child.name}</Text>
        <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 15 }}>at {liveSpan.display} old</Text>
      </View>

      <End label="From" child={child} total={total} committed={range.from} shown={live.from ?? range.from} rev={rev} onLive={(v) => setLive((l) => ({ ...l, from: v }))} onCommit={(v) => commit("from", v)} />
      <End label="To" child={child} total={total} committed={range.to} shown={live.to ?? range.to} rev={rev} onLive={(v) => setLive((l) => ({ ...l, to: v }))} onCommit={(v) => commit("to", v)} />

      {candidates.length === 0 ? (
        <Text style={{ color: t.ink3, textAlign: "center", padding: 26 }}>No photos or videos were added between these dates. Slide the start or end to widen it.</Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 }}>
            <Text style={{ color: t.ink, fontWeight: "700" }}>{chosen.length} of {candidates.length} chosen</Text>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <Pressable onPress={() => setPicked(new Set(candidates.map((c) => c.id)))}><Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>Select all</Text></Pressable>
              <Pressable onPress={() => setPicked(new Set())}><Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12.5 }}>None</Text></Pressable>
            </View>
          </View>
          <Gallery candidates={candidates} picked={picked} onToggle={toggle} />

          <Label>Name your video (optional)</Label>
          <Input value={name} onChangeText={setName} placeholder={titles.title} maxLength={50} />

          {previewing && chosen.length ? <View style={{ marginTop: 16 }}><GrowPlayer slides={chosen} child={child} title={titles.title} subtitle={titles.subtitle} fileLabel={span.file} /></View> : null}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <Btn label={previewing ? "Hide preview" : "▶ Preview"} kind="line" onPress={() => setPreviewing((p) => !p)} disabled={!chosen.length} style={{ flex: 1 }} />
            <Btn label="🎬 Create video" onPress={() => { setPreviewing(false); setExporting(true); }} disabled={!chosen.length} style={{ flex: 1.2 }} />
          </View>
          <Text style={{ color: t.ink4, fontSize: 11.5, textAlign: "center", marginTop: 8 }}>You'll choose the cover picture when you create it. Videos you ticked appear in the movie as their cover frame.</Text>
        </>
      )}
      <VideoExportSheet visible={exporting} onClose={() => setExporting(false)} slides={chosen} child={child} initialSpeed={speed} title={titles.title} subtitle={titles.subtitle} fileLabel={span.file} />
    </Sheet>
  );
}
