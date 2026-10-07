import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { HScroll } from "../../src/components/HScroll";
import { Screen } from "../../src/components/Screen";
import { Btn, PhotoView, Seg } from "../../src/components/ui";
import { MilestoneChecklist } from "../../src/components/MilestoneChecklist";
import { ReinforceButton, ReinforceSheet } from "../../src/components/ReinforceSheet";
import { TagChip } from "../../src/components/TagChip";
import { resolveTags } from "../../src/lib/tags";
import { Tag } from "../../src/lib/types";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { byMoment, coverOf } from "../../src/lib/display";
import { FIRST_IDEAS, LAST_IDEAS, openIdeas } from "../../src/lib/suggestions";
import { MediaKind } from "../../src/lib/types";
import { TYPE } from "../../src/theme";
import { formatDate, formatTime } from "../../src/lib/date";

export default function MilestonesTab() {
  return (
    <Screen>
      <Milestones />
    </Screen>
  );
}

type Section = "milestones" | "firsts" | "lasts";

function Milestones() {
  const t = useTheme();
  const child = useShownChild();
  const [section, setSection] = useState<Section>("milestones");
  const [reinforce, setReinforce] = useState(false);
  if (!child) return null;
  const copy: Record<Section, { title: string; desc?: string }> = {
    milestones: { title: "Milestones" },
    firsts: { title: "Firsts", desc: "Things they did for the very first time. Add a photo and a few words while you still remember it." },
    lasts: { title: "Lasts", desc: "The last time for something — easy to miss when it happens, precious to look back on." },
  };
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: copy[section].desc ? 6 : 12 }}>
        <Text style={[TYPE.headlineSmall, { color: t.ink, flex: 1 }]} numberOfLines={1}>{copy[section].title}</Text>
        {section === "milestones" ? <ReinforceButton onPress={() => setReinforce(true)} /> : null}
      </View>
      {copy[section].desc ? <Text style={{ color: t.ink3, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>{copy[section].desc}</Text> : null}
      <View style={{ marginBottom: 14 }}>
        <Seg options={[{ id: "milestones" as Section, label: "Milestones" }, { id: "firsts" as Section, label: "Firsts" }, { id: "lasts" as Section, label: "Lasts" }]} value={section} onChange={setSection} />
      </View>
      {section === "milestones" ? <MilestoneChecklist /> : <EntryList kind={section === "firsts" ? "first" : "last"} />}
      <ReinforceSheet visible={reinforce} onClose={() => setReinforce(false)} />
    </View>
  );
}

/** A card that leads with the real photo when there is one, and only falls back to the icon when there isn't. */
function MemoryCard({ cover, emoji, title, subtitle, note, tags, count, onPress }: {
  cover: { uri: string; kind: MediaKind } | null; emoji: string; title: string; subtitle: string; note?: string; tags?: Tag[]; count?: number; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ width: "48.5%", backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, overflow: "hidden" }}>
      {cover ? (
        <PhotoView fit="auto" minRatio={0.7} maxRatio={1.35} photo={{ uri: cover.uri, kind: cover.kind, emoji, palette: "peach" }} style={{ width: "100%" }} emojiSize={40} />
      ) : (
        <View style={{ height: 76, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 34 }}>{emoji}</Text>
        </View>
      )}
      {count && count > 1 ? <Text style={{ position: "absolute", right: 8, top: 8, backgroundColor: "#0009", color: "#fff", fontWeight: "700", fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, overflow: "hidden" }}>📷 {count}</Text> : null}
      <View style={{ padding: 11 }}>
        <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14.5, lineHeight: 19 }} numberOfLines={2}>{title}</Text>
        <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 11, marginTop: 3 }}>{subtitle}</Text>
        {note ? <Text style={{ color: t.ink3, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{note}</Text> : null}
        {tags?.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {tags.slice(0, 2).map((tg) => <TagChip key={tg.id} tag={tg} small />)}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const when = (date: string, time?: string) => `${formatDate(date)}${time ? ` · ${formatTime(time)}` : ""}`;

function EntryList({ kind }: { kind: "first" | "last" }) {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const tagList = useStore((s) => s.tags);

  const items = useMemo(() => (child ? memories.filter((p) => p.childId === child.id && p.type === kind).sort((a, b) => byMoment(b, a)) : []), [memories, child, kind]);
  const ideas = useMemo(() => openIdeas(kind === "first" ? FIRST_IDEAS : LAST_IDEAS, items.map((p) => p.title)).slice(0, 12), [kind, items]);
  if (!child) return null;
  const word = kind === "first" ? "first" : "last";

  return (
    <View>
      <Btn label={`＋ Add a ${word}`} onPress={() => setEntrySheet({ kind })} />

      {ideas.length ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>Ideas</Text>
          <HScroll contentContainerStyle={{ gap: 8 }}>
            {ideas.map((i) => (
              <Pressable key={i.title} onPress={() => setEntrySheet({ kind, title: i.title, emoji: i.emoji })} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 99, backgroundColor: t.accentSoft }}>
                <Text style={{ fontSize: 16 }}>{i.emoji}</Text>
                <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{i.title}</Text>
              </Pressable>
            ))}
          </HScroll>
        </View>
      ) : null}

      {items.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          {items.map((p) => (
            <MemoryCard
              key={p.id}
              cover={coverOf(p.media)}
              emoji={p.emoji}
              title={p.title || (kind === "first" ? "A first" : "A last")}
              subtitle={when(p.date, p.time)}
              note={p.description}
              tags={resolveTags(p, tagList)}
              count={p.media?.length}
              onPress={() => setEntrySheet({ kind, editId: p.id })}
            />
          ))}
        </View>
      ) : (
        <View style={{ alignItems: "center", padding: 28 }}>
          <Text style={{ fontSize: 42 }}>{kind === "first" ? "🥇" : "🏁"}</Text>
          <Text style={{ color: t.ink, fontWeight: "700", marginTop: 6 }}>No {word}s logged yet</Text>
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 4 }}>Tap an idea above, or “Add a {word}”, to log {child.name}'s first one.</Text>
        </View>
      )}
    </View>
  );
}
