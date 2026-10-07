import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen, useNearEnd, useScrollControls } from "../../src/components/Screen";
import { IconButton, MediaGallery, PhotoView, Seg } from "../../src/components/ui";
import { Icon } from "../../src/components/Icon";
import { HScroll } from "../../src/components/HScroll";
import { WatchView } from "../../src/components/WatchView";
import { Memories } from "../../src/components/Memories";
import { MediaCarousel } from "../../src/components/MediaCarousel";
import { SearchSheet } from "../../src/components/SearchSheet";
import { TagRow } from "../../src/components/TagChip";
import { useShownChild, useStore } from "../../src/lib/store";
import { byMoment } from "../../src/lib/display";
import { FeedWindow, PAGE, growWindow, hasMore as hasMoreOf, showAllWindow, windowKey, windowSize } from "../../src/lib/feedWindow";
import { TYPE_META } from "../../src/lib/entries";
import { Period, inPeriod, periodLabel } from "../../src/lib/dates";
import { useTheme } from "../../src/lib/useTheme";
import { MILESTONE_DEFS, MediaItem, Memory, MemoryType } from "../../src/lib/types";
import { ageBucket, ageShort, formatDate, formatTime } from "../../src/lib/date";
import { formatHeight, formatWeight } from "../../src/lib/growth";
import { TYPE } from "../../src/theme";

type TypeFilter = "all" | MemoryType;
// the categories a post can have
const CATEGORIES: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "story", label: "📖 Stories" },
  { id: "photo", label: "📷 Pictures" },
  { id: "first", label: "🥇 Firsts" },
  { id: "last", label: "🏁 Lasts" },
  { id: "milestone", label: "⭐ Milestones" },
  { id: "measure", label: "📏 Growth" },
];

export default function HomeTab() {
  return (
    <Screen hero>
      <Home />
    </Screen>
  );
}

function Home() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const defs = useStore((s) => s.customDefs);
  const heightUnit = useStore((s) => s.heightUnit);
  const weightUnit = useStore((s) => s.weightUnit);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const setPhotoEdit = useStore((s) => s.setPhotoEdit);
  const setTagSheet = useStore((s) => s.setTagSheet);
  const scroll = useScrollControls();
  const [view, setView] = useState<"story" | "grow">("story");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [period, setPeriod] = useState<Period | null>(null);
  const [searching, setSearching] = useState(false);
  const [gallery, setGallery] = useState<{ items: MediaItem[]; index: number } | null>(null);

  // the whole story, NEWEST FIRST
  const everything = useMemo(() => (child ? memories.filter((p) => p.childId === child.id).sort((a, b) => byMoment(b, a)) : []), [memories, child]);
  const list = useMemo(
    () => everything.filter((p) => (typeFilter === "all" || p.type === typeFilter) && (!period || inPeriod(p.date, period))),
    [everything, typeFilter, period]
  );
  // only the newest page is built at first; older posts are added as you scroll toward them (or all at once for "Jump to the beginning")
  const key = windowKey(child?.id, typeFilter, period ? periodLabel(period) : "");
  const [win, setWin] = useState<FeedWindow>({ key, n: PAGE });
  const n = windowSize(win, key);
  const shown = useMemo(() => list.slice(0, n), [list, n]);
  const hasMore = hasMoreOf(list.length, n);
  const more = () => setWin((w) => growWindow(w, key, list.length));
  useNearEnd(() => { if (hasMore) more(); });
  const jumpToStart = () => {
    setWin(showAllWindow(key, list.length));
    setTimeout(scroll.toBottom, 150); // once the older posts are in place…
    setTimeout(scroll.toBottom, 700); // …and again, in case their pictures changed the height
  };
  const groups = useMemo(() => {
    if (!child) return [];
    const out: { label: string; items: Memory[] }[] = [];
    for (const p of shown) {
      const label = ageBucket(child.birth, p.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(p);
      else out.push({ label, items: [p] });
    }
    return out;
  }, [shown, child]);
  if (!child) return null;
  const milestoneLabel = (id?: string) => (id ? [...MILESTONE_DEFS, ...(defs[child.id] || [])].find((d) => d.id === id)?.label ?? null : null);

  const edit = (p: Memory) => {
    if (p.type === "milestone" && p.milestoneId) setEntrySheet({ kind: "milestone", editId: p.milestoneId });
    else if (p.type !== "photo") setEntrySheet({ kind: p.type, editId: p.id });
    else setPhotoEdit(p.id);
  };
  const badge = (p: Memory) => {
    const ms = milestoneLabel(p.milestoneId);
    if (ms) return `★ ${ms}`;
    return p.type === "photo" ? "📷 Picture" : `${TYPE_META[p.type].emoji} ${TYPE_META[p.type].label}`;
  };
  const open = (p: Memory, index = 0) => {
    const items = p.media.filter((m) => m.uri);
    if (items.length) setGallery({ items, index });
  };
  const pill = (on: boolean) => ({ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line } as const);

  return (
    <View>
      {/* title, with the tools beside it; the feed below is for reading */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={[TYPE.headlineSmall, { color: t.ink, flex: 1 }]} numberOfLines={1}>{child.name}'s Story</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <IconButton name="search" label="Search" onPress={() => setSearching(true)} active={!!period} />
          <IconButton name="tag" label="Tags" onPress={() => setTagSheet({ keys: [] })} />
        </View>
      </View>

      <Memories part="banner" />

      <View style={{ marginBottom: 12 }}>
        <Seg options={[{ id: "story", label: "Stories" }, { id: "grow", label: "Watch them grow" }]} value={view} onChange={setView} />
      </View>

      {view === "grow" ? (
        <>
          <WatchView child={child} memories={memories} />
          <View style={{ marginTop: 22 }}><Memories part="rest" /></View>
        </>
      ) : (
        <>
          <HScroll contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
            {CATEGORIES.map((c) => (
              <Pressable key={c.id} onPress={() => setTypeFilter(c.id)} style={pill(typeFilter === c.id)}>
                <Text style={{ color: typeFilter === c.id ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{c.label}</Text>
              </Pressable>
            ))}
          </HScroll>

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
            {period ? (
              <Pressable onPress={() => setPeriod(null)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 }}>
                <Icon name="calendar" size={13} color={t.accentDeep} />
                <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12 }}>{periodLabel(period)}</Text>
                <Icon name="x" size={13} color={t.accentDeep} />
              </Pressable>
            ) : null}
            {list.length > 3 ? (
              <Pressable onPress={jumpToStart} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Icon name="arrow-down" size={14} color={t.ink3} />
                <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>Jump to the beginning</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={{ alignItems: "center", padding: 30 }}>
              <Text style={{ fontSize: 44 }}>{typeFilter !== "all" || period ? "🔍" : "🌱"}</Text>
              <Text style={{ color: t.ink, fontWeight: "700", marginTop: 6 }}>{typeFilter !== "all" || period ? "Nothing here" : "No stories yet"}</Text>
              <Text style={{ color: t.ink3, textAlign: "center", marginTop: 4 }}>{typeFilter !== "all" || period ? "Try another category or date." : "Tap + to add the first one."}</Text>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.label}>
                <View style={{ alignItems: "center", marginVertical: 14 }}>
                  <Text style={{ backgroundColor: t.chipOn, color: t.onChipOn, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, overflow: "hidden" }}>{g.label}</Text>
                </View>
                {g.items.map((p) => {
                  const details = [p.time ? `🕒 ${formatTime(p.time)}` : "", p.location ? `📍 ${p.location}` : ""].filter(Boolean).join("   ");
                  return (
                    <View key={p.id} style={{ backgroundColor: t.card, borderRadius: 22, padding: 9, paddingBottom: 14, marginBottom: 16, borderWidth: 1, borderColor: t.line }}>
                      {p.media.length > 1 ? (
                        <MediaCarousel media={p.media} emoji={p.emoji} palette={p.palette} onOpen={(i) => open(p, i)} />
                      ) : (
                        <Pressable onPress={() => open(p)}>
                          {/* the whole picture, at its own shape — nothing is cropped */}
                          <PhotoView photo={p} fit="auto" style={{ width: "100%", borderRadius: 16, overflow: "hidden", aspectRatio: 4 / 3 }} emojiSize={64} />
                        </Pressable>
                      )}
                      <Text style={{ position: "absolute", left: 18, top: 18, backgroundColor: p.type === "milestone" ? t.gold : t.card, color: "#2c1f15", fontWeight: "700", fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: "hidden" }}>{badge(p)}</Text>
                      <View style={{ paddingHorizontal: 6, paddingTop: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12 }}>📅 {formatDate(p.date)}</Text>
                          <Text style={{ backgroundColor: t.accentSoft, color: t.accentDeep, fontWeight: "700", fontSize: 11, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 99, overflow: "hidden" }}>{ageShort(child.birth, p.date)}</Text>
                          <View style={{ flex: 1 }} />
                          <Pressable onPress={() => edit(p)} hitSlop={10} accessibilityLabel="Edit" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}>
                            <Icon name="edit-2" size={14} color={t.ink3} />
                          </Pressable>
                        </View>
                        {details ? <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12, marginTop: 4 }}>{details}</Text> : null}
                        {p.title ? <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 6 }}>{p.title}</Text> : null}
                        {p.heightCm != null || p.weightKg != null ? (
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                            {p.heightCm != null ? <Text style={{ backgroundColor: t.bg2, color: t.ink, fontWeight: "700", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, overflow: "hidden" }}>📏 {formatHeight(p.heightCm, heightUnit)}</Text> : null}
                            {p.weightKg != null ? <Text style={{ backgroundColor: t.bg2, color: t.ink, fontWeight: "700", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, overflow: "hidden" }}>⚖️ {formatWeight(p.weightKg, weightUnit)}</Text> : null}
                          </View>
                        ) : null}
                        {p.description ? <Text style={{ color: t.ink, fontSize: 15.5, lineHeight: 21, marginTop: 6 }}>{p.description}</Text> : null}
                        <View style={{ marginTop: 8 }}><TagRow item={p} small skipPlace /></View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}

          {hasMore ? (
            <Pressable onPress={more} style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 99, backgroundColor: t.bg2, marginTop: 4 }}>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 13 }}>Show older posts</Text>
            </Pressable>
          ) : null}

          {list.length > 3 ? (
            <Pressable onPress={scroll.toTop} style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 }}>
              <Icon name="arrow-up" size={14} color={t.ink3} />
              <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>Back to the newest</Text>
            </Pressable>
          ) : null}
        </>
      )}

      {searching ? <SearchSheet memories={everything} period={period} onPeriod={setPeriod} onClose={() => setSearching(false)} /> : null}
      <MediaGallery items={gallery?.items ?? null} index={gallery?.index ?? 0} onClose={() => setGallery(null)} />
    </View>
  );
}
