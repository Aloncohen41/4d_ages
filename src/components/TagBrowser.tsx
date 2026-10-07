import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { byMoment, blurb, coverOf } from "../lib/display";
import { KIND_META } from "../lib/entries";
import { TAG_CATEGORIES, itemsWithTags, searchTags, tagFromId, tagStats } from "../lib/tags";
import { Memory, Tag, TagCategory } from "../lib/types";
import { formatDate, formatTime } from "../lib/date";
import { openMemory } from "../lib/openMemory";
import { Btn, Input, PhotoView, Seg, Sheet } from "./ui";
import { TagChip } from "./TagChip";

const typeLabel = (p: Memory) => `${KIND_META[p.type].emoji} ${KIND_META[p.type].label}`;

/** The child's memories (photos, stories, milestones, firsts, lasts, measurements…) as one list. */
function useMemories(childId?: string): Memory[] {
  const memories = useStore((s) => s.memories);
  return useMemo(() => (childId ? memories.filter((m) => m.childId === childId) : []), [memories, childId]);
}

/** Everything carrying any of these tags, whatever type it is. */
export function TagResults({ keys, childId }: { keys: string[]; childId: string }) {
  const t = useTheme();
  const all = useMemories(childId);
  const found = useMemo(() => itemsWithTags(all, keys).sort((a, b) => byMoment(b, a)), [all, keys]);
  if (!found.length) return <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>Nothing is tagged with this yet.</Text>;
  const counts = new Map<string, number>();
  found.forEach((p) => counts.set(typeLabel(p), (counts.get(typeLabel(p)) || 0) + 1));
  return (
    <View>
      <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12, marginBottom: 8 }}>
        {found.length} {found.length === 1 ? "memory" : "memories"} · {[...counts.entries()].map(([k, n]) => `${n} ${k.replace(/^\S+\s/, "").toLowerCase()}${n === 1 ? "" : "s"}`).join(", ")}
      </Text>
      {found.map((p) => {
        const cover = coverOf(p.media);
        return (
          <Pressable key={p.id} onPress={() => openMemory(p)} style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 10, marginBottom: 8 }}>
            <PhotoView photo={{ uri: cover?.uri, kind: cover?.kind, emoji: p.emoji, palette: p.palette }} style={{ width: 58, height: 58, borderRadius: 12, overflow: "hidden" }} emojiSize={26} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 11 }}>{typeLabel(p)}</Text>
              <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14 }} numberOfLines={2}>{blurb(p) || KIND_META[p.type].label}</Text>
              <Text style={{ color: t.ink3, fontSize: 11.5 }}>{formatDate(p.date)}{p.time ? ` · ${formatTime(p.time)}` : ""}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Browse every tag in use, search them, and open all the memories that share one. */
export function TagBrowserSheet() {
  const sheet = useStore((s) => s.tagSheet);
  const setTagSheet = useStore((s) => s.setTagSheet);
  const child = useActiveChild();
  if (!sheet || !child) return null;
  return <Browser key={sheet.keys.join("|")} initial={sheet.keys} childId={child.id} childName={child.name} onClose={() => setTagSheet(null)} />;
}

function Browser({ initial, childId, childName, onClose }: { initial: string[]; childId: string; childName: string; onClose: () => void }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const list = useStore((s) => s.tags);
  const all = useMemories(childId);
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TagCategory | "all">("all");

  const stats = useMemo(() => tagStats(all, list, relatives), [all, list, relatives]);
  const shown = useMemo(() => searchTags(stats, query, relatives).filter((s) => kind === "all" || s.category === kind), [stats, query, relatives, kind]);
  const selectedTags = selected.map((id) => stats.find((s) => s.id === id)?.tag ?? tagFromId(id, list, relatives)).filter((x): x is Tag => !!x);
  // text search over titles and notes when no tag matches
  const textHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || shown.length) return [];
    return all.filter((p) => `${p.title || ""} ${p.description}`.toLowerCase().includes(q)).sort((a, b) => byMoment(b, a)).slice(0, 20);
  }, [all, query, shown.length]);

  return (
    <Sheet visible onClose={onClose} title={selected.length ? "Tagged memories" : "Tags & search"}>
      {selected.length ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {selectedTags.map((tg) => <TagChip key={tg.id} tag={tg} onRemove={() => setSelected((c) => c.filter((x) => x !== tg.id))} />)}
          </View>
          <Btn label="← All tags" kind="soft" onPress={() => setSelected([])} style={{ paddingVertical: 9, marginBottom: 14 }} />
          <TagResults keys={selected} childId={childId} />
        </>
      ) : (
        <>
          <Input value={query} onChangeText={setQuery} placeholder="Search tags — try “Grandma”, a place or an event" returnKeyType="search" />
          <View style={{ marginTop: 10 }}>
            <Seg options={[{ id: "all" as const, label: "All" }, ...TAG_CATEGORIES.map((k) => ({ id: k.id, label: `${k.emoji} ${k.short}` }))]} value={kind} onChange={setKind} />
          </View>

          {query.trim() && shown.filter((s) => s.category === "person").length > 1 ? (
            <Btn label={`Show all ${shown.filter((s) => s.category === "person").length} matching people together`} kind="line" onPress={() => setSelected(shown.filter((s) => s.category === "person").map((s) => s.id))} style={{ marginTop: 12, paddingVertical: 10 }} />
          ) : null}

          <View style={{ marginTop: 14, gap: 8 }}>
            {shown.map((s) => (
              <Pressable key={s.id} onPress={() => setSelected([s.id])} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 10 }}>
                <TagChip tag={s.tag} />
                <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12.5 }}>{s.count} {s.count === 1 ? "memory" : "memories"}  ›</Text>
              </Pressable>
            ))}
          </View>

          {!shown.length && !textHits.length ? (
            <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>
              {stats.length ? "No tags match that." : `No tags yet. Add people, events and places to ${childName}'s memories and they'll show up here.`}
            </Text>
          ) : null}

          {textHits.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12, marginBottom: 8 }}>No tag matches — memories mentioning “{query.trim()}”:</Text>
              {textHits.map((p) => (
                <Pressable key={p.id} onPress={() => openMemory(p)} style={{ backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, padding: 10, marginBottom: 8 }}>
                  <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 11 }}>{typeLabel(p)} · {formatDate(p.date)}</Text>
                  <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={2}>{blurb(p)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
