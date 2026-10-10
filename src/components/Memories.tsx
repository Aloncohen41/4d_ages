import React, { useEffect, useMemo, useState } from "react";
import { HScroll } from "./HScroll";
import { Pressable, Text, View } from "react-native";
import { useShownChild, useStore } from "../lib/store";
import { heightSeries } from "../lib/selectors";
import { useTheme } from "../lib/useTheme";
import { MILESTONE_DEFS } from "../lib/types";
import { ageShort, formatDate, todayISO } from "../lib/date";
import { birthdayBanner, buildRecap, currentYear, onThisDay, yearWindow } from "../lib/recap";
import { formatHeight } from "../lib/growth";
import { blurb } from "../lib/display";
import { BOOK_STYLES, BookSize, BookStyle, exportBook } from "../lib/pdf";
import { Btn, PhotoView, Seg, Sheet } from "./ui";
import { GrowPlayer } from "./Grow";
import { slidesOf } from "../lib/slides";
import { TYPE } from "../theme";

/** Top of the timeline: birthday banner, "On this day", and a way into the yearly recap. */
export function Memories({ part = "all" }: { part?: "banner" | "rest" | "all" }) {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const [recapYear, setRecapYear] = useState<number | null>(null);
  const pending = useStore((s) => s.pendingRecap);
  const setPendingRecap = useStore((s) => s.setPendingRecap);

  // a birthday reminder was tapped → open that year's recap
  useEffect(() => {
    if (pending && child && pending.childId === child.id) {
      setRecapYear(pending.year);
      setPendingRecap(null);
    }
  }, [pending, child, setPendingRecap]);

  const today = todayISO();
  const banner = child ? birthdayBanner(child.birth, today) : null;
  const flashbacks = useMemo(() => (child ? onThisDay(memories, child.id, today).slice(0, 8) : []), [memories, child, today]);
  if (!child) return null;
  const hasPhotos = memories.some((p) => p.childId === child.id);

  const bannerText = banner
    ? banner.daysUntil > 0
      ? `${child.name} turns ${banner.turning} in ${banner.daysUntil} day${banner.daysUntil === 1 ? "" : "s"}`
      : banner.daysUntil === 0
      ? `Happy birthday, ${child.name}!`
      : `${child.name} turned ${banner.turning} ${-banner.daysUntil} day${banner.daysUntil === -1 ? "" : "s"} ago`
    : "";

  return (
    <View style={{ marginBottom: 14 }}>
      {banner && part !== "rest" ? (
        <Pressable onPress={() => setRecapYear(banner.turning)} style={{ backgroundColor: t.accentSoft, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: t.accent, marginBottom: 12 }}>
          <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12 }}>Year in review is ready</Text>
          <Text style={[TYPE.titleLarge, { color: t.ink, marginTop: 2 }]}>{bannerText}</Text>
          <Text style={{ color: t.ink2, marginTop: 4, fontSize: 13 }}>See the highlights of {child.name}'s year {banner.turning} — tap to play or export it.</Text>
        </Pressable>
      ) : null}

      {flashbacks.length && part !== "banner" ? (
        <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 14, marginBottom: 12 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>On this day</Text>
          <HScroll contentContainerStyle={{ gap: 10, paddingTop: 10 }}>
            {flashbacks.map(({ memory, yearsAgo }) => (
              <View key={memory.id} style={{ width: 130 }}>
                <PhotoView fit="contain" photo={memory} style={{ width: 130, height: 100, borderRadius: 12, overflow: "hidden" }} emojiSize={36} />
                <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 11, marginTop: 5 }}>{yearsAgo} year{yearsAgo === 1 ? "" : "s"} ago · {ageShort(child.birth, memory.date).replace(" old", "")}</Text>
                <Text style={{ color: t.ink3, fontSize: 11 }} numberOfLines={2}>{blurb(memory)}</Text>
              </View>
            ))}
          </HScroll>
        </View>
      ) : null}

      {hasPhotos && !banner && part !== "banner" ? (
        <Pressable onPress={() => setRecapYear(currentYear(child.birth, today))}>
          <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 13, textDecorationLine: "underline" }}>See {child.name}'s year in review</Text>
        </Pressable>
      ) : null}

      {recapYear !== null ? <RecapSheet initialYear={recapYear} onClose={() => setRecapYear(null)} /> : null}
    </View>
  );
}

function RecapSheet({ initialYear, onClose }: { initialYear: number; onClose: () => void }) {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const custom = useStore((s) => s.customDefs);
  const unit = useStore((s) => s.heightUnit);
  const relatives = useStore((s) => s.relatives);
  const tagList = useStore((s) => s.tags);
  const [year, setYear] = useState(initialYear);
  const [playing, setPlaying] = useState(false);
  const [style, setStyle] = useState<BookStyle>("storybook");
  const [size] = useState<BookSize>("square-20");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const today = todayISO();
  const defs = useMemo(() => [...MILESTONE_DEFS, ...(child ? custom[child.id] || [] : [])], [custom, child]);
  const recap = useMemo(() => {
    if (!child) return null;
    const { start, end } = yearWindow(child.birth, year);
    return { win: { start, end }, ...buildRecap(memories, heightSeries(memories, child.id), child.id, start, end) };
  }, [memories, child, year]);

  if (!child || !recap) return null;
  const maxYear = Math.max(initialYear, currentYear(child.birth, today));
  const inProgress = recap.win.end > today;
  const grew = recap.startCm !== undefined && recap.endCm !== undefined && recap.endCm > recap.startCm ? recap.endCm - recap.startCm : null;

  const doExport = async () => {
    setBusy(true);
    setMsg("");
    try {
      await exportBook({
        child, defs, memories: recap.highlights, relatives, tags: tagList, style, size,
        title: `${child.name}'s Year ${year}`, subtitle: `${formatDate(recap.win.start)} – ${formatDate(recap.win.end)}`,
      });
      setMsg("Your recap is ready. Pick where to save or send it.");
    } catch {
      setMsg("Couldn't build the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title={`${child.name}'s year ${year} in review`}>
      <HScroll contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
        {Array.from({ length: maxYear }, (_, i) => i + 1).map((y) => (
          <Pressable key={y} onPress={() => { setYear(y); setPlaying(false); }} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: y === year ? t.chipOn : t.card, borderWidth: 1, borderColor: y === year ? t.chipOn : t.line }}>
            <Text style={{ color: y === year ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>Year {y}</Text>
          </Pressable>
        ))}
      </HScroll>
      <Text style={{ color: t.ink3, fontSize: 12 }}>{formatDate(recap.win.start)} – {formatDate(recap.win.end)}{inProgress ? " · so far" : ""}</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        {[[String(recap.photoCount), "photos"], [String(recap.milestones.length + recap.firsts.length), "firsts"], [grew !== null ? `+${formatHeight(grew, unit)}` : "—", "grew"]].map(([v, l]) => (
          <View key={l} style={{ flex: 1, backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 12, alignItems: "center" }}>
            <Text style={[TYPE.titleLarge, { color: t.ink }]}>{v}</Text>
            <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 11 }}>{l}</Text>
          </View>
        ))}
      </View>

      {recap.highlights.length === 0 ? (
        <Text style={{ color: t.ink3, textAlign: "center", marginTop: 24 }}>No photos from this year yet — add some on the timeline and come back.</Text>
      ) : (
        <>
          <Btn label={playing ? "Hide player" : "Play the year"} icon={playing ? undefined : "play"} onPress={() => setPlaying((p) => !p)} style={{ marginTop: 16 }} />
          {playing ? <View style={{ marginTop: 14 }}><GrowPlayer slides={slidesOf(recap.highlights)} child={child} title={`${child.name}'s year ${year}`} fileLabel={`Year ${year}`} /></View> : null}

          {recap.milestones.length || recap.firsts.length ? (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15, marginBottom: 6 }}>Milestones, firsts & lasts this year</Text>
              {[
                ...recap.milestones.map((m) => ({ key: m.id, date: m.date, text: `${defs.find((d) => d.id === m.milestoneId)?.label || m.title || "Milestone"}` })),
                ...recap.firsts.map((p) => ({ key: p.id, date: p.date, text: `${p.title || (p.type === "last" ? "A last" : "A first")}` })),
              ]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((x) => (
                  <Text key={x.key} style={{ color: t.ink2, marginBottom: 4 }}>{x.text} · {formatDate(x.date)}</Text>
                ))}
            </View>
          ) : null}

          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15, marginTop: 18, marginBottom: 8 }}>Highlights</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {recap.highlights.map((p) => (
              <PhotoView key={p.id} photo={p} style={{ width: "31.5%", aspectRatio: 1, borderRadius: 10, overflow: "hidden" }} emojiSize={26} />
            ))}
          </View>

          <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 20, marginBottom: 6 }}>PDF style</Text>
          <Seg options={BOOK_STYLES.map((s) => ({ id: s.id, label: s.label }))} value={style} onChange={setStyle} />
          <Btn icon={busy ? undefined : "pdf"} label={busy ? "Building your PDF…" : "Export this year as PDF"} onPress={doExport} disabled={busy} style={{ marginTop: 14 }} />
          {msg ? <Text style={{ color: t.accentDeep, fontWeight: "700", textAlign: "center", marginTop: 8 }}>{msg}</Text> : null}
        </>
      )}
    </Sheet>
  );
}
