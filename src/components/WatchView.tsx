import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { Child, Memory } from "../lib/types";
import { Reel, buildWatchSections } from "../lib/reels";
import { slideView, slidesOf } from "../lib/slides";
import { addDays, formatDate, todayISO } from "../lib/date";
import { Btn, PhotoView, Sheet } from "./ui";
import { Icon } from "./Icon";
import { GrowPlayer } from "./Grow";
import { CustomReelSheet } from "./CustomReelSheet";
import { TYPE } from "../theme";

/**
 * "Watch them grow": the whole story, videos made for you by the CHILD'S age (0–1 month, 0–3 months, 0–6 months, 0–1 year, then every
 * year of age: 1–2 years, 2–3 years…) and by calendar year, or make your own. The section holding the newest video is shown first.
 */
export function WatchView({ child, memories }: { child: Child; memories: Memory[] }) {
  const t = useTheme();
  const today = todayISO();
  const mine = useMemo(() => memories.filter((m) => m.childId === child.id), [memories, child.id]);
  const sections = useMemo(() => buildWatchSections(mine, child, today), [mine, child, today]);
  const everything = useMemo(() => slidesOf(mine), [mine]);
  const [open, setOpen] = useState<Reel | null>(null);
  const [custom, setCustom] = useState<{ from: string; to: string; title?: string } | null | undefined>(undefined);

  const whole: Reel | null = everything.length > 1
    ? {
        id: "all", kind: "all", label: "From day one", title: `${child.name}'s story`, subtitle: `from day one · ${everything.length} moments`, fileLabel: "From day one",
        from: child.birth, to: today, inProgress: true, slides: everything, cover: everything.find((s) => s.uri) ?? null, newest: everything[everything.length - 1].date,
      }
    : null;

  const card = (r: Reel) => (
    <Pressable key={r.id} onPress={() => setOpen(r)} accessibilityLabel={`${r.label}, ${r.slides.length} moments`} style={{ width: "48.5%", backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, overflow: "hidden" }}>
      {r.cover ? <PhotoView photo={slideView(r.cover)} style={{ width: "100%", aspectRatio: 1.25 }} emojiSize={40} /> : <View style={{ aspectRatio: 1.25, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 34 }}>🎞️</Text></View>}
      <View style={{ position: "absolute", right: 8, top: 8, backgroundColor: "#000a", borderRadius: 99, padding: 6 }}><Icon name="play" size={12} color="#fff" /></View>
      <View style={{ padding: 11 }}>
        <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>{r.label}</Text>
        <Text style={{ color: t.ink3, fontSize: 12 }}>{r.slides.length} moments{r.inProgress ? " · so far" : ""}</Text>
      </View>
    </Pressable>
  );
  const block = (which: "age" | "years") => {
    const reels = which === "age" ? sections.age : sections.years;
    if (!reels.length) return null;
    return (
      <View key={which}>
        <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 22 }}>{which === "age" ? `${child.name} by age` : "By calendar year"}</Text>
        <Text style={{ color: t.ink3, fontSize: 12.5, marginTop: 2, marginBottom: 10 }}>{which === "age" ? "Counted from their birthday, not the calendar." : "January to December."}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{reels.map(card)}</View>
      </View>
    );
  };
  const order: ("age" | "years")[] = sections.first === "age" ? ["age", "years"] : ["years", "age"]; // the section with the newest video comes first

  return (
    <View>
      <Btn label="Make your own video" icon="film" onPress={() => setCustom({ from: addDays(today, -30), to: today })} />

      {whole ? (
        <Pressable onPress={() => setOpen(whole)} style={{ marginTop: 14, backgroundColor: t.accentSoft, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}><Icon name="play" size={24} color={t.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.titleMedium, { color: t.ink, fontSize: 18 }]}>{child.name}, from day one</Text>
            <Text style={{ color: t.ink2, fontSize: 12.5 }}>{everything.length} moments · {formatDate(everything[0].date)} → today</Text>
          </View>
        </Pressable>
      ) : null}

      {order.map(block)}

      {!sections.age.length && !sections.years.length ? <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>Videos appear here automatically once a stretch of {child.name}'s life has a couple of pictures in it.</Text> : null}

      {open ? (
        <Sheet visible onClose={() => setOpen(null)} title={open.kind === "all" ? `${child.name}, from day one` : `${child.name} · ${open.label}`}>
          <GrowPlayer slides={open.slides} child={child} title={open.title} subtitle={open.subtitle} fileLabel={open.fileLabel} />
          <Btn label="Choose the pictures yourself" kind="line" onPress={() => { const r = open; setOpen(null); setTimeout(() => setCustom({ from: r.from, to: r.to < today ? r.to : today }), 250); }} style={{ marginTop: 14 }} />
        </Sheet>
      ) : null}
      {custom ? <CustomReelSheet child={child} memories={mine} initial={custom} onClose={() => setCustom(undefined)} /> : null}
    </View>
  );
}
