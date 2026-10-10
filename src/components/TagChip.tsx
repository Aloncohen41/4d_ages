import React from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { implicitPlace, labelOfTag, resolveTags } from "../lib/tags";
import { Tag, TagCategory } from "../lib/types";
import { MemberAvatar } from "./ui";
import { Icon, IconName } from "./Icon";

const CATEGORY_GLYPH: Record<TagCategory, IconName> = { person: "family", event: "star", place: "place", other: "tag" };

/** One tag, coloured by its category. People show their picture. Tap to browse everything with that tag. */
export function TagChip({ tag, onPress, onRemove, small, muted }: { tag: Tag; onPress?: () => void; onRemove?: () => void; small?: boolean; muted?: boolean }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const member = tag.category === "person" ? relatives.find((r) => r.id === tag.relatedFamilyMemberId) : undefined;
  const palette = {
    person: { bg: t.accentSoft, fg: t.accentDeep },
    event: { bg: t.goldSoft, fg: t.eventInk },
    place: { bg: t.place, fg: t.placeInk },
    other: { bg: t.bg2, fg: t.ink3 },
  }[tag.category];
  const fs = small ? 10.5 : 12.5;
  return (
    <Pressable onPress={onPress} disabled={!onPress && !onRemove} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: palette.bg, paddingLeft: member ? 3 : small ? 8 : 11, paddingRight: onRemove ? 8 : small ? 8 : 11, paddingVertical: small ? 3 : 5, borderRadius: 99, opacity: muted ? 0.75 : 1 }}>
      {member ? <MemberAvatar member={member} size={small ? 16 : 20} /> : <Icon name={CATEGORY_GLYPH[tag.category]} size={fs + 1} color={palette.fg} />}
      <Text style={{ color: palette.fg, fontWeight: "700", fontSize: fs }}>{labelOfTag(tag, relatives)}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={{ color: palette.fg, fontSize: 11 }}>✕</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** A wrapped row of a memory's tags; tapping one opens the tag browser for it. `skipPlace` hides the place from the Location field. */
export function TagRow({ item, small, skipPlace }: { item: { tagIds?: string[]; location?: string }; small?: boolean; skipPlace?: boolean }) {
  const list = useStore((s) => s.tags);
  const setTagSheet = useStore((s) => s.setTagSheet);
  const implicit = skipPlace ? implicitPlace(item)?.id : undefined;
  const tags = resolveTags(item, list).filter((t) => !(implicit && t.id === implicit && !(item.tagIds || []).includes(t.id)));
  if (!tags.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {tags.map((tg) => (
        <TagChip key={tg.id} tag={tg} small={small} onPress={() => setTagSheet({ keys: [tg.id] })} />
      ))}
    </View>
  );
}
