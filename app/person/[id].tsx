import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Page } from "../../src/components/Page";
import { MediaGallery, MemberAvatar } from "../../src/components/ui";
import { MemberSheet } from "../../src/components/MemberSheet";
import { PostCard, PostViewer, useEditMemory } from "../../src/components/PostCard";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { byMoment } from "../../src/lib/display";
import { displayName, itemsWithTags, personTag, relationLine } from "../../src/lib/tags";
import { personSummary, SummaryItem } from "../../src/lib/personSummary";
import { MediaItem, Memory } from "../../src/lib/types";
import { TYPE } from "../../src/theme";

/**
 * One person: who they are, a summary of what they're in ("5 memories, 7 photos, 1 first, 1 story"), and every memory with them, shown
 * exactly as on Home. Each part of the summary jumps to that kind of memory. Tapping a memory opens it to read; Edit is a separate tap.
 */
export default function PersonPage() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useShownChild();
  const person = useStore((s) => s.relatives.find((r) => r.id === id));
  const memories = useStore((s) => s.memories);
  const edit = useEditMemory();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<Memory | null>(null);
  const [gallery, setGallery] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const timelineY = useRef(0);
  const itemY = useRef(new Map<string, number>());

  // newest first, the same order as Home
  const posts = useMemo(
    () => (child && person ? itemsWithTags(memories.filter((m) => m.childId === child.id), [personTag(person).id]).sort((a, b) => byMoment(b, a)) : []),
    [memories, child, person]
  );
  const summary = useMemo(() => personSummary(posts), [posts]);

  if (!child || !person) {
    return (
      <Page title="Family">
        <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>This person isn't in the family any more.</Text>
      </Page>
    );
  }

  const jump = (item: SummaryItem) => {
    const y = item.firstId ? itemY.current.get(item.firstId) : 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, timelineY.current + (y ?? 0) - 8), animated: true });
  };
  const open = (p: Memory, index: number) => {
    const items = p.media.filter((m) => m.uri);
    if (items.length) setGallery({ items, index: Math.min(index, items.length - 1) });
  };

  return (
    <Page
      title={displayName(person)}
      scrollRef={scrollRef}
      right={
        <Pressable onPress={() => setEditing(true)} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>Edit</Text>
        </Pressable>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <MemberAvatar member={person} size={72} />
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleLarge, { color: t.ink }]}>{displayName(person)}</Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{relationLine(person)}</Text>
        </View>
      </View>
      {person.description ? <Text style={[TYPE.bodyLarge, { color: t.ink, marginTop: 12 }]}>{person.description}</Text> : null}

      {summary.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {summary.map((s) => (
            <Pressable key={s.key} onPress={() => jump(s)} accessibilityRole="button" accessibilityLabel={`${s.label}: show`} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: t.bg2, borderWidth: 1, borderColor: t.line }}>
              <Text style={[TYPE.labelLarge, { color: t.ink }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View onLayout={(e) => { timelineY.current = e.nativeEvent.layout.y; }} style={{ marginTop: 18 }}>
        {posts.length === 0 ? (
          <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>Tag {displayName(person)} on a photo, story or milestone and it shows up here.</Text>
        ) : (
          posts.map((p) => (
            <View key={p.id} onLayout={(e) => itemY.current.set(p.id, e.nativeEvent.layout.y)}>
              <PostCard p={p} child={child} onView={() => setViewing(p)} onOpenMedia={(i) => open(p, i)} onEdit={() => edit(p)} />
            </View>
          ))
        )}
      </View>

      {viewing ? (
        <PostViewer p={viewing} child={child} onClose={() => setViewing(null)} onOpenMedia={(items, index) => setGallery({ items: items.filter((m) => m.uri), index })} onEdit={() => { const p = viewing; setViewing(null); edit(p); }} />
      ) : null}
      <MediaGallery items={gallery?.items ?? null} index={gallery?.index ?? 0} onClose={() => setGallery(null)} />
      {editing ? <MemberSheet memberId={person.id} onClose={() => setEditing(false)} /> : null}
    </Page>
  );
}
