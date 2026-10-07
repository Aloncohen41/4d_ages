import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import EMOJI from "../data/emoji.json";
import { useTheme } from "../lib/useTheme";

type Entry = [string, string] | [string, string, string];
interface Cat { id: string; label: string; emojis: Entry[] }
const CATS = EMOJI as unknown as Cat[];
const ICONS: Record<string, string> = { smileys: "😊", people: "👶", nature: "🐻", food: "🍓", travel: "✈️", activities: "🎈", objects: "🧸", symbols: "💖", flags: "🏳️" };
const TONES = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"];
const SWATCH = ["#f5c84c", "#f7dcc4", "#e6bc98", "#c68e64", "#99643d", "#5c3b28"];
const ALL: Entry[] = CATS.flatMap((c) => c.emojis);

const withTone = (e: Entry, tone: number): string => (!tone || e.length < 3 ? e[0] : (e[2] as string).split("~").join(TONES[tone]));

/** Every standard emoji, searchable by name, with skin tones. */
export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const t = useTheme();
  const [cat, setCat] = useState(CATS[0].id);
  const [q, setQ] = useState("");
  const [tone, setTone] = useState(0);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return (CATS.find((c) => c.id === cat) || CATS[0]).emojis;
    const words = query.split(/\s+/);
    return ALL.filter(([e, n]) => e === query || words.every((w) => n.includes(w))).slice(0, 240);
  }, [cat, q]);

  return (
    <View style={{ backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 16, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: t.line, gap: 8 }}>
        <Text>🔎</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Search 1,900+ emojis (tooth, cake…)" placeholderTextColor={t.ink4} style={{ flex: 1, paddingVertical: 10, color: t.ink, fontSize: 14 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 6, padding: 8, borderBottomWidth: 1, borderBottomColor: t.line, justifyContent: "center" }}>
        {SWATCH.map((c, i) => (
          <Pressable key={c} onPress={() => setTone(i)} hitSlop={6} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: tone === i ? 3 : 0, borderColor: t.ink }} />
        ))}
      </View>
      {!q ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: t.bg2, borderBottomWidth: 1, borderBottomColor: t.line }}>
          {CATS.map((c) => (
            <Pressable key={c.id} onPress={() => setCat(c.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: cat === c.id ? t.card : "transparent" }}>
              <Text style={{ fontSize: 20, opacity: cat === c.id ? 1 : 0.5 }}>{ICONS[c.id] || "⭐"}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView nestedScrollEnabled style={{ height: 230 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", padding: 6 }}>
        {list.length === 0 ? <Text style={{ color: t.ink3, padding: 16 }}>No match — try a simpler word.</Text> : null}
        {list.map((e) => {
          const ch = withTone(e, tone);
          return (
            <Pressable key={e[0]} onPress={() => onChange(ch)} style={{ width: "12.5%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: value === ch ? t.accentSoft : "transparent" }}>
              <Text style={{ fontSize: 24 }}>{ch}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
