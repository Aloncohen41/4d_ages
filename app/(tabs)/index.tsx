import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen, useNearEnd, useScrollControls } from "../../src/components/Screen";
import { IconButton, MediaGallery, Seg } from "../../src/components/ui";
import { Icon } from "../../src/components/Icon";
import { HScroll } from "../../src/components/HScroll";
import { WatchView } from "../../src/components/WatchView";
import { Memories } from "../../src/components/Memories";
import { SearchSheet } from "../../src/components/SearchSheet";
import { PostCard, PostViewer, useEditMemory } from "../../src/components/PostCard";
import { useShownChild, useStore } from "../../src/lib/store";
import { byMoment } from "../../src/lib/display";
import { FeedWindow, PAGE, growWindow, hasMore as hasMoreOf, showAllWindow, windowKey, windowSize } from "../../src/lib/feedWindow";
import { Period, inPeriod, periodLabel } from "../../src/lib/dates";
import { useTheme } from "../../src/lib/useTheme";
import { MediaItem, Memory, MemoryType } from "../../src/lib/types";
import { ageBucket } from "../../src/lib/date";
import { TYPE } from "../../src/theme";

type TypeFilter = "all" | MemoryType;
// the categories a post can have
const CATEGORIES: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "story", label: "Stories" },
  { id: "photo", label: "Pictures" },
  { id: "first", label: "Firsts" },
  { id: "last", label: "Lasts" },
  { id: "milestone", label: "Milestones" },
  { id: "measure", label: "Growth" },
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
  const setTagSheet = useStore((s) => s.setTagSheet);
  const edit = useEditMemory();
  const [viewing, setViewing] = useState<Memory | null>(null);
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
  const open = (p: Memory, index = 0) => {
    const items = p.media.filter((m) => m.uri);
    if (items.length) setGallery({ items, index: Math.min(index, items.length - 1) });
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
              <Icon name={typeFilter !== "all" || period ? "search" : "images"} size={40} color={t.ink3} />
              <Text style={{ color: t.ink, fontWeight: "700", marginTop: 6 }}>{typeFilter !== "all" || period ? "Nothing here" : "No stories yet"}</Text>
              <Text style={{ color: t.ink3, textAlign: "center", marginTop: 4 }}>{typeFilter !== "all" || period ? "Try another category or date." : "Tap + to add the first one."}</Text>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.label}>
                <View style={{ alignItems: "center", marginVertical: 14 }}>
                  <Text style={{ backgroundColor: t.chipOn, color: t.onChipOn, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, overflow: "hidden" }}>{g.label}</Text>
                </View>
                {g.items.map((p) => (
                  <PostCard key={p.id} p={p} child={child} onView={() => setViewing(p)} onOpenMedia={(i) => open(p, i)} onEdit={() => edit(p)} />
                ))}
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
      {viewing ? (
        <PostViewer p={viewing} child={child} onClose={() => setViewing(null)} onOpenMedia={(items, index) => setGallery({ items: items.filter((m) => m.uri), index })} onEdit={() => { const p = viewing; setViewing(null); edit(p); }} />
      ) : null}
      <MediaGallery items={gallery?.items ?? null} index={gallery?.index ?? 0} onClose={() => setGallery(null)} />
    </View>
  );
}
