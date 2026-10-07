import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { byMoment, coverOf } from "../lib/display";
import { MILESTONE_DEFS, MediaItem, Memory } from "../lib/types";
import { ageShort, formatDate } from "../lib/date";
import { MediaGallery, PhotoView, Sheet } from "./ui";

export type CollectionKind = "photos" | "milestones" | "stories";

/** The three lists behind the profile boxes: all photos (no stories), milestones by name, and stories only. */
export function CollectionSheet({ kind, onClose }: { kind: CollectionKind | null; onClose: () => void }) {
  const t = useTheme();
  const child = useActiveChild();
  const memories = useStore((s) => s.memories);
  const custom = useStore((s) => s.customDefs);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const setPhotoEdit = useStore((s) => s.setPhotoEdit);
  const [gallery, setGallery] = useState<{ items: MediaItem[]; index: number } | null>(null);

  const mine = useMemo(() => (child ? memories.filter((m) => m.childId === child.id).sort((a, b) => byMoment(b, a)) : []), [memories, child]);
  const defs = useMemo(() => [...MILESTONE_DEFS, ...(child ? custom[child.id] || [] : [])], [custom, child]);

  // photos: every picture or video of the photo memories (stories are not mixed in), newest first
  const tiles = useMemo(() => {
    const out: { memory: Memory; media?: MediaItem }[] = [];
    for (const m of mine) if (m.type === "photo") {
      if (m.media.length) m.media.forEach((x) => out.push({ memory: m, media: x }));
      else out.push({ memory: m });
    }
    return out;
  }, [mine]);
  const playable = useMemo(() => tiles.filter((x) => x.media).map((x) => x.media as MediaItem), [tiles]);
  const milestones = mine.filter((m) => m.type === "milestone");
  const stories = mine.filter((m) => m.type === "story");

  if (!kind || !child) return null;
  const title = kind === "photos" ? `${child.name}'s photos` : kind === "milestones" ? `${child.name}'s milestones` : `${child.name}'s stories`;
  const count = kind === "photos" ? tiles.length : kind === "milestones" ? milestones.length : stories.length;
  const nameOf = (m: Memory) => defs.find((d) => d.id === m.milestoneId)?.label ?? m.title ?? "Milestone";

  const edit = (m: Memory) => {
    onClose();
    setTimeout(() => (m.type === "milestone" && m.milestoneId ? setEntrySheet({ kind: "milestone", editId: m.milestoneId }) : setEntrySheet({ kind: m.type as "story", editId: m.id })), 250);
  };

  return (
    <Sheet visible onClose={onClose} title={title}>
      <Text style={{ color: t.ink3, fontWeight: "700", marginBottom: 12 }}>{count} {kind === "photos" ? (count === 1 ? "photo or video" : "photos & videos") : kind === "milestones" ? (count === 1 ? "milestone" : "milestones") : (count === 1 ? "story" : "stories")}</Text>

      {kind === "photos" ? (
        tiles.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {tiles.map((x, i) => (
              <Pressable
                key={`${x.memory.id}-${x.media?.id ?? i}`}
                onPress={() => (x.media ? setGallery({ items: playable, index: Math.max(0, playable.indexOf(x.media)) }) : (onClose(), setTimeout(() => setPhotoEdit(x.memory.id), 250)))}
                style={{ width: "32.3%", aspectRatio: 1, borderRadius: 10, overflow: "hidden" }}
              >
                <PhotoView photo={{ media: x.media ? [x.media] : [], emoji: x.memory.emoji, palette: x.memory.palette }} style={{ width: "100%", height: "100%" }} emojiSize={30} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>No photos yet. Use the + button to add some.</Text>
        )
      ) : null}

      {kind === "milestones"
        ? milestones.length
          ? milestones.map((m) => (
              <Pressable key={m.id} onPress={() => edit(m)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>{nameOf(m)}</Text>
                  <Text style={{ color: t.ink3, fontSize: 12 }}>{formatDate(m.date)} · {ageShort(child.birth, m.date)}</Text>
                </View>
                <Text style={{ color: t.ink4, fontSize: 18 }}>›</Text>
              </Pressable>
            ))
          : <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>No milestones logged yet. Open the Milestones tab to start.</Text>
        : null}

      {kind === "stories"
        ? stories.length
          ? stories.map((m) => {
              const c = coverOf(m.media);
              return (
                <Pressable key={m.id} onPress={() => edit(m)} style={{ flexDirection: "row", gap: 12, backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 10, marginBottom: 8 }}>
                  {c ? <PhotoView photo={{ media: m.media, emoji: m.emoji, palette: m.palette }} style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden" }} emojiSize={24} /> : <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 26 }}>{m.emoji}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{m.title || "A story"}</Text>
                    <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 11 }}>{formatDate(m.date)}</Text>
                    {m.description ? <Text style={{ color: t.ink3, fontSize: 12.5, marginTop: 2 }} numberOfLines={2}>{m.description}</Text> : null}
                  </View>
                </Pressable>
              );
            })
          : <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>No stories yet. Tap + and choose Story.</Text>
        : null}

      <MediaGallery items={gallery?.items ?? null} index={gallery?.index ?? 0} onClose={() => setGallery(null)} />
    </Sheet>
  );
}
