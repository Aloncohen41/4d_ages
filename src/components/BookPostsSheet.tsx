import React from "react";
import { Pressable, Text, View } from "react-native";
import { Memory, MilestoneDef } from "../lib/types";
import { memoryHeading } from "../lib/bookHtml";
import { formatDate } from "../lib/date";
import { blurb } from "../lib/display";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Btn, PhotoView, Sheet } from "./ui";
import { Icon } from "./Icon";

/** Every post the book could hold, ticked when it's in. Untick one to leave it out of the book; tick it again to bring it back. */
export function BookPostsSheet({ posts, defs, excluded, onChange, onClose }: {
  posts: Memory[]; defs: MilestoneDef[]; excluded: string[]; onChange: (excluded: string[]) => void; onClose: () => void;
}) {
  const t = useTheme();
  const out = new Set(excluded);
  const inCount = posts.filter((m) => !out.has(m.id)).length;
  const toggle = (id: string) => onChange(out.has(id) ? excluded.filter((x) => x !== id) : [...excluded, id]);
  return (
    <Sheet visible onClose={onClose} title="Choose posts">
      <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>{inCount} of {posts.length} posts are in the book. Untick a post to leave it out.</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 6 }}>
        <Btn label="Include all" kind="line" onPress={() => onChange(excluded.filter((x) => !posts.some((m) => m.id === x)))} style={{ flex: 1 }} />
        <Btn label="Leave all out" kind="line" onPress={() => onChange([...new Set([...excluded, ...posts.map((m) => m.id)])])} style={{ flex: 1 }} />
      </View>
      {posts.map((m) => {
        const on = !out.has(m.id);
        const head = memoryHeading(m, defs) || blurb(m) || "Photo";
        return (
          <Pressable key={m.id} onPress={() => toggle(m.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${head}, ${formatDate(m.date)}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line, opacity: on ? 1 : 0.55 }}>
            <Icon name={on ? "check-square" : "square"} size={24} color={on ? t.accent : t.ink3} />
            <PhotoView photo={m} emojiSize={18} style={{ width: 48, height: 48, borderRadius: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.bodyLarge, { color: t.ink }]} numberOfLines={1}>{head}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{formatDate(m.date)}</Text>
            </View>
          </Pressable>
        );
      })}
    </Sheet>
  );
}
